import { describe, expect, it } from "vitest";
import { resolveAssistantErrorMessage } from "./assistantErrors";

describe("resolveAssistantErrorMessage", () => {
  it("retourne le message métier de la fonction Edge", async () => {
    const response = new Response(
      JSON.stringify({
        error: "gemini_quota_exceeded",
        message: "Le quota Gemini est temporairement atteint."
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    await expect(
      resolveAssistantErrorMessage({
        message: "Edge Function returned a non-2xx status code",
        context: response
      })
    ).resolves.toBe("Le quota Gemini est temporairement atteint.");
  });

  it("mappe un code Gemini connu même sans message explicite", async () => {
    const response = new Response(
      JSON.stringify({
        error: "gemini_blocked"
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    await expect(
      resolveAssistantErrorMessage({
        message: "Edge Function returned a non-2xx status code",
        context: response
      })
    ).resolves.toBe("La réponse Gemini a été bloquée par les filtres de sécurité.");
  });

  it("retombe sur le message réseau générique si aucun body exploitable n'est disponible", async () => {
    await expect(
      resolveAssistantErrorMessage({
        message: "fetch failed",
        status: 0
      })
    ).resolves.toBe(
      "Connexion reseau impossible vers Supabase. Verifie la connexion, l'URL du projet et les autorisations reseau."
    );
  });
});
