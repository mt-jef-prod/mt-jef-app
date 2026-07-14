import {
  ActionCard,
  EmptyState,
  PrimaryButton,
  ProgressBar,
  StatusBadge
} from "../../components/ui";
import type { CoachHistoryEntry, CoachInsightReport } from "../../lib/types";

interface CoachCardProps {
  loading: boolean;
  report: CoachInsightReport | null;
  latestRecommendation: CoachHistoryEntry | null;
  onOpen: () => void;
}

function signalTone(severity: string) {
  switch (severity) {
    case "alert":
      return "danger";
    case "warning":
      return "warning";
    default:
      return "accent";
  }
}

export function CoachCard({
  loading,
  report,
  latestRecommendation,
  onOpen
}: CoachCardProps) {
  if (loading) {
    return (
      <ActionCard
        title="Le coach relit ta journée"
        description="Analyse des écarts entre intentions, tâches et résultats en cours."
        meta={<StatusBadge tone="accent">Analyse</StatusBadge>}
      >
        <div className="coach-card__metrics">
          <div className="coach-card__metric">
            <span>Priorité</span>
            <strong>Chargement…</strong>
          </div>
          <div className="coach-card__metric">
            <span>Régularité</span>
            <strong>—</strong>
          </div>
          <div className="coach-card__metric">
            <span>Cap du jour</span>
            <strong>—</strong>
          </div>
        </div>
      </ActionCard>
    );
  }

  if (!report) {
    return (
      <EmptyState
        title="Coach indisponible"
        description="Le module de coaching n'a pas encore assez d'éléments pour analyser la journée."
        action={<PrimaryButton onClick={onOpen}>Faire le point</PrimaryButton>}
      />
    );
  }

  return (
    <ActionCard
      title={report.primary_signal?.title ?? "Coach du jour"}
      description={report.primary_signal?.evidence ?? "Le coach attend davantage de contexte fiable."}
      meta={
        <StatusBadge tone={signalTone(report.primary_signal?.severity ?? "info")}>
          {report.primary_signal?.severity === "alert"
            ? "À traiter"
            : report.primary_signal?.severity === "warning"
              ? "À clarifier"
              : "À explorer"}
        </StatusBadge>
      }
      actions={<PrimaryButton onClick={onOpen}>Faire le point</PrimaryButton>}
    >
      <div className="coach-card__metrics">
        <div className="coach-card__metric">
          <span>Tâches concrètes</span>
          <strong>
            {report.daily_snapshot.completed_task_count}/{report.daily_snapshot.planned_task_count}
          </strong>
        </div>
        <div className="coach-card__metric">
          <span>Prières suivies</span>
          <strong>
            {report.daily_snapshot.prayer_completion_rate == null
              ? "—"
              : `${report.daily_snapshot.prayer_completion_rate} %`}
          </strong>
        </div>
        <div className="coach-card__metric">
          <span>Régularité semaine</span>
          <strong>{report.weekly_snapshot.consistency_score} %</strong>
        </div>
      </div>

      <ProgressBar value={report.weekly_snapshot.consistency_score} />

      {latestRecommendation ? (
        <div className="coach-card__plan">
          <p className="coach-card__label">Ce que je fais maintenant</p>
          <strong>{latestRecommendation.next_action.title}</strong>
          <p>
            {latestRecommendation.next_action.duration_minutes} min ·{" "}
            {latestRecommendation.next_action.suggested_time} · difficulté{" "}
            {latestRecommendation.next_action.difficulty}
          </p>
        </div>
      ) : (
        <p className="coach-card__question">{report.primary_signal?.question}</p>
      )}
    </ActionCard>
  );
}
