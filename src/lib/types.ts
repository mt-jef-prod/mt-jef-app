export type NumericLike = number | string;
export type SupabaseKeyKind = "missing" | "publishable" | "legacy" | "unknown";
export type SupabaseDiagnosticCategory =
  | "configuration"
  | "dns"
  | "cors"
  | "timeout"
  | "network_unavailable"
  | "http"
  | "supabase_auth"
  | "other";

export type ProjectStatus =
  | "idea"
  | "preparation"
  | "active"
  | "blocked"
  | "paused"
  | "completed"
  | "abandoned"
  | "archived";

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "completed"
  | "postponed"
  | "cancelled";

export type TransactionType = "income" | "expense";

export type FinanceStatus =
  | "planned"
  | "committed"
  | "paid"
  | "received"
  | "cancelled";

export type PrayerStatus =
  | "completed"
  | "late"
  | "missed"
  | "not_recorded";

export interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  city: string | null;
  country: string;
  timezone: string;
  preferred_currency: string;
  created_at: string;
  updated_at: string;
}

export interface FamilyMemberRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string | null;
  birth_date: string | null;
  relationship: string;
  interests: string[];
  notes: string | null;
  last_contact_at: string | null;
  next_contact_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyIntentionRow {
  id: string;
  user_id: string;
  intention_date: string;
  intention: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  user_id: string;
  title: string;
  intention: string | null;
  objective: string | null;
  expected_result: string | null;
  category: string | null;
  priority: number;
  status: ProjectStatus;
  start_date: string | null;
  target_date: string | null;
  estimated_budget: NumericLike;
  actual_budget: NumericLike;
  available_funding: NumericLike;
  currency: string;
  progress: number;
  first_action_title: string | null;
  first_action_defined: boolean;
  cost_estimation_status: "known" | "free" | "unknown_to_estimate";
  created_at: string;
  updated_at: string;
}

export interface ProjectStepRow {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string | null;
  order_index: number;
  status: TaskStatus;
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  domain: string | null;
  urgency: number;
  importance: number;
  spiritual_impact: number;
  family_impact: number;
  financial_impact: number;
  administrative_impact: number;
  effort: number;
  duration_minutes: number | null;
  priority_score: NumericLike;
  due_date: string | null;
  scheduled_at: string | null;
  status: TaskStatus;
  proof_required: boolean;
  proof_url: string | null;
  postponed_count: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceCategoryRow {
  id: string;
  user_id: string | null;
  name: string;
  slug: string;
  transaction_type: TransactionType | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FinanceRow {
  id: string;
  user_id: string;
  project_id: string | null;
  category_id: string;
  transaction_type: TransactionType;
  amount: NumericLike;
  currency: string;
  transaction_date: string;
  status: FinanceStatus;
  is_mandatory: boolean;
  is_reserved: boolean;
  description: string | null;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountBalanceRow {
  id: string;
  user_id: string;
  account_name: string;
  balance: NumericLike;
  currency: string;
  balance_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetRow {
  id: string;
  user_id: string;
  category_id: string;
  period_start: string;
  period_end: string;
  planned_amount: NumericLike;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface PrayerLogRow {
  id: string;
  user_id: string;
  prayer_name: "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
  prayer_date: string;
  status: PrayerStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyReviewRow {
  id: string;
  user_id: string;
  review_date: string;
  prayer_completed: boolean | null;
  priority_completed: boolean | null;
  family_present: boolean | null;
  money_managed: boolean | null;
  health_action: boolean | null;
  learning_action: boolean | null;
  mood: number | null;
  energy: number | null;
  note: string | null;
  tomorrow_correction: string | null;
  created_at: string;
  updated_at: string;
}

export interface SoldeReelRow {
  user_id: string;
  currency: string;
  current_balance: NumericLike;
  protected_outflows: NumericLike;
  real_available_balance: NumericLike;
}

export interface BudgetStatusRow {
  budget_id: string;
  user_id: string;
  category_id: string;
  period_start: string;
  period_end: string;
  currency: string;
  planned_amount: NumericLike;
  spent_amount: NumericLike;
  committed_amount: NumericLike;
  remaining_amount: NumericLike;
  consumption_percentage: NumericLike | null;
}

export type AssistantRole = "user" | "assistant";
export type AssistantFunctionMode = "assistant" | "coach";

export type CoachSignalCode =
  | "missing_data"
  | "stalled_goal"
  | "repeated_postponement"
  | "no_next_action"
  | "overload"
  | "financial_pressure"
  | "fatigue"
  | "irregularity"
  | "lack_of_clarity";

export type CoachSignalSeverity = "info" | "warning" | "alert";
export type CoachObjectiveType = "day" | "task" | "project";

export interface CoachObjective {
  type: CoachObjectiveType;
  title: string;
  status: string | null;
  deadline: string | null;
  next_action_title?: string | null;
}

export interface CoachSignal {
  code: CoachSignalCode;
  severity: CoachSignalSeverity;
  title: string;
  evidence: string;
  question: string;
  objective: CoachObjective | null;
}

export interface CoachDailySnapshot {
  intention: string | null;
  planned_task_count: number;
  completed_task_count: number;
  overdue_task_count: number;
  active_project_count: number;
  prayer_completion_rate: number | null;
  planned_expenses: Array<{
    currency: string;
    amount: number;
  }>;
  actual_expenses: Array<{
    currency: string;
    amount: number;
  }>;
  mood: number | null;
  energy: number | null;
  review_completed: boolean;
  blockers_logged: boolean;
}

export interface CoachWeeklySnapshot {
  advanced_objectives: string[];
  blocked_objectives: string[];
  regular_habits: string[];
  main_obstacles: string[];
  recommended_priorities: string[];
  consistency_score: number;
}

export interface CoachInsightReport {
  generated_at: string;
  objective: CoachObjective | null;
  primary_signal: CoachSignal | null;
  signals: CoachSignal[];
  daily_snapshot: CoachDailySnapshot;
  weekly_snapshot: CoachWeeklySnapshot;
  warnings: string[];
}

export interface CoachNextAction {
  title: string;
  duration_minutes: number;
  suggested_time: string;
  difficulty: "low" | "medium" | "high";
  best_moment: string | null;
  reminder_hint: string | null;
}

export interface CoachStructuredResponse {
  summary: string;
  question: string;
  likely_blocker: string;
  strategy: string;
  next_action: CoachNextAction;
}

export interface CoachHistoryEntry extends CoachStructuredResponse {
  id: string;
  created_at: string;
  source_signal_code: CoachSignalCode | null;
  objective_title: string | null;
  user_response: string | null;
}

export interface CoachRequestPayload {
  mode: "coach";
  message: string;
  history: AssistantHistoryItem[];
  timezone: string;
  firstName: string | null;
  coachContext: CoachInsightReport;
}

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  content: string;
  createdAt: string;
  sources?: string[];
}

export interface AssistantHistoryItem {
  role: AssistantRole;
  content: string;
}

export interface AssistantFunctionResponse {
  mode?: AssistantFunctionMode;
  reply: string;
  sources: string[];
  warnings: string[];
  coach?: CoachStructuredResponse | null;
}

export interface SupabaseNetworkDiagnostic {
  category: SupabaseDiagnosticCategory;
  duration_ms: number | null;
  endpoint: string | null;
  error_message: string | null;
  error_name: string | null;
  host_reachable: boolean | null;
  http_status: number | null;
  notes: string[];
  project_accessible: boolean;
  state: string;
  tested_at: string;
}

export interface AuthAttemptDiagnostic {
  action: "signin" | "signup";
  attempted_at: string;
  category: SupabaseDiagnosticCategory | null;
  duration_ms: number | null;
  endpoint: string;
  error_message: string | null;
  error_name: string | null;
  http_status: number | null;
  success: boolean | null;
  supabase_code: string | null;
}

export interface NoticeState {
  kind: "success" | "error" | "info";
  message: string;
}

export interface SectionDefinition {
  id:
    | "dashboard"
    | "intention"
    | "family"
    | "projects"
    | "tasks"
    | "finances"
    | "spiritual"
    | "review";
  label: string;
  kicker: string;
}
