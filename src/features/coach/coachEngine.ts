import type {
  AssistantHistoryItem,
  BudgetStatusRow,
  CoachHistoryEntry,
  CoachInsightReport,
  CoachObjective,
  CoachRequestPayload,
  CoachSignal,
  CoachSignalCode,
  CoachStructuredResponse,
  DailyIntentionRow,
  DailyReviewRow,
  FinanceRow,
  PrayerLogRow,
  ProjectRow,
  TaskRow
} from "../../lib/types";
import { resolveTimeZone, todayDate, toNumber } from "../../lib/utils";

interface BuildCoachInsightsInput {
  intention: DailyIntentionRow | null;
  tasks: TaskRow[];
  projects: ProjectRow[];
  prayers: PrayerLogRow[];
  finances: FinanceRow[];
  budgets: BudgetStatusRow[];
  reviews: DailyReviewRow[];
  timezone: string;
}

function dateKeyFromIso(value: string | null | undefined, timeZone: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function addSignal(list: CoachSignal[], signal: CoachSignal | null) {
  if (signal) {
    list.push(signal);
  }
}

function aggregateCurrency(rows: FinanceRow[], predicate: (row: FinanceRow) => boolean) {
  const totals = new Map<string, number>();

  for (const row of rows) {
    if (!predicate(row)) {
      continue;
    }

    const currency = row.currency || "EUR";
    totals.set(currency, (totals.get(currency) ?? 0) + toNumber(row.amount));
  }

  return [...totals.entries()].map(([currency, amount]) => ({
    currency,
    amount: Number(amount.toFixed(2))
  }));
}

function obstacleLabel(code: CoachSignalCode) {
  switch (code) {
    case "repeated_postponement":
      return "reports répétés";
    case "no_next_action":
      return "manque de clarté";
    case "overload":
      return "surcharge";
    case "financial_pressure":
      return "pression financière";
    case "fatigue":
      return "fatigue";
    case "irregularity":
      return "manque de régularité";
    case "stalled_goal":
      return "objectif bloqué";
    case "lack_of_clarity":
      return "objectif trop flou";
    default:
      return "données insuffisantes";
  }
}

function priorityScore(signal: CoachSignal) {
  const severityWeight = signal.severity === "alert" ? 3 : signal.severity === "warning" ? 2 : 1;

  return severityWeight;
}

function historyLimit(value: string[]) {
  return value.filter(Boolean).slice(0, 3);
}

export function buildCoachInsights({
  intention,
  tasks,
  projects,
  prayers,
  finances,
  budgets,
  reviews,
  timezone
}: BuildCoachInsightsInput): CoachInsightReport {
  const timeZone = resolveTimeZone(timezone);
  const today = todayDate(timeZone);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const weekBoundary = dateKeyFromIso(sevenDaysAgo.toISOString(), timeZone) ?? today;

  const todayReview = reviews.find((review) => review.review_date === today) ?? null;
  const todayPrayers = prayers.filter((entry) => entry.prayer_date === today);
  const completedPrayers = todayPrayers.filter(
    (entry) => entry.status === "completed" || entry.status === "late"
  ).length;
  const prayerCompletionRate = todayPrayers.length === 0 ? null : Math.round((completedPrayers / 5) * 100);

  const plannedTasks = tasks.filter((task) => {
    const scheduledDate = dateKeyFromIso(task.scheduled_at, timeZone);
    return (
      task.status !== "completed" &&
      (task.due_date === today || scheduledDate === today)
    );
  });

  const completedToday = tasks.filter((task) => {
    if (!task.completed_at) {
      return false;
    }

    return dateKeyFromIso(task.completed_at, timeZone) === today;
  });

  const overdueTasks = tasks.filter(
    (task) => task.status !== "completed" && task.due_date != null && task.due_date < today
  );

  const activeProjects = projects.filter((project) =>
    ["idea", "preparation", "active", "blocked", "paused"].includes(project.status)
  );

  const repeatedTask = [...tasks]
    .filter((task) => task.status !== "completed" && task.postponed_count >= 2)
    .sort((left, right) => right.postponed_count - left.postponed_count)[0];

  const blockedProject = projects.find((project) => project.status === "blocked") ?? null;
  const missingNextActionProject =
    projects.find(
      (project) =>
        (project.status === "active" || project.status === "preparation") &&
        (!project.first_action_defined || !project.first_action_title?.trim())
    ) ?? null;

  const stalledTask =
    overdueTasks
      .sort((left, right) => {
        if (!left.due_date || !right.due_date) {
          return 0;
        }

        return left.due_date.localeCompare(right.due_date);
      })[0] ?? null;

  const warningSignals: CoachSignal[] = [];

  addSignal(
    warningSignals,
    repeatedTask
      ? {
          code: "repeated_postponement",
          severity: "alert",
          title: "Une tâche revient sans avancer",
          evidence: `« ${repeatedTask.title} » a déjà été reportée ${repeatedTask.postponed_count} fois.`,
          question:
            "La tâche était-elle trop grande, trop floue ou mal placée dans la journée ?",
          objective: {
            type: "task",
            title: repeatedTask.title,
            status: repeatedTask.status,
            deadline: repeatedTask.due_date,
            next_action_title: null
          }
        }
      : null
  );

  addSignal(
    warningSignals,
    blockedProject
      ? {
          code: "stalled_goal",
          severity: "alert",
          title: "Un objectif reste bloqué",
          evidence: `Le projet « ${blockedProject.title} » est encore en statut ${blockedProject.status}.`,
          question: "Qu'est-ce qui t'a empêché d'avancer concrètement sur cet objectif ?",
          objective: {
            type: "project",
            title: blockedProject.title,
            status: blockedProject.status,
            deadline: blockedProject.target_date,
            next_action_title: blockedProject.first_action_title
          }
        }
      : stalledTask
        ? {
            code: "stalled_goal",
            severity: "warning",
            title: "Une tâche importante est en retard",
            evidence: `« ${stalledTask.title} » a dépassé son échéance du ${stalledTask.due_date}.`,
            question: "Manquais-tu de temps, d'énergie, d'argent ou de motivation pour cette tâche ?",
            objective: {
              type: "task",
              title: stalledTask.title,
              status: stalledTask.status,
              deadline: stalledTask.due_date,
              next_action_title: null
            }
          }
        : null
  );

  addSignal(
    warningSignals,
    missingNextActionProject
      ? {
          code: "no_next_action",
          severity: "warning",
          title: "Un projet n'a pas de prochaine action claire",
          evidence: `Le projet « ${missingNextActionProject.title} » n'a pas encore de première action exploitable.`,
          question: "Quelle serait la plus petite action possible demain pour débloquer ce projet ?",
          objective: {
            type: "project",
            title: missingNextActionProject.title,
            status: missingNextActionProject.status,
            deadline: missingNextActionProject.target_date,
            next_action_title: missingNextActionProject.first_action_title
          }
        }
      : null
  );

  addSignal(
    warningSignals,
    plannedTasks.length >= 5 || (plannedTasks.length >= 4 && completedToday.length === 0)
      ? {
          code: "overload",
          severity: "warning",
          title: "La journée semble surchargée",
          evidence: `${plannedTasks.length} tâches sont prévues aujourd'hui, pour ${completedToday.length} terminée(s).`,
          question: "La journée était-elle trop chargée ou les tâches trop lourdes pour ton énergie du moment ?",
          objective: {
            type: "day",
            title: intention?.intention ?? "Organisation de la journée",
            status: null,
            deadline: today,
            next_action_title: null
          }
        }
      : null
  );

  const pressuredBudget = budgets.find(
    (budget) =>
      toNumber(budget.remaining_amount) < 0 ||
      toNumber(budget.consumption_percentage ?? 0) > 100
  );

  addSignal(
    warningSignals,
    pressuredBudget
      ? {
          code: "financial_pressure",
          severity: "warning",
          title: "Un blocage financier est probable",
          evidence: `Un budget affiche ${toNumber(pressuredBudget.consumption_percentage ?? 0).toFixed(0)} % de consommation.`,
          question: "Le manque d'argent ou d'arbitrage financier a-t-il freiné tes actions aujourd'hui ?",
          objective: {
            type: "day",
            title: "Gestion financière",
            status: null,
            deadline: pressuredBudget.period_end,
            next_action_title: null
          }
        }
      : null
  );

  addSignal(
    warningSignals,
    (todayReview?.energy != null && todayReview.energy <= 2) ||
    (todayReview?.mood != null && todayReview.mood <= 2)
      ? {
          code: "fatigue",
          severity: "warning",
          title: "L'énergie du jour est basse",
          evidence: `Humeur ${todayReview?.mood ?? "—"} / 5 et énergie ${todayReview?.energy ?? "—"} / 5.`,
          question: "Devais-tu surtout alléger la difficulté ou déplacer l'effort à un meilleur moment ?",
          objective: {
            type: "day",
            title: "Énergie et récupération",
            status: null,
            deadline: today,
            next_action_title: null
          }
        }
      : null
  );

  const recentPrayers = prayers.filter((entry) => entry.prayer_date >= weekBoundary);
  const recentCompletedPrayers = recentPrayers.filter(
    (entry) => entry.status === "completed" || entry.status === "late"
  ).length;
  const weeklyPrayerRate =
    recentPrayers.length === 0 ? null : Math.round((recentCompletedPrayers / recentPrayers.length) * 100);

  addSignal(
    warningSignals,
    weeklyPrayerRate != null && weeklyPrayerRate < 60
      ? {
          code: "irregularity",
          severity: "info",
          title: "La régularité est encore fragile",
          evidence: `Le suivi des prières tourne autour de ${weeklyPrayerRate} % sur les sept derniers jours.`,
          question: "Quelle routine simple veux-tu protéger en premier demain pour retrouver de la régularité ?",
          objective: {
            type: "day",
            title: "Routine quotidienne",
            status: null,
            deadline: today,
            next_action_title: null
          }
        }
      : null
  );

  addSignal(
    warningSignals,
    intention?.intention && plannedTasks.length === 0
      ? {
          code: "lack_of_clarity",
          severity: "info",
          title: "L'intention du jour n'est pas reliée à une action",
          evidence: `L'intention « ${intention.intention} » n'est reliée à aucune tâche planifiée aujourd'hui.`,
          question: "Quelle action de moins de 15 minutes incarne vraiment cette intention demain ?",
          objective: {
            type: "day",
            title: intention.intention,
            status: null,
            deadline: today,
            next_action_title: null
          }
        }
      : null
  );

  const warnings: string[] = [];

  if (reviews.length === 0) {
    warnings.push("review_missing");
  }

  if (prayers.length === 0) {
    warnings.push("prayer_history_missing");
  }

  if (tasks.length === 0 && projects.length === 0 && !intention) {
    warnings.push("planning_data_missing");
  }

  if (warningSignals.length === 0) {
    warningSignals.push({
      code: "missing_data",
      severity: "info",
      title: "Le coach manque encore de contexte",
      evidence: "Il n'y a pas assez d'indices fiables pour conclure à un blocage précis.",
      question: "Qu'est-ce qui t'a le plus freiné aujourd'hui, si tu devais choisir une seule chose ?",
      objective: intention?.intention
        ? {
            type: "day",
            title: intention.intention,
            status: null,
            deadline: today,
            next_action_title: null
          }
        : null
    });
  }

  const sortedSignals = [...warningSignals].sort((left, right) => priorityScore(right) - priorityScore(left));
  const primarySignal = sortedSignals[0] ?? null;

  const completedWeeklyTasks = historyLimit(
    tasks
      .filter((task) => task.completed_at && (dateKeyFromIso(task.completed_at, timeZone) ?? "") >= weekBoundary)
      .map((task) => task.title)
  );

  const blockedObjectives = historyLimit(
    sortedSignals
      .map((signal) => signal.objective?.title ?? "")
      .filter(Boolean)
  );

  const prayerCounts = new Map<PrayerLogRow["prayer_name"], number>();
  for (const row of recentPrayers) {
    if (row.status !== "completed" && row.status !== "late") {
      continue;
    }

    prayerCounts.set(row.prayer_name, (prayerCounts.get(row.prayer_name) ?? 0) + 1);
  }

  const regularHabits = historyLimit(
    [...prayerCounts.entries()]
      .filter(([, count]) => count >= 4)
      .sort((left, right) => right[1] - left[1])
      .map(([prayerName, count]) => `${prayerName} suivi ${count}/7`)
  );

  const priorities = historyLimit([
    primarySignal?.objective?.title ?? "",
    plannedTasks[0]?.title ?? "",
    activeProjects[0]?.title ?? ""
  ]);

  const consistencyComponents = [
    completedToday.length > 0 ? 1 : 0,
    todayReview ? 1 : 0,
    prayerCompletionRate != null && prayerCompletionRate >= 60 ? 1 : 0
  ];
  const consistencyScore = Math.round(
    (consistencyComponents.reduce((sum, value) => sum + value, 0) / consistencyComponents.length) * 100
  );

  return {
    generated_at: new Date().toISOString(),
    objective: primarySignal?.objective ?? null,
    primary_signal: primarySignal,
    signals: sortedSignals,
    daily_snapshot: {
      intention: intention?.intention ?? null,
      planned_task_count: plannedTasks.length,
      completed_task_count: completedToday.length,
      overdue_task_count: overdueTasks.length,
      active_project_count: activeProjects.length,
      prayer_completion_rate: prayerCompletionRate,
      planned_expenses: aggregateCurrency(
        finances,
        (row) =>
          row.transaction_type === "expense" &&
          (row.status === "planned" || row.status === "committed") &&
          row.transaction_date === today
      ),
      actual_expenses: aggregateCurrency(
        finances,
        (row) =>
          row.transaction_type === "expense" &&
          row.status === "paid" &&
          row.transaction_date === today
      ),
      mood: todayReview?.mood ?? null,
      energy: todayReview?.energy ?? null,
      review_completed: Boolean(todayReview),
      blockers_logged: Boolean(todayReview?.note?.trim() || todayReview?.tomorrow_correction?.trim())
    },
    weekly_snapshot: {
      advanced_objectives: completedWeeklyTasks,
      blocked_objectives: blockedObjectives,
      regular_habits: regularHabits,
      main_obstacles: historyLimit(sortedSignals.map((signal) => obstacleLabel(signal.code))),
      recommended_priorities: priorities,
      consistency_score: consistencyScore
    },
    warnings
  };
}

export function buildCoachRequestPayload(args: {
  message: string;
  timezone: string;
  firstName?: string | null;
  history: AssistantHistoryItem[];
  report: CoachInsightReport;
}): CoachRequestPayload {
  return {
    mode: "coach",
    message: args.message.trim(),
    history: args.history.slice(-6),
    timezone: args.timezone,
    firstName: args.firstName?.trim() || null,
    coachContext: {
      generated_at: args.report.generated_at,
      objective: args.report.objective,
      primary_signal: args.report.primary_signal,
      signals: args.report.signals.slice(0, 4),
      daily_snapshot: args.report.daily_snapshot,
      weekly_snapshot: {
        ...args.report.weekly_snapshot,
        advanced_objectives: args.report.weekly_snapshot.advanced_objectives.slice(0, 3),
        blocked_objectives: args.report.weekly_snapshot.blocked_objectives.slice(0, 3),
        regular_habits: args.report.weekly_snapshot.regular_habits.slice(0, 3),
        main_obstacles: args.report.weekly_snapshot.main_obstacles.slice(0, 3),
        recommended_priorities: args.report.weekly_snapshot.recommended_priorities.slice(0, 3)
      },
      warnings: args.report.warnings
    }
  };
}

export function buildCoachAssistantMessage(recommendation: CoachStructuredResponse) {
  return [
    recommendation.summary,
    `Pourquoi ça n'a pas avancé : ${recommendation.likely_blocker}`,
    `Stratégie : ${recommendation.strategy}`,
    `Ce que je fais maintenant : ${recommendation.next_action.title} · ${recommendation.next_action.duration_minutes} min · ${recommendation.next_action.suggested_time}`,
    recommendation.question ? `Question suivante : ${recommendation.question}` : null
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildCoachHistoryEntry(args: {
  recommendation: CoachStructuredResponse;
  report: CoachInsightReport;
  userResponse: string;
}): CoachHistoryEntry {
  return {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    source_signal_code: args.report.primary_signal?.code ?? null,
    objective_title: args.report.objective?.title ?? null,
    user_response: args.userResponse.trim() || null,
    ...args.recommendation
  };
}
