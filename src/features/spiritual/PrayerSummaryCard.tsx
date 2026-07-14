import { ActionCard, GhostButton, ProgressBar, StatusBadge } from "../../components/ui";
import type { PrayerLiveState } from "./prayerService";

interface PrayerSummaryCardProps {
  liveState: PrayerLiveState | null;
  loading?: boolean;
  warning?: string | null;
  onOpenDetails?: () => void;
}

export function PrayerSummaryCard({
  liveState,
  loading = false,
  warning,
  onOpenDetails
}: PrayerSummaryCardProps) {
  const title = loading
    ? "Chargement des horaires…"
    : liveState
      ? `${liveState.nextPrayerLabel} · ${liveState.nextPrayerTime}`
      : "Horaires indisponibles";
  const description = loading
    ? "Calcul des horaires du jour en cours."
    : liveState
      ? `Prochaine prière dans ${liveState.countdownLabel}`
      : "Impossible d'afficher la prochaine prière pour le moment.";

  return (
    <ActionCard
      title={title}
      description={description}
      meta={
        liveState ? (
          <StatusBadge tone="accent">
            {liveState.currentPrayerLabel
              ? `En cours · ${liveState.currentPrayerLabel}`
              : "Prochaine prière"}
          </StatusBadge>
        ) : (
          <StatusBadge>Horaires</StatusBadge>
        )
      }
      actions={
        onOpenDetails ? (
          <GhostButton onClick={onOpenDetails}>Voir toutes les prières</GhostButton>
        ) : null
      }
    >
      {warning ? <p className="prayer-card__note">{warning}</p> : null}
      {liveState ? (
        <div className="prayer-summary-grid">
          <div className="prayer-summary-grid__item">
            <span>Progression du jour</span>
            <strong>{liveState.dayProgress} %</strong>
          </div>
          <div className="prayer-summary-grid__item">
            <span>Prières suivies</span>
            <strong>{liveState.completedCount}/5</strong>
          </div>
        </div>
      ) : null}
      {liveState ? <ProgressBar value={liveState.dayProgress} /> : null}
    </ActionCard>
  );
}
