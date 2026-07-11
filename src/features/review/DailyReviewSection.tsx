import { useEffect, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import { supabase } from "../../lib/supabase";
import type { DailyReviewRow } from "../../lib/types";
import { formatDate, messageFromError, todayDate } from "../../lib/utils";

const EMPTY_REVIEW_FORM = {
  prayer_completed: false,
  priority_completed: false,
  family_present: false,
  money_managed: false,
  health_action: false,
  learning_action: false,
  mood: 3,
  energy: 3,
  note: "",
  tomorrow_correction: ""
};

interface DailyReviewSectionProps {
  userId: string;
  timezone: string;
  refreshToken: number;
  onDataChanged: () => void;
  onInfo: (message: string) => void;
  onError: (message: string) => void;
}

export function DailyReviewSection({
  userId,
  timezone,
  refreshToken,
  onDataChanged,
  onInfo,
  onError
}: DailyReviewSectionProps) {
  const [recentReviews, setRecentReviews] = useState<DailyReviewRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState(EMPTY_REVIEW_FORM);

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
              .from("daily_reviews")
              .select("*")
              .eq("review_date", today)
              .maybeSingle(),
            client
              .from("daily_reviews")
              .select("*")
              .order("review_date", { ascending: false })
              .limit(7)
          ]);

        if (todayError ?? recentError) {
          throw todayError ?? recentError;
        }

        if (!active) {
          return;
        }

        const todayReview = todayData as DailyReviewRow | null;

        if (todayReview) {
          setFormState({
            prayer_completed: Boolean(todayReview.prayer_completed),
            priority_completed: Boolean(todayReview.priority_completed),
            family_present: Boolean(todayReview.family_present),
            money_managed: Boolean(todayReview.money_managed),
            health_action: Boolean(todayReview.health_action),
            learning_action: Boolean(todayReview.learning_action),
            mood: todayReview.mood ?? 3,
            energy: todayReview.energy ?? 3,
            note: todayReview.note ?? "",
            tomorrow_correction: todayReview.tomorrow_correction ?? ""
          });
        } else {
          setFormState(EMPTY_REVIEW_FORM);
        }

        setRecentReviews((recentData as DailyReviewRow[]) ?? []);
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("daily_reviews").upsert(
        {
          user_id: userId,
          review_date: todayDate(timezone),
          ...formState
        },
        {
          onConflict: "user_id,review_date"
        }
      );

      if (error) {
        throw error;
      }

      onInfo("Revue quotidienne enregistrée.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="content-grid">
      <SectionCard title="Revue quotidienne" subtitle="On boucle la journée sur des marqueurs simples, actionnables demain.">
        <form className="stack-form" onSubmit={handleSubmit}>
          <div className="grid-three">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={formState.prayer_completed}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    prayer_completed: event.target.checked
                  }))
                }
              />
              <span>Prière suivie</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={formState.priority_completed}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    priority_completed: event.target.checked
                  }))
                }
              />
              <span>Priorité tenue</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={formState.family_present}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    family_present: event.target.checked
                  }))
                }
              />
              <span>Présence familiale</span>
            </label>
          </div>

          <div className="grid-three">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={formState.money_managed}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    money_managed: event.target.checked
                  }))
                }
              />
              <span>Argent géré</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={formState.health_action}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    health_action: event.target.checked
                  }))
                }
              />
              <span>Action santé</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={formState.learning_action}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    learning_action: event.target.checked
                  }))
                }
              />
              <span>Apprentissage</span>
            </label>
          </div>

          <div className="grid-two">
            <label>
              <span>Humeur</span>
              <input
                type="range"
                min="1"
                max="5"
                value={formState.mood}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    mood: Number(event.target.value)
                  }))
                }
              />
            </label>
            <label>
              <span>Énergie</span>
              <input
                type="range"
                min="1"
                max="5"
                value={formState.energy}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    energy: Number(event.target.value)
                  }))
                }
              />
            </label>
          </div>

          <label>
            <span>Note</span>
            <textarea
              rows={4}
              value={formState.note}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  note: event.target.value
                }))
              }
            />
          </label>

          <label>
            <span>Correction pour demain</span>
            <textarea
              rows={4}
              value={formState.tomorrow_correction}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  tomorrow_correction: event.target.value
                }))
              }
            />
          </label>

          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Enregistrement..." : "Clore la journée"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="7 dernières revues" subtitle="Un retour court sur la continuité du suivi.">
        {recentReviews.length === 0 ? (
          <p className="muted-copy">Aucune revue enregistrée.</p>
        ) : (
          <div className="list-stack">
            {recentReviews.map((review) => (
              <article className="list-card" key={review.id}>
                <div>
                  <h3>{formatDate(review.review_date)}</h3>
                  <p>
                    humeur {review.mood ?? "—"} · énergie {review.energy ?? "—"} · correction{" "}
                    {review.tomorrow_correction ?? "—"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
