export interface GeminiRequestPayload {
  system_instruction: {
    parts: Array<{
      text: string;
    }>;
  };
  contents: Array<{
    role: "user";
    parts: Array<{
      text: string;
    }>;
  }>;
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
    responseMimeType?: string;
  };
}

export interface GeminiProviderError {
  providerMessage: string;
  providerCode: number | string | null;
  providerStatus: string | null;
  providerDetails: unknown;
}

export interface GeminiFailure {
  error: string;
  message: string;
  provider: GeminiProviderError;
}

export interface GeminiExtractionResult {
  status: "success" | "blocked" | "empty";
  reply: string;
  blockReason: string | null;
  finishReason: string | null;
}

interface GeminiErrorBody {
  error?: {
    code?: number | string;
    message?: string;
    status?: string;
    details?: unknown;
  };
}

interface GeminiCandidatePart {
  text?: string;
}

interface GeminiCandidateContent {
  parts?: GeminiCandidatePart[];
}

interface GeminiCandidate {
  content?: GeminiCandidateContent;
  finishReason?: string;
}

interface GeminiPromptFeedback {
  blockReason?: string;
}

interface GeminiResponseBody {
  candidates?: GeminiCandidate[];
  promptFeedback?: GeminiPromptFeedback;
}

function normalizeGeminiErrorBody(rawBody: string): GeminiProviderError {
  try {
    const parsed = JSON.parse(rawBody) as GeminiErrorBody;

    return {
      providerMessage: parsed.error?.message || "GEMINI_UPSTREAM_ERROR",
      providerCode: parsed.error?.code ?? null,
      providerStatus: parsed.error?.status ?? null,
      providerDetails: parsed.error?.details ?? null
    };
  } catch {
    return {
      providerMessage: "GEMINI_UPSTREAM_ERROR",
      providerCode: null,
      providerStatus: null,
      providerDetails: null
    };
  }
}

export function buildGeminiRequest(args: {
  systemInstruction: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
}): GeminiRequestPayload {
  return {
    system_instruction: {
      parts: [{ text: args.systemInstruction }]
    },
    contents: [
      {
        role: "user",
        parts: [{ text: args.prompt }]
      }
    ],
    generationConfig: {
      temperature: args.temperature ?? 0.4,
      maxOutputTokens: args.maxOutputTokens ?? 1200,
      ...(args.responseMimeType ? { responseMimeType: args.responseMimeType } : {})
    }
  };
}

export function extractGeminiReply(payload: unknown): GeminiExtractionResult {
  if (!payload || typeof payload !== "object") {
    return {
      status: "empty",
      reply: "",
      blockReason: null,
      finishReason: null
    };
  }

  const response = payload as GeminiResponseBody;
  const promptBlockReason = response.promptFeedback?.blockReason ?? null;

  if (promptBlockReason) {
    return {
      status: "blocked",
      reply: "",
      blockReason: promptBlockReason,
      finishReason: null
    };
  }

  const firstCandidate = Array.isArray(response.candidates) ? response.candidates[0] : null;
  const finishReason = firstCandidate?.finishReason ?? null;

  if (
    finishReason &&
    ["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"].includes(finishReason)
  ) {
    return {
      status: "blocked",
      reply: "",
      blockReason: finishReason,
      finishReason
    };
  }

  const parts = Array.isArray(firstCandidate?.content?.parts)
    ? firstCandidate.content.parts
    : [];

  const reply = parts
    .map((part) => (typeof part.text === "string" ? part.text.trim() : ""))
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (!reply) {
    return {
      status: "empty",
      reply: "",
      blockReason: null,
      finishReason
    };
  }

  return {
    status: "success",
    reply,
    blockReason: null,
    finishReason
  };
}

export function normalizeGeminiFailure(status: number, rawBody: string): GeminiFailure {
  const provider = normalizeGeminiErrorBody(rawBody);
  const message = provider.providerMessage.toLowerCase();
  const providerStatus = (provider.providerStatus ?? "").toLowerCase();

  if (
    status === 401 ||
    message.includes("api key not valid") ||
    providerStatus === "unauthenticated"
  ) {
    return {
      error: "gemini_invalid_key",
      message: "La clé Gemini configurée est invalide.",
      provider
    };
  }

  if (
    status === 404 ||
    message.includes("model") && (message.includes("not found") || message.includes("not exist")) ||
    providerStatus === "not_found"
  ) {
    return {
      error: "gemini_model_unavailable",
      message: "Le modèle Gemini configuré n'est pas disponible.",
      provider
    };
  }

  if (
    status === 429 ||
    providerStatus === "resource_exhausted" ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("resource has been exhausted")
  ) {
    return {
      error: "gemini_quota_exceeded",
      message: "Le quota Gemini est temporairement atteint.",
      provider
    };
  }

  if (
    status === 403 ||
    providerStatus === "permission_denied" ||
    message.includes("permission denied") ||
    message.includes("access denied")
  ) {
    return {
      error: "gemini_access_denied",
      message: "L'accès au service Gemini est refusé pour cette configuration.",
      provider
    };
  }

  if (
    status === 400 ||
    providerStatus === "invalid_argument" ||
    message.includes("invalid argument")
  ) {
    return {
      error: "gemini_bad_request",
      message: "La requête envoyée à Gemini a été refusée.",
      provider
    };
  }

  if (status >= 500) {
    return {
      error: "gemini_upstream_error",
      message: "Le service Gemini rencontre une erreur temporaire.",
      provider
    };
  }

  return {
    error: "gemini_request_failed",
    message: "La réponse Gemini n'a pas pu être traitée correctement.",
    provider
  };
}
