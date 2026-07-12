import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const runtimeMode = import.meta.env.MODE;

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
      kind: "missing",
      length: 0
    };
  }

  if (trimmedValue.startsWith("sb_publishable_")) {
    return {
      kind: "publishable",
      length: trimmedValue.length
    };
  }

  if (trimmedValue.startsWith("eyJ")) {
    return {
      kind: "jwt",
      length: trimmedValue.length
    };
  }

  return {
    kind: "unknown",
    length: trimmedValue.length
  };
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
