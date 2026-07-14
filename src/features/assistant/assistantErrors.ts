import { messageFromError } from "../../lib/utils";

const GEMINI_ERROR_MESSAGES: Record<string, string> = {
  gemini_missing_api_key: "La clé Gemini n'est pas configurée côté serveur.",
  gemini_missing_model: "Le modèle Gemini n'est pas configuré côté serveur.",
  gemini_invalid_key: "La clé Gemini configurée est invalide.",
  gemini_model_unavailable: "Le modèle Gemini configuré n'est pas disponible.",
  gemini_quota_exceeded: "Le quota Gemini est temporairement atteint.",
  gemini_access_denied: "L'accès au service Gemini est refusé pour cette configuration.",
  gemini_bad_request: "La requête envoyée à Gemini a été refusée.",
  gemini_upstream_error: "Le service Gemini rencontre une erreur temporaire.",
  gemini_network_error: "Le service Gemini est actuellement inaccessible depuis la fonction.",
  gemini_invalid_json: "La réponse Gemini est invalide.",
  gemini_blocked: "La réponse Gemini a été bloquée par les filtres de sécurité.",
  gemini_request_failed: "La réponse Gemini n'a pas pu être traitée correctement.",
  coach_invalid_response: "La réponse structurée du coach est invalide.",
  COACH_CONTEXT_REQUIRED: "Le contexte minimal du coach est invalide ou incomplet."
};

interface AssistantErrorBody {
  error?: unknown;
  message?: unknown;
}

function isResponseLike(value: unknown): value is Response {
  return Boolean(
    value &&
      typeof value === "object" &&
      "text" in value &&
      typeof value.text === "function"
  );
}

export async function resolveAssistantErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "context" in error && isResponseLike(error.context)) {
    try {
      const response = error.context.clone();
      const rawBody = await response.text();

      if (rawBody) {
        try {
          const parsed = JSON.parse(rawBody) as AssistantErrorBody;
          const parsedMessage =
            typeof parsed.message === "string"
              ? parsed.message
              : typeof parsed.error === "string"
                ? GEMINI_ERROR_MESSAGES[parsed.error] ?? parsed.error
                : null;

          if (parsedMessage) {
            return parsedMessage;
          }
        } catch {
          return rawBody;
        }
      }
    } catch {
      return messageFromError(error);
    }
  }

  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") {
    return GEMINI_ERROR_MESSAGES[error.error] ?? messageFromError(error);
  }

  return messageFromError(error);
}
