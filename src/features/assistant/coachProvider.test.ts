import { describe, expect, it } from "vitest";
import {
  buildCoachPrompt,
  extractCoachReply,
  normalizeCoachContext
} from "../../../supabase/functions/mt-jef-assistant/coach";

describe("coach provider helpers", () => {
  it("normalise un contexte coach minimal et borne les listes", () => {
    const context = normalizeCoachContext({
      generated_at: "2026-07-14T10:00:00.000Z",
      objective: {
        type: "task",
        title: "Préparer le dossier VAE",
        status: "todo",
        deadline: "2026-07-15"
      },
      primary_signal: {
        code: "repeated_postponement",
        severity: "alert",
        title: "Une tâche revient sans avancer",
        evidence: "Reportée 3 fois.",
        question: "La tâche était-elle trop grande ?",
        objective: {
          type: "task",
          title: "Préparer le dossier VAE",
          status: "todo",
          deadline: "2026-07-15"
        }
      },
      signals: [
        {
          code: "repeated_postponement",
          severity: "alert",
          title: "Une tâche revient sans avancer",
          evidence: "Reportée 3 fois.",
          question: "La tâche était-elle trop grande ?",
          objective: {
            type: "task",
            title: "Préparer le dossier VAE",
            status: "todo",
            deadline: "2026-07-15"
          }
        }
      ],
      daily_snapshot: {
        intention: "Avancer sur la VAE",
        planned_task_count: 3,
        completed_task_count: 0,
        overdue_task_count: 1,
        active_project_count: 2,
        prayer_completion_rate: 60,
        planned_expenses: [{ currency: "EUR", amount: 25 }],
        actual_expenses: [],
        mood: 3,
        energy: 2,
        review_completed: true,
        blockers_logged: true
      },
      weekly_snapshot: {
        advanced_objectives: ["Envoyer un mail"],
        blocked_objectives: ["Préparer le dossier VAE"],
        regular_habits: ["fajr suivi 5/7"],
        main_obstacles: ["reports répétés"],
        recommended_priorities: ["Préparer le dossier VAE"],
        consistency_score: 66
      },
      warnings: ["review_missing"]
    });

    expect(context?.objective?.title).toBe("Préparer le dossier VAE");
    expect(context?.signals).toHaveLength(1);
    expect(context?.daily_snapshot.planned_task_count).toBe(3);
  });

  it("construit un prompt coach strictement orienté JSON", () => {
    const context = normalizeCoachContext({
      generated_at: "2026-07-14T10:00:00.000Z",
      objective: null,
      primary_signal: null,
      signals: [],
      daily_snapshot: {
        intention: null,
        planned_task_count: 0,
        completed_task_count: 0,
        overdue_task_count: 0,
        active_project_count: 0,
        prayer_completion_rate: null,
        planned_expenses: [],
        actual_expenses: [],
        mood: null,
        energy: null,
        review_completed: false,
        blockers_logged: false
      },
      weekly_snapshot: {
        advanced_objectives: [],
        blocked_objectives: [],
        regular_habits: [],
        main_obstacles: [],
        recommended_priorities: [],
        consistency_score: 0
      },
      warnings: []
    });

    const prompt = buildCoachPrompt({
      message: "Je n'ai pas avancé aujourd'hui.",
      history: [],
      context: context!,
      firstName: "Moussa",
      timezone: "Europe/Paris"
    });

    expect(prompt).toContain("Réponds uniquement en JSON valide");
    expect(prompt).toContain("\"next_action\"");
  });

  it("extrait une réponse Gemini structurée et concrète", () => {
    const reply = extractCoachReply(`
      \`\`\`json
      {
        "summary": "Tu as voulu trop faire d'un coup.",
        "question": "Peux-tu confirmer si la tâche était trop large ?",
        "likely_blocker": "Le blocage semble venir d'une tâche trop large, à confirmer avec toi.",
        "strategy": "Découpe l'action en une première étape visible et fais-la tôt.",
        "next_action": {
          "title": "Ouvrir le dossier et lister 3 pièces manquantes",
          "duration_minutes": 15,
          "suggested_time": "10:00",
          "difficulty": "low",
          "best_moment": "début de matinée",
          "reminder_hint": "rappel 10 minutes avant"
        }
      }
      \`\`\`
    `);

    expect(reply.strategy).toContain("Découpe");
    expect(reply.next_action.duration_minutes).toBe(15);
    expect(reply.next_action.suggested_time).toBe("10:00");
  });

  it("rejette une réponse structurée incomplète", () => {
    expect(() =>
      extractCoachReply(
        JSON.stringify({
          summary: "Résumé",
          question: "Question",
          likely_blocker: "Blocage",
          strategy: "Stratégie"
        })
      )
    ).toThrow("COACH_INVALID_RESPONSE");
  });
});
