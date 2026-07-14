import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type {
  BudgetStatusRow,
  CoachInsightReport,
  DailyIntentionRow,
  DailyReviewRow,
  FinanceRow,
  PrayerLogRow,
  ProjectRow,
  TaskRow
} from "../../lib/types";
import { messageFromError, resolveTimeZone, todayDate } from "../../lib/utils";
import { buildCoachInsights } from "./coachEngine";

interface UseCoachInsightsOptions {
  timezone: string;
  refreshToken: number;
  onError: (message: string) => void;
}

interface UseCoachInsightsResult {
  loading: boolean;
  report: CoachInsightReport | null;
}

function subtractDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() - days);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function useCoachInsights({
  timezone,
  refreshToken,
  onError
}: UseCoachInsightsOptions): UseCoachInsightsResult {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<CoachInsightReport | null>(null);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;
    const resolvedTimezone = resolveTimeZone(timezone);
    const today = todayDate(resolvedTimezone);
    const sevenDaysAgo = subtractDays(today, 6);
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const [
          { data: intentionData, error: intentionError },
          { data: taskData, error: taskError },
          { data: projectData, error: projectError },
          { data: prayerData, error: prayerError },
          { data: financeData, error: financeError },
          { data: budgetData, error: budgetError },
          { data: reviewData, error: reviewError }
        ] = await Promise.all([
          client.from("daily_intentions").select("*").eq("intention_date", today).maybeSingle(),
          client
            .from("tasks")
            .select(
              "id, user_id, project_id, title, description, domain, urgency, importance, spiritual_impact, family_impact, financial_impact, administrative_impact, effort, duration_minutes, priority_score, due_date, scheduled_at, status, proof_required, proof_url, postponed_count, completed_at, created_at, updated_at"
            )
            .order("updated_at", { ascending: false })
            .limit(24),
          client
            .from("projects")
            .select(
              "id, user_id, title, intention, objective, expected_result, category, priority, status, start_date, target_date, estimated_budget, actual_budget, available_funding, currency, progress, first_action_title, first_action_defined, cost_estimation_status, created_at, updated_at"
            )
            .order("updated_at", { ascending: false })
            .limit(12),
          client
            .from("prayer_logs")
            .select("*")
            .gte("prayer_date", sevenDaysAgo)
            .order("prayer_date", { ascending: false })
            .limit(35),
          client
            .from("finances")
            .select(
              "id, user_id, project_id, category_id, transaction_type, amount, currency, transaction_date, status, is_mandatory, is_reserved, description, receipt_url, created_at, updated_at"
            )
            .gte("transaction_date", sevenDaysAgo)
            .order("transaction_date", { ascending: false })
            .limit(24),
          client
            .from("vue_budget_status")
            .select("*")
            .order("consumption_percentage", { ascending: false, nullsFirst: false })
            .limit(6),
          client
            .from("daily_reviews")
            .select("*")
            .gte("review_date", sevenDaysAgo)
            .order("review_date", { ascending: false })
            .limit(7)
        ]);

        if (
          intentionError ??
          taskError ??
          projectError ??
          prayerError ??
          financeError ??
          budgetError ??
          reviewError
        ) {
          throw (
            intentionError ??
            taskError ??
            projectError ??
            prayerError ??
            financeError ??
            budgetError ??
            reviewError
          );
        }

        if (!active) {
          return;
        }

        setReport(
          buildCoachInsights({
            intention: (intentionData as DailyIntentionRow | null) ?? null,
            tasks: (taskData as TaskRow[]) ?? [],
            projects: (projectData as ProjectRow[]) ?? [],
            prayers: (prayerData as PrayerLogRow[]) ?? [],
            finances: (financeData as FinanceRow[]) ?? [],
            budgets: (budgetData as BudgetStatusRow[]) ?? [],
            reviews: (reviewData as DailyReviewRow[]) ?? [],
            timezone: resolvedTimezone
          })
        );
      } catch (error) {
        if (active) {
          onError(messageFromError(error));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [onError, refreshToken, timezone]);

  return {
    loading,
    report
  };
}
