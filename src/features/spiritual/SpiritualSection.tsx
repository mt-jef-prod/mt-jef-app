import { useEffect, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import { supabase } from "../../lib/supabase";
import type { PrayerLogRow, PrayerStatus } from "../../lib/types";
import { formatDate, messageFromError, todayDate } from "../../lib/utils";

interface SpiritualSectionProps {
  userId: string;
  timezone: string;
  refreshToken: number;
  onDataChanged: () => void;
  onInfo: (message: string) => void;
  onError: (message: string) => void;
}

const PRAYERS: PrayerLogRow["prayer_name"][] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const PRAYER_STATUSES: PrayerStatus[] = ["completed", "late", "missed", "not_recorded"];

export function SpiritualSection({
  userId,
  timezone,
  refreshToken,
  onDataChanged,
  onInfo,
  onError
}: SpiritualSectionProps) {
  const [todayLogs, setTodayLogs] = useState<Record<string, PrayerLogRow>>({});
  const [recentLogs, setRecentLogs] = useState<PrayerLogRow[]>([]);

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

      onInfo(`Statut ${prayerName} mis à jour.`);
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    }
  }

  return (
    <div className="content-grid">
      <SectionCard title="Suivi des prières du jour" subtitle="Le journal du jour est saisi en lecture directe sur la base.">
        <div className="list-stack">
          {PRAYERS.map((prayer) => (
            <article className="list-card" key={prayer}>
              <div>
                <h3>{prayer}</h3>
                <p>{todayLogs[prayer]?.status ?? "not_recorded"}</p>
              </div>
              <select
                value={todayLogs[prayer]?.status ?? "not_recorded"}
                onChange={(event) =>
                  void savePrayer(prayer, event.target.value as PrayerStatus)
                }
              >
                {PRAYER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Historique récent" subtitle="Vision courte sur les derniers enregistrements.">
        {recentLogs.length === 0 ? (
          <p className="muted-copy">Aucune trace encore disponible.</p>
        ) : (
          <div className="list-stack">
            {recentLogs.map((log) => (
              <article className="list-card" key={log.id}>
                <div>
                  <h3>
                    {log.prayer_name} · {formatDate(log.prayer_date)}
                  </h3>
                  <p>{log.status}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
