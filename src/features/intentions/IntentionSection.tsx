import { useEffect, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import { supabase } from "../../lib/supabase";
import type { DailyIntentionRow } from "../../lib/types";
import { formatDate, messageFromError, todayDate } from "../../lib/utils";

interface IntentionSectionProps {
  userId: string;
  timezone: string;
  refreshToken: number;
  onDataChanged: () => void;
  onInfo: (message: string) => void;
  onError: (message: string) => void;
}

export function IntentionSection({
  userId,
  timezone,
  refreshToken,
  onDataChanged,
  onInfo,
  onError
}: IntentionSectionProps) {
  const [loading, setLoading] = useState(true);
  const [todayEntry, setTodayEntry] = useState<DailyIntentionRow | null>(null);
  const [recentEntries, setRecentEntries] = useState<DailyIntentionRow[]>([]);
  const [intention, setIntention] = useState("");
  const [saving, setSaving] = useState(false);

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
        const [{ data: todayData, error: todayError }, { data: recentData, error: recentError }] =
          await Promise.all([
            client
              .from("daily_intentions")
              .select("*")
              .eq("intention_date", today)
              .maybeSingle(),
            client
              .from("daily_intentions")
              .select("*")
              .order("intention_date", { ascending: false })
              .limit(7)
          ]);

        if (todayError ?? recentError) {
          throw todayError ?? recentError;
        }

        if (!active) {
          return;
        }

        setTodayEntry((todayData as DailyIntentionRow | null) ?? null);
        setRecentEntries((recentData as DailyIntentionRow[]) ?? []);
        setIntention((todayData as DailyIntentionRow | null)?.intention ?? "");
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("daily_intentions").upsert(
        {
          user_id: userId,
          intention_date: todayDate(timezone),
          intention
        },
        {
          onConflict: "user_id,intention_date"
        }
      );

      if (error) {
        throw error;
      }

      onInfo("Intention du jour enregistrée.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="content-grid">
      <SectionCard title="Niyya du jour" subtitle="Une seule intention claire pour fixer l'axe de la journée.">
        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            <span>Intention du {formatDate(todayDate(timezone))}</span>
            <textarea
              rows={5}
              value={intention}
              onChange={(event) => setIntention(event.target.value)}
              placeholder="Aujourd'hui, je veux avancer avec intention sur…"
              required
            />
          </label>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Enregistrement..." : "Ancrer l'intention"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Historique récent" subtitle="Les dernières intentions formulées.">
        {loading ? (
          <p className="muted-copy">Chargement…</p>
        ) : recentEntries.length === 0 ? (
          <p className="muted-copy">Aucune intention enregistrée.</p>
        ) : (
          <div className="list-stack">
            {recentEntries.map((entry) => (
              <article className="list-card" key={entry.id}>
                <div>
                  <h3>{formatDate(entry.intention_date)}</h3>
                  <p>{entry.intention}</p>
                </div>
              </article>
            ))}
          </div>
        )}
        {todayEntry ? <p className="muted-copy">L'entrée du jour sera mise à jour au prochain enregistrement.</p> : null}
      </SectionCard>
    </div>
  );
}
