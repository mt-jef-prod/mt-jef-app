/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
} as const;

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const MAX_MESSAGE_LENGTH = 1_500;
const MAX_HISTORY_ITEMS = 8;
const MAX_HISTORY_MESSAGE_LENGTH = 800;
const MAX_OUTPUT_TOKENS = 700;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 8;

const requestBuckets = new Map<string, { count: number; resetAt: number }>();

type ChatRole = "user" | "assistant";
type AssistantDomain = "projects" | "tasks" | "finances";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface AssistantRequest {
  message?: unknown;
  history?: unknown;
  timezone?: unknown;
  firstName?: unknown;
}

interface ContextPayload {
  generated_at: string;
  timezone: string;
  requested_domains: AssistantDomain[];
  warnings: string[];
  capabilities: {
    read_only: true;
    future_actions: string[];
  };
  projects?: Array<Record<string, unknown>>;
  project_steps?: Array<Record<string, unknown>>;
  tasks?: Array<Record<string, unknown>>;
  finances?: Array<Record<string, unknown>>;
  balances?: Array<Record<string, unknown>>;
  budgets?: Array<Record<string, unknown>>;
}

const SYSTEM_PROMPT = `
Tu es l'assistant personnel M.T JËF.
Tu réponds toujours en français, avec un ton clair et concret.

Règles impératives :
- Utilise uniquement les données de contexte fournies.
- Si le contexte est incomplet, absent ou insuffisant, dis-le clairement.
- N'invente jamais une donnée, un montant, une date ou un statut.
- Cette version est strictement en lecture seule.
- Tu ne crées, ne modifies et ne supprimes aucune donnée.
- Si l'utilisateur demande une action, propose un plan ou un brouillon de saisie et précise qu'aucune action n'a été exécutée.
- Appuie tes réponses sur des éléments précis quand ils existent : titres, statuts, dates, échéances, montants.
- Si plusieurs devises apparaissent, distingue-les explicitement.
- Reste concis et utile.
`.trim();

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders
  });
}

function pruneRateLimitBuckets(now: number) {
  for (const [key, bucket] of requestBuckets.entries()) {
    if (bucket.resetAt <= now) {
      requestBuckets.delete(key);
    }
  }
}

function enforceRateLimit(userId: string) {
  const now = Date.now();
  pruneRateLimitBuckets(now);

  const current = requestBuckets.get(userId);

  if (!current || current.resetAt <= now) {
    requestBuckets.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    });
    return;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }

  current.count += 1;
  requestBuckets.set(userId, current);
}

function sanitizeText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(-MAX_HISTORY_ITEMS)
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const role = "role" in item ? item.role : null;
      const content = "content" in item ? item.content : null;

      if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
        return [];
      }

      const cleaned = sanitizeText(content, MAX_HISTORY_MESSAGE_LENGTH);

      if (!cleaned) {
        return [];
      }

      return [{ role, content: cleaned }];
    });
}

function normalizeFirstName(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = sanitizeText(value, 80);
  return cleaned || null;
}

function normalizeTimezone(value: unknown) {
  if (typeof value !== "string") {
    return "Europe/Paris";
  }

  const cleaned = sanitizeText(value, 80);
  return cleaned || "Europe/Paris";
}

function detectDomains(message: string): AssistantDomain[] {
  const normalized = message.toLowerCase();
  const domains = new Set<AssistantDomain>();

  if (
    /(projet|projets|jalon|jalons|étape|étapes|etape|etapes|objectif|objectifs|avancement)/.test(
      normalized
    )
  ) {
    domains.add("projects");
  }

  if (
    /(tâche|tâches|tache|taches|action|actions|priorité|priorites|priorite|todo|échéance|echeance|planif)/.test(
      normalized
    )
  ) {
    domains.add("tasks");
  }

  if (
    /(budget|budgets|finance|finances|dépense|dépenses|depense|depenses|revenu|revenus|solde|argent|compte|xof|eur|usd)/.test(
      normalized
    )
  ) {
    domains.add("finances");
  }

  if (domains.size === 0) {
    domains.add("projects");
    domains.add("tasks");
    domains.add("finances");
  }

  return [...domains];
}

function sanitizeValue(value: unknown): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 240 ? `${value.slice(0, 237)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => sanitizeValue(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeValue(entry)])
    );
  }

  return String(value);
}

async function safeQuery<T>(
  label: string,
  executor: () => Promise<{ data: T[] | null; error: { message?: string } | null }>,
  warnings: string[]
) {
  const { data, error } = await executor();

  if (error) {
    warnings.push(`${label}_unavailable`);
    return [] as T[];
  }

  return data ?? [];
}

async function loadProjectMap(
  db: SupabaseClient,
  projectIds: string[],
  warnings: string[]
) {
  if (projectIds.length === 0) {
    return new Map<string, string>();
  }

  const rows = await safeQuery<{ id: string; title: string }>(
    "projects_lookup",
    () =>
      db
        .from("projects")
        .select("id, title")
        .in("id", projectIds)
        .limit(projectIds.length),
    warnings
  );

  return new Map(rows.map((row) => [row.id, row.title]));
}

async function loadCategoryMap(
  db: SupabaseClient,
  categoryIds: string[],
  warnings: string[]
) {
  if (categoryIds.length === 0) {
    return new Map<string, string>();
  }

  const rows = await safeQuery<{ id: string; name: string }>(
    "categories_lookup",
    () =>
      db
        .from("finance_categories")
        .select("id, name")
        .in("id", categoryIds)
        .limit(categoryIds.length),
    warnings
  );

  return new Map(rows.map((row) => [row.id, row.name]));
}

async function collectContext(
  db: SupabaseClient,
  domains: AssistantDomain[],
  timezone: string
): Promise<ContextPayload> {
  const warnings: string[] = [];
  const wantsProjects = domains.includes("projects");
  const wantsTasks = domains.includes("tasks");
  const wantsFinances = domains.includes("finances");

  const [
    projects,
    projectSteps,
    tasks,
    finances,
    balances,
    budgets
  ] = await Promise.all([
    wantsProjects || wantsTasks
      ? safeQuery<Record<string, unknown>>(
          "projects",
          () =>
            db
              .from("projects")
              .select(
                "id, title, status, progress, target_date, first_action_defined, first_action_title, cost_estimation_status, estimated_budget, actual_budget, available_funding, currency, updated_at"
              )
              .order("updated_at", { ascending: false })
              .limit(8),
          warnings
        )
      : Promise.resolve([]),
    wantsProjects
      ? safeQuery<Record<string, unknown>>(
          "project_steps",
          () =>
            db
              .from("project_steps")
              .select(
                "project_id, title, status, target_date, completed_at, order_index, updated_at"
              )
              .order("updated_at", { ascending: false })
              .limit(12),
          warnings
        )
      : Promise.resolve([]),
    wantsTasks
      ? safeQuery<Record<string, unknown>>(
          "tasks",
          () =>
            db
              .from("tasks")
              .select(
                "project_id, title, status, priority_score, due_date, scheduled_at, proof_required, postponed_count, completed_at, updated_at"
              )
              .order("priority_score", { ascending: false })
              .limit(12),
          warnings
        )
      : Promise.resolve([]),
    wantsFinances
      ? safeQuery<Record<string, unknown>>(
          "finances",
          () =>
            db
              .from("finances")
              .select(
                "project_id, category_id, transaction_type, amount, currency, transaction_date, status, is_mandatory, is_reserved, description, created_at"
              )
              .order("transaction_date", { ascending: false })
              .limit(12),
          warnings
        )
      : Promise.resolve([]),
    wantsFinances
      ? safeQuery<Record<string, unknown>>(
          "balances",
          () =>
            db
              .from("vue_solde_reel_disponible")
              .select("currency, current_balance, protected_outflows, real_available_balance")
              .order("currency", { ascending: true }),
          warnings
        )
      : Promise.resolve([]),
    wantsFinances
      ? safeQuery<Record<string, unknown>>(
          "budgets",
          () =>
            db
              .from("vue_budget_status")
              .select(
                "budget_id, category_id, period_start, period_end, currency, planned_amount, spent_amount, committed_amount, remaining_amount, consumption_percentage"
              )
              .order("period_end", { ascending: false })
              .limit(10),
          warnings
        )
      : Promise.resolve([])
  ]);

  const projectIds = new Set<string>();
  const categoryIds = new Set<string>();

  for (const row of [...projectSteps, ...tasks, ...finances]) {
    const projectId = typeof row.project_id === "string" ? row.project_id : null;
    if (projectId) {
      projectIds.add(projectId);
    }
  }

  for (const row of [...finances, ...budgets]) {
    const categoryId = typeof row.category_id === "string" ? row.category_id : null;
    if (categoryId) {
      categoryIds.add(categoryId);
    }
  }

  const [projectMap, categoryMap] = await Promise.all([
    loadProjectMap(db, [...projectIds], warnings),
    loadCategoryMap(db, [...categoryIds], warnings)
  ]);

  return sanitizeValue({
    generated_at: new Date().toISOString(),
    timezone,
    requested_domains: domains,
    warnings,
    capabilities: {
      read_only: true,
      future_actions: [
        "create_task",
        "add_expense",
        "update_project_step",
        "generate_summary",
        "propose_action_plan"
      ]
    },
    projects: projects.map((row) => ({
      title: row.title,
      status: row.status,
      progress: row.progress,
      target_date: row.target_date,
      first_action_defined: row.first_action_defined,
      first_action_title: row.first_action_title,
      cost_estimation_status: row.cost_estimation_status,
      estimated_budget: row.estimated_budget,
      actual_budget: row.actual_budget,
      available_funding: row.available_funding,
      currency: row.currency,
      updated_at: row.updated_at
    })),
    project_steps: projectSteps.map((row) => ({
      project_title:
        typeof row.project_id === "string" ? projectMap.get(row.project_id) ?? null : null,
      title: row.title,
      status: row.status,
      target_date: row.target_date,
      completed_at: row.completed_at,
      order_index: row.order_index
    })),
    tasks: tasks.map((row) => ({
      project_title:
        typeof row.project_id === "string" ? projectMap.get(row.project_id) ?? null : null,
      title: row.title,
      status: row.status,
      priority_score: row.priority_score,
      due_date: row.due_date,
      scheduled_at: row.scheduled_at,
      proof_required: row.proof_required,
      postponed_count: row.postponed_count,
      completed_at: row.completed_at,
      updated_at: row.updated_at
    })),
    finances: finances.map((row) => ({
      project_title:
        typeof row.project_id === "string" ? projectMap.get(row.project_id) ?? null : null,
      category_name:
        typeof row.category_id === "string" ? categoryMap.get(row.category_id) ?? null : null,
      transaction_type: row.transaction_type,
      amount: row.amount,
      currency: row.currency,
      transaction_date: row.transaction_date,
      status: row.status,
      is_mandatory: row.is_mandatory,
      is_reserved: row.is_reserved,
      description: row.description
    })),
    balances,
    budgets: budgets.map((row) => ({
      category_name:
        typeof row.category_id === "string" ? categoryMap.get(row.category_id) ?? null : null,
      period_start: row.period_start,
      period_end: row.period_end,
      currency: row.currency,
      planned_amount: row.planned_amount,
      spent_amount: row.spent_amount,
      committed_amount: row.committed_amount,
      remaining_amount: row.remaining_amount,
      consumption_percentage: row.consumption_percentage
    }))
  }) as ContextPayload;
}

function renderConversation(history: ChatMessage[]) {
  if (history.length === 0) {
    return "Aucun historique récent.";
  }

  return history
    .map((entry) => `${entry.role === "user" ? "Utilisateur" : "Assistant"}: ${entry.content}`)
    .join("\n");
}

function buildPrompt(args: {
  message: string;
  history: ChatMessage[];
  context: ContextPayload;
  firstName: string | null;
  timezone: string;
}) {
  const userLabel = args.firstName ? `Utilisateur: ${args.firstName}` : "Utilisateur connecté";

  return `
${userLabel}
Fuseau horaire applicatif: ${args.timezone}
Date de génération UTC: ${new Date().toISOString()}

Historique récent :
${renderConversation(args.history)}

Question actuelle :
${args.message}

Contexte de données JSON :
${JSON.stringify(args.context, null, 2)}
`.trim();
}

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const directOutput = "output_text" in payload ? payload.output_text : null;
  if (typeof directOutput === "string" && directOutput.trim()) {
    return directOutput.trim();
  }

  const output = "output" in payload ? payload.output : null;
  if (!Array.isArray(output)) {
    return "";
  }

  const parts: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (!content || typeof content !== "object") {
        continue;
      }

      if ("text" in content && typeof content.text === "string" && content.text.trim()) {
        parts.push(content.text.trim());
      }
    }
  }

  return parts.join("\n\n").trim();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "METHOD_NOT_ALLOWED" });
  }

  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResponse(500, { error: "SERVER_MISCONFIGURED" });
  }

  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "UNAUTHORIZED" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const {
    data: { user },
    error: authError
  } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return jsonResponse(401, { error: "INVALID_SESSION" });
  }

  try {
    enforceRateLimit(user.id);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT_EXCEEDED") {
      return jsonResponse(429, {
        error: "RATE_LIMIT_EXCEEDED",
        message: "Trop de requêtes. Attendez environ une minute avant de réessayer."
      });
    }

    return jsonResponse(500, { error: "RATE_LIMIT_FAILURE" });
  }

  let body: AssistantRequest;

  try {
    body = (await request.json()) as AssistantRequest;
  } catch {
    return jsonResponse(400, { error: "INVALID_JSON" });
  }

  const message = typeof body.message === "string" ? sanitizeText(body.message, MAX_MESSAGE_LENGTH) : "";

  if (!message) {
    return jsonResponse(400, { error: "MESSAGE_REQUIRED" });
  }

  if (body.message && typeof body.message === "string" && body.message.trim().length > MAX_MESSAGE_LENGTH) {
    return jsonResponse(413, {
      error: "MESSAGE_TOO_LONG",
      message: `Le message dépasse la limite de ${MAX_MESSAGE_LENGTH} caractères.`
    });
  }

  const history = normalizeHistory(body.history);
  const timezone = normalizeTimezone(body.timezone);
  const firstName = normalizeFirstName(body.firstName);

  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const domains = detectDomains(message);
  const context = await collectContext(db, domains, timezone);
  const input = buildPrompt({
    message,
    history,
    context,
    firstName,
    timezone
  });

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      store: false,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      instructions: SYSTEM_PROMPT,
      input
    })
  });

  if (!openAiResponse.ok) {
    let providerMessage = "OPENAI_UPSTREAM_ERROR";

    try {
      const errorBody = (await openAiResponse.json()) as { error?: { message?: string } };
      providerMessage = errorBody.error?.message || providerMessage;
    } catch {
      providerMessage = "OPENAI_UPSTREAM_ERROR";
    }

    return jsonResponse(502, {
      error: "OPENAI_REQUEST_FAILED",
      message: providerMessage
    });
  }

  const payload = await openAiResponse.json();
  const reply = extractOutputText(payload);

  return jsonResponse(200, {
    reply,
    sources: domains,
    warnings: context.warnings
  });
});
