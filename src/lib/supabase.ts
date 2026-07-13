import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  SupabaseDiagnosticCategory,
  SupabaseKeyKind,
  SupabaseNetworkDiagnostic
} from "./types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const runtimeMode = import.meta.env.MODE;
const DIAGNOSTIC_TIMEOUT_MS = 8_000;

function normalizeSupabaseUrl(value: string | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return {
      isValid: false,
      trimmedValue: null,
      host: null,
      error: null
    };
  }

  try {
    const parsedUrl = new URL(trimmedValue);

    return {
      isValid: true,
      trimmedValue,
      host: parsedUrl.host,
      error: null
    };
  } catch (error) {
    return {
      isValid: false,
      trimmedValue,
      host: null,
      error: error instanceof Error ? error.message : "URL invalide"
    };
  }
}

function describeAnonKey(value: string | undefined) {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue) {
    return {
      kind: "missing" as SupabaseKeyKind,
      length: 0
    };
  }

  if (trimmedValue.startsWith("sb_publishable_")) {
    return {
      kind: "publishable" as SupabaseKeyKind,
      length: trimmedValue.length
    };
  }

  if (trimmedValue.startsWith("eyJ")) {
    return {
      kind: "legacy" as SupabaseKeyKind,
      length: trimmedValue.length
    };
  }

  return {
    kind: "unknown" as SupabaseKeyKind,
    length: trimmedValue.length
  };
}

function nowTimestamp() {
  return new Date().toISOString();
}

function getDurationMs(startedAtMs: number) {
  return Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAtMs);
}

function getErrorName(error: unknown) {
  if (error && typeof error === "object" && "name" in error && typeof error.name === "string") {
    return error.name;
  }

  return null;
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return typeof error === "string" ? error : null;
}

function classifyConnectivityFailure(
  error: unknown,
  hostReachable: boolean | null
): { category: SupabaseDiagnosticCategory; state: string } {
  const errorName = getErrorName(error);
  const errorMessage = getErrorMessage(error)?.toLowerCase() ?? "";
  const browserOnline = typeof navigator === "undefined" ? true : navigator.onLine;

  if (errorName === "AbortError") {
    return {
      category: "timeout",
      state: "Timeout"
    };
  }

  if (!browserOnline) {
    return {
      category: "network_unavailable",
      state: "Réseau indisponible"
    };
  }

  if (
    errorMessage.includes("err_name_not_resolved") ||
    errorMessage.includes("name not resolved") ||
    errorMessage.includes("enotfound") ||
    hostReachable === false
  ) {
    return {
      category: "dns",
      state: "DNS ou domaine inaccessible"
    };
  }

  if (
    errorMessage.includes("cors") ||
    errorMessage.includes("cross-origin") ||
    (hostReachable === true && (errorMessage.includes("failed to fetch") || errorMessage.includes("fetch failed")))
  ) {
    return {
      category: "cors",
      state: "Erreur CORS ou blocage navigateur"
    };
  }

  return {
    category: "other",
    state: "Autre erreur réseau"
  };
}

function looksLikeKeyRefusal(status: number, bodySnippet: string | null) {
  const normalizedBody = bodySnippet?.toLowerCase() ?? "";

  return (
    (status === 401 || status === 403) &&
    (normalizedBody.includes("api key") ||
      normalizedBody.includes("apikey") ||
      normalizedBody.includes("invalid api key") ||
      normalizedBody.includes("no api key found"))
  );
}

function looksLikeSupabaseAuthError(status: number, bodySnippet: string | null) {
  const normalizedBody = bodySnippet?.toLowerCase() ?? "";

  return (
    (status === 400 || status === 401 || status === 422 || status === 429) &&
    (normalizedBody.includes("auth") ||
      normalizedBody.includes("invalid login credentials") ||
      normalizedBody.includes("email not confirmed") ||
      normalizedBody.includes("rate limit"))
  );
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = DIAGNOSTIC_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function readResponseSnippet(response: Response) {
  try {
    const contentType = response.headers.get("content-type") ?? "";

    if (!/(json|text|javascript)/i.test(contentType)) {
      return null;
    }

    const body = await response.text();
    return body.replace(/\s+/g, " ").trim().slice(0, 280) || null;
  } catch {
    return null;
  }
}

export function resolveSupabaseEndpoint(path: string) {
  if (!normalizedSupabaseUrl.trimmedValue) {
    return null;
  }

  const baseUrl = normalizedSupabaseUrl.trimmedValue.endsWith("/")
    ? normalizedSupabaseUrl.trimmedValue
    : `${normalizedSupabaseUrl.trimmedValue}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

  return new URL(normalizedPath, baseUrl).toString();
}

function createSupabaseFetchLogger(host: string | null) {
  return async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const requestUrl =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method =
      init?.method ??
      (typeof input === "object" && "method" in input && input.method ? input.method : "GET");
    const pathname = (() => {
      try {
        return new URL(requestUrl).pathname;
      } catch {
        return requestUrl;
      }
    })();
    const shouldLog = pathname.includes("/auth/v1");

    if (shouldLog && runtimeMode !== "test") {
      console.info("[mt-jef-supabase] request:start", {
        method,
        host,
        pathname
      });
    }

    try {
      const response = await fetch(input, init);

      if (shouldLog && runtimeMode !== "test") {
        console.info("[mt-jef-supabase] request:end", {
          method,
          host,
          pathname,
          ok: response.ok,
          status: response.status
        });
      }

      return response;
    } catch (error) {
      if (runtimeMode !== "test") {
        console.error("[mt-jef-supabase] request:error", {
          method,
          host,
          pathname,
          online: typeof navigator !== "undefined" ? navigator.onLine : null,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      throw error;
    }
  };
}

const normalizedSupabaseUrl = normalizeSupabaseUrl(supabaseUrl);
const anonKeyMetadata = describeAnonKey(supabaseAnonKey);
const missingSupabaseEnv = [
  !supabaseUrl ? "VITE_SUPABASE_URL" : null,
  !supabaseAnonKey ? "VITE_SUPABASE_ANON_KEY" : null
].filter(Boolean) as string[];

export const isSupabaseConfigured =
  missingSupabaseEnv.length === 0 && normalizedSupabaseUrl.isValid;
export const supabaseConfigError =
  missingSupabaseEnv.length > 0
    ? `Configuration Supabase incomplete: ${missingSupabaseEnv.join(", ")}.`
    : !normalizedSupabaseUrl.isValid
      ? `Configuration Supabase invalide: VITE_SUPABASE_URL n'est pas une URL exploitable.${normalizedSupabaseUrl.error ? ` Detail: ${normalizedSupabaseUrl.error}` : ""}`
      : null;

export const supabaseRuntimeDebug = {
  mode: runtimeMode,
  hasUrl: Boolean(normalizedSupabaseUrl.trimmedValue),
  urlHost: normalizedSupabaseUrl.host,
  urlValid: normalizedSupabaseUrl.isValid,
  anonKeyKind: anonKeyMetadata.kind,
  anonKeyLength: anonKeyMetadata.length,
  configured: isSupabaseConfigured
};

if (typeof window !== "undefined" && runtimeMode !== "test") {
  console.info("[mt-jef-supabase] runtime", supabaseRuntimeDebug);
}

export async function testSupabaseConnection(): Promise<SupabaseNetworkDiagnostic> {
  const testedAt = nowTimestamp();
  const startedAtMs = typeof performance !== "undefined" ? performance.now() : Date.now();
  const authEndpoint = resolveSupabaseEndpoint("/auth/v1/settings");
  const restEndpoint = resolveSupabaseEndpoint("/rest/v1/");

  if (!isSupabaseConfigured || !authEndpoint || !restEndpoint) {
    return {
      category: "configuration",
      duration_ms: getDurationMs(startedAtMs),
      endpoint: authEndpoint ?? restEndpoint,
      error_message: supabaseConfigError,
      error_name: "ConfigurationError",
      host_reachable: null,
      http_status: null,
      notes: [],
      project_accessible: false,
      state: "Configuration incomplète",
      tested_at: testedAt
    };
  }

  try {
    await fetchWithTimeout(authEndpoint, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store"
    });
  } catch (error) {
    const classification = classifyConnectivityFailure(error, false);

    return {
      category: classification.category,
      duration_ms: getDurationMs(startedAtMs),
      endpoint: authEndpoint,
      error_message: getErrorMessage(error),
      error_name: getErrorName(error),
      host_reachable: false,
      http_status: null,
      notes: [],
      project_accessible: false,
      state: classification.state,
      tested_at: testedAt
    };
  }

  const headers = {
    apikey: supabaseAnonKey.trim(),
    Authorization: `Bearer ${supabaseAnonKey.trim()}`
  };

  try {
    const authResponse = await fetchWithTimeout(authEndpoint, {
      method: "GET",
      cache: "no-store",
      headers
    });
    const authSnippet = await readResponseSnippet(authResponse);
    const notes = [`Probe auth settings HTTP ${authResponse.status}`];

    const restResponse = await fetchWithTimeout(restEndpoint, {
      method: "GET",
      cache: "no-store",
      headers
    });
    const restSnippet = await readResponseSnippet(restResponse);

    if (looksLikeKeyRefusal(restResponse.status, restSnippet)) {
      return {
        category: "http",
        duration_ms: getDurationMs(startedAtMs),
        endpoint: restEndpoint,
        error_message: restSnippet,
        error_name: "ApiKeyRejected",
        host_reachable: true,
        http_status: restResponse.status,
        notes,
        project_accessible: false,
        state: "Clé refusée",
        tested_at: testedAt
      };
    }

    if (looksLikeSupabaseAuthError(authResponse.status, authSnippet)) {
      return {
        category: "supabase_auth",
        duration_ms: getDurationMs(startedAtMs),
        endpoint: authEndpoint,
        error_message: authSnippet,
        error_name: "SupabaseAuthError",
        host_reachable: true,
        http_status: authResponse.status,
        notes: [
          ...notes,
          `Probe REST HTTP ${restResponse.status}`
        ],
        project_accessible: authResponse.ok || restResponse.ok,
        state: "Erreur Supabase Auth",
        tested_at: testedAt
      };
    }

    if (authResponse.ok && restResponse.ok) {
      return {
        category: "http",
        duration_ms: getDurationMs(startedAtMs),
        endpoint: restEndpoint,
        error_message: null,
        error_name: null,
        host_reachable: true,
        http_status: restResponse.status,
        notes,
        project_accessible: true,
        state: "Projet accessible",
        tested_at: testedAt
      };
    }

    if (authResponse.ok) {
      return {
        category: "http",
        duration_ms: getDurationMs(startedAtMs),
        endpoint: restEndpoint,
        error_message: restSnippet,
        error_name: null,
        host_reachable: true,
        http_status: restResponse.status,
        notes,
        project_accessible: true,
        state: "Projet accessible (réponse HTTP valide)",
        tested_at: testedAt
      };
    }

    return {
      category: "http",
      duration_ms: getDurationMs(startedAtMs),
      endpoint: authEndpoint,
      error_message: authSnippet,
      error_name: null,
      host_reachable: true,
      http_status: authResponse.status,
      notes: [
        ...notes,
        `Probe REST HTTP ${restResponse.status}`
      ],
      project_accessible: restResponse.ok,
      state: "Réponse HTTP valide",
      tested_at: testedAt
    };
  } catch (error) {
    const classification = classifyConnectivityFailure(error, true);

    return {
      category: classification.category,
      duration_ms: getDurationMs(startedAtMs),
      endpoint: restEndpoint,
      error_message: getErrorMessage(error),
      error_name: getErrorName(error),
      host_reachable: true,
      http_status: null,
      notes: [],
      project_accessible: false,
      state: classification.state,
      tested_at: testedAt
    };
  }
}

export async function resetMtJefApplicationCache() {
  if (typeof window === "undefined") {
    return;
  }

  const appScope = new URL(import.meta.env.BASE_URL, window.location.origin).toString();

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();

    await Promise.all(
      registrations
        .filter((registration) => registration.scope.startsWith(appScope))
        .map((registration) => registration.unregister())
    );
  }

  if ("caches" in window) {
    const cacheKeys = await caches.keys();

    await Promise.all(
      cacheKeys
        .filter((cacheKey) => cacheKey.startsWith("mt-jef-shell"))
        .map((cacheKey) => caches.delete(cacheKey))
    );
  }

  window.location.reload();
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(normalizedSupabaseUrl.trimmedValue as string, supabaseAnonKey.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      },
      global: {
        fetch: createSupabaseFetchLogger(normalizedSupabaseUrl.host)
      }
    })
  : null;
