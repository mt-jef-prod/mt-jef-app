import { useEffect, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import {
  ActionCard,
  EmptyState,
  ListRow,
  LoadingSkeleton,
  ProgressBar,
  StatusBadge
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import type {
  BudgetStatusRow,
  DailyIntentionRow,
  PrayerLogRow,
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

const PRAYER_NAMES: PrayerLogRow["prayer_name"][] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

const PRAYER_LABELS: Record<PrayerLogRow["prayer_name"], string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha"
};

function prayerTone(status: PrayerLogRow["status"]) {
  switch (status) {
    case "completed":
      return "success";
    case "late":
      return "warning";
    case "missed":
      return "danger";
    default:
      return "default";
  }
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
  const [prayers, setPrayers] = useState<PrayerLogRow[]>([]);

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
          { data: budgetData, error: budgetError },
          { data: prayerData, error: prayerError }
        ] = await Promise.all([
          client.from("vue_solde_reel_disponible").select("*").order("currency"),
          client.from("projects").select("*").order("updated_at", { ascending: false }).limit(4),
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
            .limit(3),
          client.from("prayer_logs").select("*").eq("prayer_date", today)
        ]);

        if (
          balanceError ??
          projectError ??
          taskError ??
          intentionError ??
          budgetError ??
          prayerError
        ) {
          throw (
            balanceError ??
            projectError ??
            taskError ??
            intentionError ??
            budgetError ??
            prayerError
          );
        }

        if (!active) {
          return;
        }

        setBalances((balanceData as SoldeReelRow[]) ?? []);
        setProjects((projectData as ProjectRow[]) ?? []);
        setTasks((taskData as TaskRow[]) ?? []);
        setTodayIntention((intentionData as DailyIntentionRow | null) ?? null);
        setBudgetAlerts((budgetData as BudgetStatusRow[]) ?? []);
        setPrayers((prayerData as PrayerLogRow[]) ?? []);
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

  const prayerMap = new Map(prayers.map((entry) => [entry.prayer_name, entry.status]));
  const priorityTasks = tasks.slice(0, 3);
  const featuredProjects = projects.slice(0, 3);
  const topBalance = balances[0] ?? null;
  const topBudget = budgetAlerts[0] ?? null;

  return (
    <div className="today-grid">
      <SectionCard
        title="Intention du jour"
        subtitle="La journée commence par un cap simple, lisible et concret."
      >
        {loading ? (
          <LoadingSkeleton lines={3} />
        ) : todayIntention ? (
          <ActionCard
            title={todayIntention.intention}
            description={`Enregistrée pour le ${formatDate(todayIntention.intention_date)}`}
            meta={<StatusBadge tone="accent">En place</StatusBadge>}
          />
        ) : (
          <EmptyState
            title="Aucune intention enregistrée"
            description="Rédige une intention claire pour donner une direction à la journée."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Prière du jour"
        subtitle="Un suivi simple, sans score ni surcharge."
      >
        {loading ? (
          <LoadingSkeleton lines={5} />
        ) : (
          <div className="list-stack">
            {PRAYER_NAMES.map((name) => {
              const status = prayerMap.get(name) ?? "not_recorded";

              return (
                <ListRow
                  key={name}
                  title={PRAYER_LABELS[name]}
                  description={
                    status === "not_recorded"
                      ? "Aucun statut enregistré pour l'instant."
                      : `Statut ${status.replaceAll("_", " ")}`
                  }
                  aside={<StatusBadge tone={prayerTone(status)}>{status}</StatusBadge>}
                />
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Priorités du jour"
        subtitle="Trois éléments maximum pour garder une vraie capacité d'action."
      >
        {loading ? (
          <LoadingSkeleton lines={3} />
        ) : priorityTasks.length === 0 ? (
          <EmptyState
            title="Aucune priorité visible"
            description="Crée une tâche ou reviens plus tard pour voir émerger l'essentiel."
          />
        ) : (
          <div className="list-stack">
            {priorityTasks.map((task) => (
              <ListRow
                key={task.id}
                title={task.title}
                description={`Échéance ${formatDate(task.due_date)} · score ${toNumber(
                  task.priority_score
                ).toFixed(2)}`}
                meta={<StatusBadge tone={task.status === "blocked" ? "warning" : "default"}>{task.status}</StatusBadge>}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Projets à faire avancer"
        subtitle="Deux ou trois chantiers lisibles, avec prochaine action et progression."
      >
        {loading ? (
          <LoadingSkeleton lines={3} />
        ) : featuredProjects.length === 0 ? (
          <EmptyState
            title="Aucun projet actif"
            description="Les projets apparaîtront ici avec leur progression et leur prochaine étape."
          />
        ) : (
          <div className="list-stack">
            {featuredProjects.map((project) => (
              <ActionCard
                key={project.id}
                title={project.title}
                description={
                  project.first_action_title
                    ? `Prochaine action : ${project.first_action_title}`
                    : "Première action à préciser"
                }
                meta={<StatusBadge tone={project.status === "active" ? "accent" : "default"}>{project.status}</StatusBadge>}
              >
                <div className="project-card__meta-row">
                  <span>Échéance {formatDate(project.target_date)}</span>
                  <span>
                    Budget {formatMoney(project.estimated_budget, project.currency)}
                  </span>
                </div>
                <ProgressBar value={project.progress} />
              </ActionCard>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Finances"
        subtitle="Un résumé lisible du disponible réel et de la pression budgétaire."
      >
        {loading ? (
          <LoadingSkeleton lines={3} />
        ) : (
          <div className="today-finance-grid">
            <ActionCard
              title={topBalance ? formatMoney(topBalance.real_available_balance, topBalance.currency) : "—"}
              description={
                topBalance
                  ? `Disponible réel en ${topBalance.currency}`
                  : "Aucun solde ou engagement protégé enregistré."
              }
              meta={<StatusBadge tone="accent">Solde réel</StatusBadge>}
            >
              {topBalance ? (
                <div className="project-card__meta-row">
                  <span>Courant {formatMoney(topBalance.current_balance, topBalance.currency)}</span>
                  <span>
                    Protégé {formatMoney(topBalance.protected_outflows, topBalance.currency)}
                  </span>
                </div>
              ) : null}
            </ActionCard>

            <ActionCard
              title={
                topBudget?.consumption_percentage == null
                  ? "Aucun budget"
                  : `${toNumber(topBudget.consumption_percentage).toFixed(0)} %`
              }
              description={
                topBudget
                  ? `Reste ${formatMoney(topBudget.remaining_amount, topBudget.currency)}`
                  : "Crée une enveloppe pour suivre les dépenses du mois."
              }
              meta={<StatusBadge tone="success">Budget</StatusBadge>}
            >
              {topBudget ? (
                <div className="project-card__meta-row">
                  <span>Prévu {formatMoney(topBudget.planned_amount, topBudget.currency)}</span>
                  <span>Engagé {formatMoney(topBudget.committed_amount, topBudget.currency)}</span>
                </div>
              ) : null}
            </ActionCard>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
