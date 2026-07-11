import { useEffect, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import { supabase } from "../../lib/supabase";
import type { FamilyMemberRow } from "../../lib/types";
import {
  arrayToCsv,
  calculateAge,
  csvToArray,
  formatDate,
  formatDateTime,
  isoToLocalDateTimeInput,
  localDateTimeInputToIso,
  messageFromError
} from "../../lib/utils";

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  relationship: "child",
  birth_date: "",
  interests: "",
  next_contact_at: "",
  notes: ""
};

interface FamilySectionProps {
  userId: string;
  timezone: string;
  refreshToken: number;
  onDataChanged: () => void;
  onInfo: (message: string) => void;
  onError: (message: string) => void;
}

export function FamilySection({
  userId,
  timezone,
  refreshToken,
  onDataChanged,
  onInfo,
  onError
}: FamilySectionProps) {
  const [members, setMembers] = useState<FamilyMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const { data, error } = await client
          .from("family_members")
          .select("*")
          .order("next_contact_at", { ascending: true, nullsFirst: false })
          .order("birth_date", { ascending: true, nullsFirst: false });

        if (error) {
          throw error;
        }

        if (active) {
          setMembers((data as FamilyMemberRow[]) ?? []);
        }
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
  }, [onError, refreshToken, userId]);

  function resetForm() {
    setEditingId(null);
    setFormState(EMPTY_FORM);
  }

  function startEditing(member: FamilyMemberRow) {
    setEditingId(member.id);
    setFormState({
      first_name: member.first_name,
      last_name: member.last_name ?? "",
      relationship: member.relationship,
      birth_date: member.birth_date ?? "",
      interests: arrayToCsv(member.interests),
      next_contact_at: isoToLocalDateTimeInput(member.next_contact_at),
      notes: member.notes ?? ""
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    setSaving(true);

    try {
      const payload = {
        first_name: formState.first_name.trim(),
        last_name: formState.last_name.trim() || null,
        relationship: formState.relationship.trim(),
        birth_date: formState.birth_date || null,
        interests: csvToArray(formState.interests),
        next_contact_at: localDateTimeInputToIso(formState.next_contact_at),
        notes: formState.notes.trim() || null
      };

      if (editingId) {
        const { error } = await supabase
          .from("family_members")
          .update(payload)
          .eq("id", editingId);

        if (error) {
          throw error;
        }

        onInfo("Membre de famille mis a jour.");
      } else {
        const { error } = await supabase.from("family_members").insert({
          user_id: userId,
          ...payload
        });

        if (error) {
          throw error;
        }

        onInfo("Membre de famille ajoute.");
      }

      resetForm();
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    } finally {
      setSaving(false);
    }
  }

  async function markContact(memberId: string) {
    if (!supabase) {
      return;
    }

    try {
      const { error } = await supabase
        .from("family_members")
        .update({ last_contact_at: new Date().toISOString() })
        .eq("id", memberId);

      if (error) {
        throw error;
      }

      onInfo("Dernier contact mis a jour.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    }
  }

  async function removeMember(memberId: string) {
    if (!supabase) {
      return;
    }

    try {
      const { error } = await supabase.from("family_members").delete().eq("id", memberId);

      if (error) {
        throw error;
      }

      if (editingId === memberId) {
        resetForm();
      }

      onInfo("Membre supprime.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    }
  }

  return (
    <div className="content-grid">
      <SectionCard
        title={editingId ? "Modifier un proche" : "Ajouter un proche"}
        subtitle="Entretenir le lien fait partie de l'action juste."
      >
        <form className="stack-form" onSubmit={handleSubmit}>
          <div className="grid-three">
            <label>
              <span>Prenom</span>
              <input
                value={formState.first_name}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    first_name: event.target.value
                  }))
                }
                required
              />
            </label>
            <label>
              <span>Nom</span>
              <input
                value={formState.last_name}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    last_name: event.target.value
                  }))
                }
              />
            </label>
            <label>
              <span>Relation</span>
              <input
                value={formState.relationship}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    relationship: event.target.value
                  }))
                }
                required
              />
            </label>
          </div>

          <div className="grid-two">
            <label>
              <span>Date de naissance</span>
              <input
                type="date"
                value={formState.birth_date}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    birth_date: event.target.value
                  }))
                }
              />
            </label>
            <label>
              <span>Prochain contact</span>
              <input
                type="datetime-local"
                value={formState.next_contact_at}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    next_contact_at: event.target.value
                  }))
                }
              />
            </label>
          </div>

          <label>
            <span>Centres d'interet</span>
            <input
              value={formState.interests}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  interests: event.target.value
                }))
              }
              placeholder="lecture, sport, ecole"
            />
          </label>

          <label>
            <span>Notes</span>
            <textarea
              rows={4}
              value={formState.notes}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  notes: event.target.value
                }))
              }
            />
          </label>

          <div className="button-row">
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Enregistrement..." : editingId ? "Mettre a jour" : "Ajouter"}
            </button>
            {editingId ? (
              <button type="button" className="ghost-button" onClick={resetForm}>
                Annuler
              </button>
            ) : null}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Reseau familial" subtitle="Les rappels et traces de contact se pilotent ici.">
        {loading ? (
          <p className="muted-copy">Chargement...</p>
        ) : members.length === 0 ? (
          <p className="muted-copy">Aucun proche enregistre.</p>
        ) : (
          <div className="list-stack">
            {members.map((member) => {
              const age = calculateAge(member.birth_date);

              return (
                <article className="list-card" key={member.id}>
                  <div>
                    <h3>
                      {member.first_name} {member.last_name ?? ""}
                    </h3>
                    <p>
                      {member.relationship}
                      {age !== null ? ` · ${age} ans` : ""}
                      {member.birth_date ? ` · naissance ${formatDate(member.birth_date)}` : ""}
                    </p>
                    <p>
                      Dernier contact {formatDateTime(member.last_contact_at)} · prochain contact{" "}
                      {formatDateTime(member.next_contact_at)}
                    </p>
                    {member.interests.length > 0 ? (
                      <p>Interets : {member.interests.join(", ")}</p>
                    ) : null}
                    {member.notes ? <p>{member.notes}</p> : null}
                  </div>
                  <div className="button-row">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => startEditing(member)}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => markContact(member.id)}
                    >
                      Contacte
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => removeMember(member.id)}
                    >
                      Supprimer
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
