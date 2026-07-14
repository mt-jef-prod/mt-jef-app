import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import {
  ActionCard,
  GhostButton,
  ProgressBar,
  PrimaryButton,
  SecondaryButton,
  StatusBadge
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import type { PrayerLogRow, PrayerStatus, ProfileRow } from "../../lib/types";
import { formatDate, messageFromError, todayDate } from "../../lib/utils";
import { PrayerSummaryCard } from "./PrayerSummaryCard";
import {
  DEFAULT_PRAYER_SETTINGS,
  PRAYER_CALCULATION_OPTIONS,
  PRAYER_MADHAB_OPTIONS,
  PRAYER_STATUS_OPTIONS,
  formatPrayerTime,
  prayerTimingLabel,
  trackedPrayerLabel,
  type PrayerAdjustmentMap,
  type PrayerSettings
} from "./prayerService";
import { usePrayerTimes } from "./usePrayerTimes";

interface SpiritualSectionProps {
  userId: string;
  timezone: string;
  refreshToken: number;
  onDataChanged: () => void;
  onInfo: (message: string) => void;
  onError: (message: string) => void;
  profile: ProfileRow | null;
}

const PRAYERS: PrayerLogRow["prayer_name"][] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const ADJUSTMENT_FIELDS: Array<keyof PrayerAdjustmentMap> = [
  "fajr",
  "sunrise",
  "dhuhr",
  "asr",
  "maghrib",
  "isha"
];

export function SpiritualSection({
  userId,
  timezone,
  refreshToken,
  onDataChanged,
  onInfo,
  onError,
  profile
}: SpiritualSectionProps) {
  const [todayLogs, setTodayLogs] = useState<Record<string, PrayerLogRow>>({});
  const [recentLogs, setRecentLogs] = useState<PrayerLogRow[]>([]);
  const prayerLogs = useMemo(() => Object.values(todayLogs), [todayLogs]);
  const prayerTimes = usePrayerTimes({
    city: profile?.city,
    country: profile?.country,
    timezone,
    prayerLogs
  });
  const [settingsDraft, setSettingsDraft] = useState<PrayerSettings>(DEFAULT_PRAYER_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setSettingsDraft(prayerTimes.settings);
  }, [prayerTimes.settings]);

  useEffect(() => {
    if (prayerTimes.error) {
      onError(prayerTimes.error);
    }
  }, [onError, prayerTimes.error]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;
    let active = true;

    async function load() {
      try {
        const today = todayDate(timezone);
        const [{ data: todayData, error: todayError }, { data: recentData, error: recentError }] =
          await Promise.all([
            client
              .from("prayer_logs")
              .select("*")
              .eq("prayer_date", today)
              .order("prayer_name", { ascending: true }),
            client
              .from("prayer_logs")
              .select("*")
              .order("prayer_date", { ascending: false })
              .limit(20)
          ]);

        if (todayError ?? recentError) {
          throw todayError ?? recentError;
        }

        if (!active) {
          return;
        }

        const todayMap = ((todayData as PrayerLogRow[]) ?? []).reduce<Record<string, PrayerLogRow>>(
          (accumulator, log) => {
            accumulator[log.prayer_name] = log;
            return accumulator;
          },
          {}
        );

        setTodayLogs(todayMap);
        setRecentLogs((recentData as PrayerLogRow[]) ?? []);
      } catch (error) {
        if (active) {
          onError(messageFromError(error));
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [onError, refreshToken, timezone, userId]);

  async function savePrayer(prayerName: PrayerLogRow["prayer_name"], status: PrayerStatus) {
    if (!supabase) {
      return;
    }

    try {
      const { error } = await supabase.from("prayer_logs").upsert(
        {
          user_id: userId,
          prayer_name: prayerName,
          prayer_date: todayDate(timezone),
          status
        },
        {
          onConflict: "user_id,prayer_date,prayer_name"
        }
      );

      if (error) {
        throw error;
      }

      onInfo(`Statut ${trackedPrayerLabel(prayerName)} mis à jour.`);
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    }
  }

  async function saveSettings() {
    setSavingSettings(true);

    try {
      prayerTimes.setSettings(settingsDraft);
      await prayerTimes.refresh({
        forceNetwork: true,
        settingsOverride: settingsDraft
      });
      onInfo("Réglages des horaires mis à jour.");
    } catch (error) {
      onError(messageFromError(error));
    } finally {
      setSavingSettings(false);
    }
  }

  const completionValue = prayerTimes.liveState?.completionProgress ?? 0;
  const completedCount = prayerTimes.liveState?.completedCount ?? 0;

  return (
    <div className="content-grid">
      <SectionCard
        title="Compagnon des prières"
        subtitle="Horaires du jour, progression spirituelle et suivi des cinq prières."
      >
        <PrayerSummaryCard
          liveState={prayerTimes.liveState}
          loading={prayerTimes.loading}
          warning={prayerTimes.warning}
        />
      </SectionCard>

      <SectionCard
        title="Horaires du jour"
        subtitle="Calcul local piloté par l'API AlAdhan, avec fallback ville puis cache hors ligne."
        actions={
          <div className="button-row">
            <GhostButton onClick={() => void prayerTimes.refresh({ forceNetwork: true })}>
              Actualiser
            </GhostButton>
            <SecondaryButton
              onClick={() => void prayerTimes.refresh({ forceLocationPrompt: true, forceNetwork: true })}
            >
              Utiliser ma position
            </SecondaryButton>
          </div>
        }
      >
        {prayerTimes.bundle ? (
          <>
            <div className="prayer-meta-grid">
              <ActionCard
                title={prayerTimes.bundle.today.gregorianLabel}
                description={prayerTimes.bundle.today.hijriLabel}
                meta={<StatusBadge tone="accent">{prayerTimes.location?.label ?? "Localisation"}</StatusBadge>}
              />
              <ActionCard
                title={prayerTimes.bundle.today.calculationLabel}
                description={`Madhab ${prayerTimes.bundle.today.madhab === "hanafi" ? "Hanafi" : "Standard"}`}
                meta={<StatusBadge>{prayerTimes.bundle.today.timezone ?? timezone}</StatusBadge>}
              />
            </div>

            <div className="prayer-timeline">
              {prayerTimes.bundle.today.entries.map((entry) => {
                const isTracked =
                  entry.name === "fajr" ||
                  entry.name === "dhuhr" ||
                  entry.name === "asr" ||
                  entry.name === "maghrib" ||
                  entry.name === "isha";
                const isNext = prayerTimes.liveState?.nextPrayer === entry.name;
                const isCurrent = prayerTimes.liveState?.currentPrayer === entry.name;

                return (
                  <article
                    key={entry.name}
                    className={`prayer-slot${isNext ? " prayer-slot--next" : ""}${isCurrent ? " prayer-slot--current" : ""}`}
                  >
                    <div>
                      <strong>{prayerTimingLabel(entry.name)}</strong>
                      <p>{formatPrayerTime(entry.iso, prayerTimes.bundle?.today.timezone ?? timezone)}</p>
                    </div>
                    <div className="prayer-slot__badges">
                      {isNext ? <StatusBadge tone="accent">Prochaine</StatusBadge> : null}
                      {isCurrent ? <StatusBadge tone="success">En cours</StatusBadge> : null}
                      {!isTracked ? <StatusBadge>Repère</StatusBadge> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <ActionCard
            title={formatDate(todayDate(timezone))}
            description={
              prayerTimes.loading
                ? "Recherche des horaires de la journée en cours."
                : "Les horaires n'ont pas pu être affichés pour le moment."
            }
            meta={<StatusBadge>{prayerTimes.location?.label ?? "Montreuil"}</StatusBadge>}
          >
            <p className="muted-copy">
              {prayerTimes.error ??
                "Autorise la localisation ou complète la ville dans le profil pour améliorer la précision."}
            </p>
          </ActionCard>
        )}
      </SectionCard>

      <SectionCard
        title="Suivi des cinq prières"
        subtitle="Des actions larges, lisibles sur iPhone, pour saisir l'état du jour."
      >
        <div className="prayer-completion">
          <div className="prayer-completion__summary">
            <strong>{completedCount}/5 prières suivies</strong>
            <span>
              {prayerTimes.liveState?.currentPrayerLabel
                ? `Fenêtre actuelle : ${prayerTimes.liveState.currentPrayerLabel}`
                : "En dehors d'une fenêtre de prière active"}
            </span>
          </div>
          <ProgressBar value={completionValue} />
        </div>

        <div className="prayer-log-grid">
          {PRAYERS.map((prayer) => {
            const currentStatus = todayLogs[prayer]?.status ?? "not_recorded";

            return (
              <ActionCard
                key={prayer}
                title={trackedPrayerLabel(prayer)}
                description={currentStatus === "not_recorded" ? "Aucun statut saisi pour le moment." : `Statut actuel : ${currentStatus.replaceAll("_", " ")}`}
                meta={<StatusBadge tone={currentStatus === "completed" ? "success" : currentStatus === "late" ? "warning" : currentStatus === "missed" ? "danger" : "default"}>{currentStatus}</StatusBadge>}
              >
                <div className="prayer-status-grid">
                  {PRAYER_STATUS_OPTIONS.map((option) => (
                    <button
                      key={`${prayer}-${option.value}`}
                      type="button"
                      className={`prayer-status-pill${currentStatus === option.value ? " is-active" : ""}`}
                      onClick={() => void savePrayer(prayer, option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </ActionCard>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Réglages de calcul"
        subtitle="Paramètres conservés localement pour éviter toute modification de la base."
      >
        <div className="stack-form">
          <div className="grid-two">
            <label className="form-field">
              <span>Méthode de calcul</span>
              <select
                value={settingsDraft.calculationMethod}
                onChange={(event) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    calculationMethod: event.target.value as PrayerSettings["calculationMethod"]
                  }))
                }
              >
                {PRAYER_CALCULATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Madhab</span>
              <select
                value={settingsDraft.madhab}
                onChange={(event) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    madhab: event.target.value as PrayerSettings["madhab"]
                  }))
                }
              >
                {PRAYER_MADHAB_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid-three">
            {ADJUSTMENT_FIELDS.map((field) => (
              <label className="form-field" key={field}>
                <span>{prayerTimingLabel(field)}</span>
                <input
                  type="number"
                  step="1"
                  min="-30"
                  max="30"
                  value={settingsDraft.adjustments[field]}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      adjustments: {
                        ...current.adjustments,
                        [field]: Number(event.target.value || "0")
                      }
                    }))
                  }
                />
              </label>
            ))}
          </div>

          <div className="button-row">
            <PrimaryButton onClick={() => void saveSettings()} disabled={savingSettings}>
              {savingSettings ? "Mise à jour..." : "Enregistrer les réglages"}
            </PrimaryButton>
            <GhostButton
              onClick={() => setSettingsDraft(prayerTimes.settings)}
              disabled={savingSettings}
            >
              Annuler
            </GhostButton>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Architecture notifications"
        subtitle="Préparation pour des rappels locaux avant et à l'heure de la prière, sans implémentation active pour cette phase."
      >
        <div className="list-stack">
          <ActionCard
            title="Rappels à venir"
            description="Le calcul local et le cache journalier sont prêts pour brancher ensuite des notifications PWA ou natives."
            meta={<StatusBadge>À préparer</StatusBadge>}
          >
            <div className="project-card__meta-row">
              <span>Avant la prière</span>
              <span>À l'heure exacte</span>
            </div>
          </ActionCard>
        </div>
      </SectionCard>

      <SectionCard title="Historique récent" subtitle="Vision courte sur les derniers enregistrements saisis.">
        <div className="list-stack">
          {recentLogs.length === 0 ? (
            <p className="muted-copy">Aucune trace encore disponible.</p>
          ) : (
            recentLogs.map((log) => (
              <article className="list-card" key={log.id}>
                <div>
                  <h3>
                    {trackedPrayerLabel(log.prayer_name)} · {formatDate(log.prayer_date)}
                  </h3>
                  <p>{log.status}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}
