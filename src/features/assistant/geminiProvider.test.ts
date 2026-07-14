import { describe, expect, it } from "vitest";
import {
  buildGeminiRequest,
  extractGeminiReply,
  normalizeGeminiFailure
} from "../../../supabase/functions/mt-jef-assistant/gemini";

describe("gemini provider helpers", () => {
  it("construit une requête Gemini compatible", () => {
    const payload = buildGeminiRequest({
      systemInstruction: "Instructions système",
      prompt: "Bonjour",
      temperature: 0.4,
      maxOutputTokens: 1200
    });

    expect(payload).toEqual({
      system_instruction: {
        parts: [{ text: "Instructions système" }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: "Bonjour" }]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1200
      }
    });
  });

  it("extrait une réponse Gemini réussie", () => {
    expect(
      extractGeminiReply({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [{ text: "Première partie" }, { text: "Deuxième partie" }]
            }
          }
        ]
      })
    ).toEqual({
      status: "success",
      reply: "Première partie\n\nDeuxième partie",
      blockReason: null,
      finishReason: "STOP"
    });
  });

  it("détecte une réponse bloquée", () => {
    expect(
      extractGeminiReply({
        promptFeedback: {
          blockReason: "SAFETY"
        }
      })
    ).toEqual({
      status: "blocked",
      reply: "",
      blockReason: "SAFETY",
      finishReason: null
    });
  });

  it("détecte une réponse vide", () => {
    expect(
      extractGeminiReply({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [{ text: "   " }]
            }
          }
        ]
      })
    ).toEqual({
      status: "empty",
      reply: "",
      blockReason: null,
      finishReason: "STOP"
    });
  });

  it("normalise un quota Gemini atteint", () => {
    const failure = normalizeGeminiFailure(
      429,
      JSON.stringify({
        error: {
          code: 429,
          status: "RESOURCE_EXHAUSTED",
          message: "Quota exceeded"
        }
      })
    );

    expect(failure.error).toBe("gemini_quota_exceeded");
    expect(failure.message).toBe("Le quota Gemini est temporairement atteint.");
  });

  it("normalise une clé Gemini invalide sans fuite de secret", () => {
    const failure = normalizeGeminiFailure(
      401,
      JSON.stringify({
        error: {
          code: 401,
          status: "UNAUTHENTICATED",
          message: "API key not valid: sk-test-123456"
        }
      })
    );

    expect(failure.error).toBe("gemini_invalid_key");
    expect(failure.message).toBe("La clé Gemini configurée est invalide.");
    expect(failure.message).not.toContain("sk-test-123456");
  });

  it("normalise un modèle Gemini indisponible", () => {
    const failure = normalizeGeminiFailure(
      404,
      JSON.stringify({
        error: {
          code: 404,
          status: "NOT_FOUND",
          message: "Model not found"
        }
      })
    );

    expect(failure.error).toBe("gemini_model_unavailable");
    expect(failure.message).toBe("Le modèle Gemini configuré n'est pas disponible.");
  });
});
