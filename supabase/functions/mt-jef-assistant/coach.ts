type ChatRole = "user" | "assistant";

export interface CoachPromptHistoryItem {
  role: ChatRole;
  content: string;
}

export interface CoachObjectiveContext {
  type: "day" | "task" | "project";
  title: string;
  status: string | null;
  deadline: string | null;
  next_action_title?: string | null;
}

export interface CoachSignalContext {
  code: string;
  severity: "info" | "warning" | "alert";
  title: string;
  evidence: string;
  question: string;
  objective: CoachObjectiveContext | null;
}

export interface CoachContextPayload {
  generated_at: string;
  objective: CoachObjectiveContext | null;
  primary_signal: CoachSignalContext | null;
  signals: CoachSignalContext[];
  daily_snapshot: {
    intention: string | null;
    planned_task_count: number;
    completed_task_count: number;
    overdue_task_count: number;
    active_project_count: number;
    prayer_completion_rate: number | null;
    planned_expenses: Array<{ currency: string; amount: number }>;
    actual_expenses: Array<{ currency: string; amount: number }>;
    mood: number | null;
    energy: number | null;
    review_completed: boolean;
    blockers_logged: boolean;
  };
  weekly_snapshot: {
    advanced_objectives: string[];
    blocked_objectives: string[];
    regular_habits: string[];
    main_obstacles: string[];
    recommended_priorities: string[];
    consistency_score: number;
  };
  warnings: string[];
}

export interface CoachStructuredReply {
  summary: string;
  question: string;
  likely_blocker: string;
  strategy: string;
  next_action: {
    title: string;
    duration_minutes: number;
    suggested_time: string;
    difficulty: "low" | "medium" | "high";
    best_moment: string | null;
    reminder_hint: string | null;
  };
}

const MAX_TEXT_LENGTH = 280;

function safeText(value: unknown, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function safeNumber(value: unknown, min = 0, max = 1000) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function safeMoneyItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 4).flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const currency = safeText("currency" in item ? item.currency : null, 8);
    const amount = safeNumber("amount" in item ? item.amount : null, 0, 1_000_000);

    if (!currency || amount == null) {
      return [];
    }

    return [{ currency, amount }];
  });
}

function safeObjective(value: unknown): CoachObjectiveContext | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const type = "type" in value ? value.type : null;
  const title = safeText("title" in value ? value.title : null, 120);
  const status = safeText("status" in value ? value.status : null, 48);
  const deadline = safeText("deadline" in value ? value.deadline : null, 32);
  const nextActionTitle = safeText("next_action_title" in value ? value.next_action_title : null, 160);

  if ((type !== "day" && type !== "task" && type !== "project") || !title) {
    return null;
  }

  return {
    type,
    title,
    status,
    deadline,
    next_action_title: nextActionTitle
  };
}

function safeSignals(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 4).flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const code = safeText("code" in item ? item.code : null, 48);
    const severity = "severity" in item ? item.severity : null;
    const title = safeText("title" in item ? item.title : null, 120);
    const evidence = safeText("evidence" in item ? item.evidence : null, 220);
    const question = safeText("question" in item ? item.question : null, 220);
    const objective = safeObjective("objective" in item ? item.objective : null);

    if (
      !code ||
      (severity !== "info" && severity !== "warning" && severity !== "alert") ||
      !title ||
      !evidence ||
      !question
    ) {
      return [];
    }

    return [
      {
        code,
        severity,
        title,
        evidence,
        question,
        objective
      }
    ];
  });
}

function safeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, 4)
    .map((entry) => safeText(entry, 120))
    .filter((entry): entry is string => Boolean(entry));
}

export function normalizeCoachContext(value: unknown): CoachContextPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const daily = "daily_snapshot" in value ? value.daily_snapshot : null;
  const weekly = "weekly_snapshot" in value ? value.weekly_snapshot : null;

  if (!daily || typeof daily !== "object" || !weekly || typeof weekly !== "object") {
    return null;
  }

  return {
    generated_at: safeText("generated_at" in value ? value.generated_at : null, 40) ?? new Date().toISOString(),
    objective: safeObjective("objective" in value ? value.objective : null),
    primary_signal: safeSignals("primary_signal" in value ? [value.primary_signal] : [])[0] ?? null,
    signals: safeSignals("signals" in value ? value.signals : []),
    daily_snapshot: {
      intention: safeText("intention" in daily ? daily.intention : null, 180),
      planned_task_count: safeNumber("planned_task_count" in daily ? daily.planned_task_count : null, 0, 100) ?? 0,
      completed_task_count: safeNumber("completed_task_count" in daily ? daily.completed_task_count : null, 0, 100) ?? 0,
      overdue_task_count: safeNumber("overdue_task_count" in daily ? daily.overdue_task_count : null, 0, 100) ?? 0,
      active_project_count: safeNumber("active_project_count" in daily ? daily.active_project_count : null, 0, 100) ?? 0,
      prayer_completion_rate: safeNumber("prayer_completion_rate" in daily ? daily.prayer_completion_rate : null, 0, 100),
      planned_expenses: safeMoneyItems("planned_expenses" in daily ? daily.planned_expenses : []),
      actual_expenses: safeMoneyItems("actual_expenses" in daily ? daily.actual_expenses : []),
      mood: safeNumber("mood" in daily ? daily.mood : null, 1, 5),
      energy: safeNumber("energy" in daily ? daily.energy : null, 1, 5),
      review_completed: Boolean("review_completed" in daily ? daily.review_completed : false),
      blockers_logged: Boolean("blockers_logged" in daily ? daily.blockers_logged : false)
    },
    weekly_snapshot: {
      advanced_objectives: safeStringList("advanced_objectives" in weekly ? weekly.advanced_objectives : []),
      blocked_objectives: safeStringList("blocked_objectives" in weekly ? weekly.blocked_objectives : []),
      regular_habits: safeStringList("regular_habits" in weekly ? weekly.regular_habits : []),
      main_obstacles: safeStringList("main_obstacles" in weekly ? weekly.main_obstacles : []),
      recommended_priorities: safeStringList("recommended_priorities" in weekly ? weekly.recommended_priorities : []),
      consistency_score: safeNumber("consistency_score" in weekly ? weekly.consistency_score : null, 0, 100) ?? 0
    },
    warnings: safeStringList("warnings" in value ? value.warnings : [])
  };
}

function renderHistory(history: CoachPromptHistoryItem[]) {
  if (history.length === 0) {
    return "Aucun échange antérieur.";
  }

  return history
    .slice(-6)
    .map((item) => `${item.role === "assistant" ? "Coach" : "Utilisateur"}: ${item.content}`)
    .join("\n");
}

export function buildCoachPrompt(args: {
  message: string;
  history: CoachPromptHistoryItem[];
  context: CoachContextPayload;
  firstName: string | null;
  timezone: string;
}) {
  const userLabel = args.firstName ? `Utilisateur: ${args.firstName}` : "Utilisateur connecté";

  return `
${userLabel}
Fuseau horaire applicatif: ${args.timezone}

Tu joues le rôle d'un coach comportemental honnête, non culpabilisant et concret.

Règles impératives :
- Utilise uniquement le contexte fourni.
- Si la cause n'est pas certaine, ne l'affirme pas. Utilise "à clarifier" et pose une seule question.
- N'invente ni obstacle, ni émotion, ni diagnostic médical ou psychologique.
- Propose une stratégie mesurable et une prochaine action très concrète.
- Réduis la difficulté si nécessaire.
- Respecte les priorités spirituelles, familiales, financières et de santé.
- Réponds uniquement en JSON valide, sans texte avant ni après.

JSON attendu :
{
  "summary": "string",
  "question": "string",
  "likely_blocker": "string",
  "strategy": "string",
  "next_action": {
    "title": "string",
    "duration_minutes": 15,
    "suggested_time": "10:00",
    "difficulty": "low|medium|high",
    "best_moment": "string|null",
    "reminder_hint": "string|null"
  }
}

Historique récent :
${renderHistory(args.history)}

Réponse actuelle de l'utilisateur :
${args.message}

Contexte structuré :
${JSON.stringify(args.context, null, 2)}
`.trim();
}

function unwrapJsonBlock(raw: string) {
  const fenceMatch = raw.match(/```json\s*([\s\S]+?)\s*```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1).trim();
  }

  return raw.trim();
}

export function extractCoachReply(raw: string): CoachStructuredReply {
  const json = unwrapJsonBlock(raw);
  const parsed = JSON.parse(json) as Partial<CoachStructuredReply>;
  const summary = safeText(parsed.summary, 240);
  const question = safeText(parsed.question, 220);
  const likelyBlocker = safeText(parsed.likely_blocker, 220);
  const strategy = safeText(parsed.strategy, 240);
  const nextActionValue = parsed.next_action;

  if (!nextActionValue || typeof nextActionValue !== "object") {
    throw new Error("COACH_INVALID_RESPONSE");
  }

  const title = safeText("title" in nextActionValue ? nextActionValue.title : null, 160);
  const duration = safeNumber(
    "duration_minutes" in nextActionValue ? nextActionValue.duration_minutes : null,
    5,
    240
  );
  const suggestedTime = safeText(
    "suggested_time" in nextActionValue ? nextActionValue.suggested_time : null,
    16
  );
  const difficulty = "difficulty" in nextActionValue ? nextActionValue.difficulty : null;
  const bestMoment = safeText("best_moment" in nextActionValue ? nextActionValue.best_moment : null, 80);
  const reminderHint = safeText("reminder_hint" in nextActionValue ? nextActionValue.reminder_hint : null, 120);

  if (
    !summary ||
    !question ||
    !likelyBlocker ||
    !strategy ||
    !title ||
    duration == null ||
    !suggestedTime ||
    (difficulty !== "low" && difficulty !== "medium" && difficulty !== "high")
  ) {
    throw new Error("COACH_INVALID_RESPONSE");
  }

  return {
    summary,
    question,
    likely_blocker: likelyBlocker,
    strategy,
    next_action: {
      title,
      duration_minutes: duration,
      suggested_time: suggestedTime,
      difficulty,
      best_moment: bestMoment,
      reminder_hint: reminderHint
    }
  };
}

export function buildCoachReplyText(reply: CoachStructuredReply) {
  return [
    reply.summary,
    `Pourquoi ça n'a pas avancé : ${reply.likely_blocker}`,
    `Stratégie : ${reply.strategy}`,
    `Ce que je fais maintenant : ${reply.next_action.title} · ${reply.next_action.duration_minutes} min · ${reply.next_action.suggested_time}`,
    `Question suivante : ${reply.question}`
  ].join("\n\n");
}
