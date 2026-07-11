import { useEffect, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import { StatCard } from "../../components/StatCard";
import { supabase } from "../../lib/supabase";
import type {
  BudgetStatusRow,
  DailyIntentionRow,
  ProjectRow,
  SoldeReelRow,
  TaskRow
} from "../../lib/types";
import { formatDate, formatMoney, messageFromError, toNumber, todayDate } from "../../lib/utils";

interface DashboardSectionProps {
  userId: string;
  timezone: string;
  refreshToken: number;
  onError: (message: string) => void;
}

export function DashboardSection({
  userId,
  timezone,
  refreshToken,
  onError
}: DashboardSectionProps) {
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<SoldeReelRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [todayIntention, setTodayIntention] = useState<DailyIntentionRow | null>(null);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetStatusRow[]>([]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const today = todayDate(timezone);
        const [
          { data: balanceData, error: balanceError },
          { data: projectData, error: projectError },
          { data: taskData, error: taskError },
          { data: intentionData, error: intentionError },
          { data: budgetData, error: budgetError }
        ] = await Promise.all([
          client.from("vue_solde_reel_disponible").select("*").order("currency"),
          client.from("projects").select("*").order("updated_at", { ascending: false }),
          client
            .from("tasks")
            .select("*")
            .not("status", "eq", "completed")
            .order("priority_score", { ascending: false })
            .limit(6),
          client
            .from("daily_intentions")
            .select("*")
            .eq("intention_date", today)
            .maybeSingle(),
          client
            .from("vue_budget_status")
            .select("*")
            .order("consumption_percentage", { ascending: false, nullsFirst: false })
            .limit(4)
        ]);

        if (balanceError ?? projectError ?? taskError ?? intentionError ?? budgetError) {
          throw balanceError ?? projectError ?? taskError ?? intentionError ?? budgetError;
        }

        if (!active) {
          return;
        }

        setBalances((balanceData as SoldeReelRow[]) ?? []);
        setProjects((projectData as ProjectRow[]) ?? []);
        setTasks((taskData as TaskRow[]) ?? []);
        setTodayIntention((intentionData as DailyIntentionRow | null) ?? null);
        setBudgetAlerts((budgetData as BudgetStatusRow[]) ?? []);
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
  }, [onError, refreshToken, timezone, userId]);

  const activeProjects = projects.filter((project) =>
    ["active", "preparation", "idea"].includes(project.status)
  );
  const blockedTasks = tasks.filter((task) => task.status === "blocked");
  const upcomingTasks = tasks.slice(0, 4);

  return (
    <div className="content-grid">
      <SectionCard
        title="Vue d'ensemble"
        subtitle="Un tableau de bord orienté décision, pas seulement un listing."
      >
        {loading ? (
          <p className="muted-copy">Chargement des indicateurs…</p>
        ) : (
          <div className="stats-grid">
            <StatCard
              label="Projets en mouvement"
              value={String(activeProjects.length)}
              tone="accent"
              hint="Idées, préparations et projets actifs."
            />
            <StatCard
              label="Tâches prioritaires"
              value={String(tasks.length)}
              hint="Tâches non terminées actuellement visibles."
            />
            <StatCard
              label="Blocages"
              value={String(blockedTasks.length)}
              tone={blockedTasks.length > 0 ? "alert" : "default"}
              hint="Points à débloquer rapidement."
            />
            <StatCard
              label="Intention du jour"
              value={todayIntention ? "Rédigée" : "À écrire"}
              hint={todayIntention?.intention ?? "Aucune intention enregistrée aujourd'hui."}
            />
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Solde réel disponible"
        subtitle="Par devise, après déduction des sorties protégées."
      >
        {balances.length === 0 ? (
          <p className="muted-copy">Aucun solde ou engagement protégé enregistré.</p>
        ) : (
          <div className="list-stack">
            {balances.map((balance) => (
              <article className="list-card" key={`${balance.user_id}-${balance.currency}`}>
                <div>
                  <h3>{balance.currency}</h3>
                  <p>
                    Solde courant {formatMoney(balance.current_balance, balance.currency)} · sorties
                    protégées {formatMoney(balance.protected_outflows, balance.currency)}
                  </p>
                </div>
                <strong className="accent-value">
                  {formatMoney(balance.real_available_balance, balance.currency)}
                </strong>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Prochaines actions"
        subtitle="Le lot de tâches qui mérite ton attention immédiate."
      >
        {upcomingTasks.length === 0 ? (
          <p className="muted-copy">Aucune tâche à venir.</p>
        ) : (
          <div className="list-stack">
            {upcomingTasks.map((task) => (
              <article className="list-card" key={task.id}>
                <div>
                  <h3>{task.title}</h3>
                  <p>
                    Statut {task.status} · priorité {toNumber(task.priority_score).toFixed(2)} ·
                    échéance {formatDate(task.due_date)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Tension budgétaire"
        subtitle="Les budgets les plus consommés remontent ici, sans plafonner le pourcentage."
      >
        {budgetAlerts.length === 0 ? (
          <p className="muted-copy">Aucun budget à surveiller pour le moment.</p>
        ) : (
          <div className="list-stack">
            {budgetAlerts.map((budget) => (
              <article className="list-card" key={budget.budget_id}>
                <div>
                  <h3>
                    Période {formatDate(budget.period_start)} → {formatDate(budget.period_end)}
                  </h3>
                  <p>
                    Prévu {formatMoney(budget.planned_amount, budget.currency)} · restant{" "}
                    {formatMoney(budget.remaining_amount, budget.currency)}
                  </p>
                </div>
                <strong className="accent-value">
                  {budget.consumption_percentage === null
                    ? "—"
                    : `${toNumber(budget.consumption_percentage).toFixed(2)} %`}
                </strong>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
