import { describe, expect, it } from "vitest";
import type {
  DailyIntentionRow,
  DailyReviewRow,
  FinanceRow,
  PrayerLogRow,
  ProjectRow,
  TaskRow
} from "../../lib/types";
import {
  buildCoachInsights,
  buildCoachRequestPayload
} from "./coachEngine";

function buildTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: "task-1",
    user_id: "user-1",
    project_id: null,
    title: "Préparer le dossier",
    description: null,
    domain: null,
    urgency: 3,
    importance: 4,
    spiritual_impact: 0,
    family_impact: 0,
    financial_impact: 0,
    administrative_impact: 0,
    effort: 3,
    duration_minutes: 30,
    priority_score: 10,
    due_date: "2026-07-14",
    scheduled_at: "2026-07-14T08:30:00.000Z",
    status: "todo",
    proof_required: false,
    proof_url: null,
    postponed_count: 0,
    completed_at: null,
    created_at: "2026-07-13T10:00:00.000Z",
    updated_at: "2026-07-14T07:00:00.000Z",
    ...overrides
  };
}

function buildProject(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: "project-1",
    user_id: "user-1",
    title: "Maison Sénégal retraite",
    intention: null,
    objective: null,
    expected_result: null,
    category: null,
    priority: 3,
    status: "active",
    start_date: null,
    target_date: "2026-08-01",
    estimated_budget: 0,
    actual_budget: 0,
    available_funding: 0,
    currency: "EUR",
    progress: 0,
    first_action_title: null,
    first_action_defined: false,
    cost_estimation_status: "unknown_to_estimate",
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-14T07:00:00.000Z",
    ...overrides
  };
}

function buildPrayer(overrides: Partial<PrayerLogRow> = {}): PrayerLogRow {
  return {
    id: "prayer-1",
    user_id: "user-1",
    prayer_name: "fajr",
    prayer_date: "2026-07-14",
    status: "completed",
    note: null,
    created_at: "2026-07-14T05:00:00.000Z",
    updated_at: "2026-07-14T05:00:00.000Z",
    ...overrides
  };
}

function buildReview(overrides: Partial<DailyReviewRow> = {}): DailyReviewRow {
  return {
    id: "review-1",
    user_id: "user-1",
    review_date: "2026-07-14",
    prayer_completed: true,
    priority_completed: false,
    family_present: true,
    money_managed: false,
    health_action: false,
    learning_action: false,
    mood: 3,
    energy: 3,
    note: null,
    tomorrow_correction: null,
    created_at: "2026-07-14T21:00:00.000Z",
    updated_at: "2026-07-14T21:00:00.000Z",
    ...overrides
  };
}

function buildFinance(overrides: Partial<FinanceRow> = {}): FinanceRow {
  return {
    id: "finance-1",
    user_id: "user-1",
    project_id: null,
    category_id: "cat-1",
    transaction_type: "expense",
    amount: 25,
    currency: "EUR",
    transaction_date: "2026-07-14",
    status: "planned",
    is_mandatory: false,
    is_reserved: false,
    description: null,
    receipt_url: null,
    created_at: "2026-07-14T08:00:00.000Z",
    updated_at: "2026-07-14T08:00:00.000Z",
    ...overrides
  };
}

const intention: DailyIntentionRow = {
  id: "intent-1",
  user_id: "user-1",
  intention_date: "2026-07-14",
  intention: "Avancer sur la VAE",
  created_at: "2026-07-14T06:00:00.000Z",
  updated_at: "2026-07-14T06:00:00.000Z"
};

describe("coachEngine", () => {
  it("détecte un objectif non avancé sans inventer la cause", () => {
    const report = buildCoachInsights({
      intention,
      tasks: [buildTask({ due_date: "2026-07-13" })],
      projects: [buildProject({ status: "blocked", first_action_defined: true, first_action_title: "Appeler le centre" })],
      prayers: [buildPrayer()],
      finances: [],
      budgets: [],
      reviews: [buildReview()],
      timezone: "Europe/Paris"
    });

    expect(report.primary_signal?.code).toBe("stalled_goal");
    expect(report.primary_signal?.objective?.title).toBe("Maison Sénégal retraite");
    expect(report.primary_signal?.question).toContain("empêché");
    expect(report.primary_signal?.evidence).not.toContain("parce que");
  });

  it("priorise une tâche reportée plusieurs fois", () => {
    const report = buildCoachInsights({
      intention,
      tasks: [
        buildTask({
          title: "Envoyer le dossier VAE",
          postponed_count: 3,
          due_date: "2026-07-14"
        })
      ],
      projects: [buildProject()],
      prayers: [buildPrayer()],
      finances: [],
      budgets: [],
      reviews: [buildReview()],
      timezone: "Europe/Paris"
    });

    expect(report.primary_signal?.code).toBe("repeated_postponement");
    expect(report.primary_signal?.evidence).toContain("3 fois");
  });

  it("retombe sur une question de clarification quand les données manquent", () => {
    const report = buildCoachInsights({
      intention: null,
      tasks: [],
      projects: [],
      prayers: [],
      finances: [],
      budgets: [],
      reviews: [],
      timezone: "Europe/Paris"
    });

    expect(report.primary_signal?.code).toBe("missing_data");
    expect(report.primary_signal?.question).toContain("freiné");
    expect(report.warnings).toContain("planning_data_missing");
  });

  it("repère la fatigue quand l'énergie est basse", () => {
    const report = buildCoachInsights({
      intention,
      tasks: [buildTask()],
      projects: [buildProject({ first_action_defined: true, first_action_title: "Ouvrir le plan" })],
      prayers: [buildPrayer()],
      finances: [],
      budgets: [],
      reviews: [buildReview({ mood: 2, energy: 1 })],
      timezone: "Europe/Paris"
    });

    expect(report.signals.some((signal) => signal.code === "fatigue")).toBe(true);
  });

  it("construit un payload minimal sans fuite des notes ni des user_id", () => {
    const report = buildCoachInsights({
      intention,
      tasks: [buildTask({ user_id: "user-secret" })],
      projects: [buildProject({ user_id: "user-secret" })],
      prayers: [buildPrayer({ user_id: "user-secret" })],
      finances: [buildFinance({ description: "depense confidentielle" })],
      budgets: [],
      reviews: [buildReview({ note: "blocage confidentiel à ne pas envoyer" })],
      timezone: "Europe/Paris"
    });

    const payload = buildCoachRequestPayload({
      message: "Je n'ai pas avancé aujourd'hui.",
      timezone: "Europe/Paris",
      firstName: "Moussa",
      history: [],
      report
    });
    const serialized = JSON.stringify(payload);

    expect(serialized).not.toContain("user-secret");
    expect(serialized).not.toContain("blocage confidentiel");
    expect(serialized).not.toContain("depense confidentielle");
    expect(payload.coachContext.signals.length).toBeLessThanOrEqual(4);
  });
});
