import { useEffect, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import { supabase } from "../../lib/supabase";
import type { ProjectRow, TaskRow, TaskStatus } from "../../lib/types";
import {
  formatDate,
  formatDateTime,
  localDateTimeInputToIso,
  messageFromError,
  toNumber
} from "../../lib/utils";

interface TasksSectionProps {
  userId: string;
  timezone: string;
  refreshToken: number;
  onDataChanged: () => void;
  onInfo: (message: string) => void;
  onError: (message: string) => void;
}

const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "completed",
  "postponed",
  "cancelled"
];

export function TasksSection({
  userId,
  timezone,
  refreshToken,
  onDataChanged,
  onInfo,
  onError
}: TasksSectionProps) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState({
    title: "",
    description: "",
    domain: "",
    project_id: "",
    due_date: "",
    scheduled_at: "",
    status: "todo" as TaskStatus,
    urgency: 3,
    importance: 3,
    spiritual_impact: 0,
    family_impact: 0,
    financial_impact: 0,
    administrative_impact: 0,
    effort: 3,
    duration_minutes: "",
    proof_required: false,
    proof_url: ""
  });

  void timezone;

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const [{ data: taskData, error: taskError }, { data: projectData, error: projectError }] =
          await Promise.all([
            client.from("tasks").select("*").order("priority_score", { ascending: false }),
            client.from("projects").select("*").order("title", { ascending: true })
          ]);

        if (taskError ?? projectError) {
          throw taskError ?? projectError;
        }

        if (!active) {
          return;
        }

        setTasks((taskData as TaskRow[]) ?? []);
        setProjects((projectData as ProjectRow[]) ?? []);
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

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("tasks").insert({
        user_id: userId,
        project_id: formState.project_id || null,
        title: formState.title.trim(),
        description: formState.description.trim() || null,
        domain: formState.domain.trim() || null,
        due_date: formState.due_date || null,
        scheduled_at: localDateTimeInputToIso(formState.scheduled_at),
        status: formState.status,
        urgency: formState.urgency,
        importance: formState.importance,
        spiritual_impact: formState.spiritual_impact,
        family_impact: formState.family_impact,
        financial_impact: formState.financial_impact,
        administrative_impact: formState.administrative_impact,
        effort: formState.effort,
        duration_minutes: formState.duration_minutes ? Number(formState.duration_minutes) : null,
        proof_required: formState.proof_required,
        proof_url: formState.proof_url.trim() || null
      });

      if (error) {
        throw error;
      }

      setFormState({
        title: "",
        description: "",
        domain: "",
        project_id: "",
        due_date: "",
        scheduled_at: "",
        status: "todo",
        urgency: 3,
        importance: 3,
        spiritual_impact: 0,
        family_impact: 0,
        financial_impact: 0,
        administrative_impact: 0,
        effort: 3,
        duration_minutes: "",
        proof_required: false,
        proof_url: ""
      });
      onInfo("Tache creee.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(task: TaskRow, status: TaskStatus) {
    if (!supabase) {
      return;
    }

    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null
        })
        .eq("id", task.id);

      if (error) {
        throw error;
      }

      onInfo("Statut de tache mis a jour.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    }
  }

  async function postponeTask(task: TaskRow) {
    if (!supabase) {
      return;
    }

    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "postponed",
          postponed_count: task.postponed_count + 1,
          completed_at: null
        })
        .eq("id", task.id);

      if (error) {
        throw error;
      }

      onInfo("Tache reportee.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    }
  }

  async function removeTask(taskId: string) {
    if (!supabase) {
      return;
    }

    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);

      if (error) {
        throw error;
      }

      onInfo("Tache supprimee.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    }
  }

  const projectNames = new Map(projects.map((project) => [project.id, project.title]));

  return (
    <div className="content-grid">
      <SectionCard title="Nouvelle tache" subtitle="Le score de priorite reste calcule par la base.">
        <form className="stack-form" onSubmit={handleCreate}>
          <div className="grid-two">
            <label>
              <span>Titre</span>
              <input
                value={formState.title}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    title: event.target.value
                  }))
                }
                required
              />
            </label>
            <label>
              <span>Domaine</span>
              <input
                value={formState.domain}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    domain: event.target.value
                  }))
                }
              />
            </label>
          </div>

          <label>
            <span>Description</span>
            <textarea
              rows={3}
              value={formState.description}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  description: event.target.value
                }))
              }
            />
          </label>

          <div className="grid-three">
            <label>
              <span>Projet</span>
              <select
                value={formState.project_id}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    project_id: event.target.value
                  }))
                }
              >
                <option value="">Aucun</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Echeance</span>
              <input
                type="date"
                value={formState.due_date}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    due_date: event.target.value
                  }))
                }
              />
            </label>
            <label>
              <span>Planifiee a</span>
              <input
                type="datetime-local"
                value={formState.scheduled_at}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    scheduled_at: event.target.value
                  }))
                }
              />
            </label>
          </div>

          <div className="grid-three">
            <label>
              <span>Statut</span>
              <select
                value={formState.status}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    status: event.target.value as TaskStatus
                  }))
                }
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Duree estimee (min)</span>
              <input
                type="number"
                min="1"
                value={formState.duration_minutes}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    duration_minutes: event.target.value
                  }))
                }
              />
            </label>
            <label>
              <span>Effort</span>
              <input
                type="number"
                min="0"
                max="5"
                value={formState.effort}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    effort: Number(event.target.value)
                  }))
                }
              />
            </label>
          </div>

          <div className="grid-three">
            <label>
              <span>Urgence</span>
              <input
                type="number"
                min="0"
                max="5"
                value={formState.urgency}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    urgency: Number(event.target.value)
                  }))
                }
              />
            </label>
            <label>
              <span>Importance</span>
              <input
                type="number"
                min="0"
                max="5"
                value={formState.importance}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    importance: Number(event.target.value)
                  }))
                }
              />
            </label>
            <label>
              <span>Impact spirituel</span>
              <input
                type="number"
                min="0"
                max="5"
                value={formState.spiritual_impact}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    spiritual_impact: Number(event.target.value)
                  }))
                }
              />
            </label>
          </div>

          <div className="grid-three">
            <label>
              <span>Impact famille</span>
              <input
                type="number"
                min="0"
                max="5"
                value={formState.family_impact}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    family_impact: Number(event.target.value)
                  }))
                }
              />
            </label>
            <label>
              <span>Impact finances</span>
              <input
                type="number"
                min="0"
                max="5"
                value={formState.financial_impact}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    financial_impact: Number(event.target.value)
                  }))
                }
              />
            </label>
            <label>
              <span>Impact administratif</span>
              <input
                type="number"
                min="0"
                max="5"
                value={formState.administrative_impact}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    administrative_impact: Number(event.target.value)
                  }))
                }
              />
            </label>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={formState.proof_required}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  proof_required: event.target.checked
                }))
              }
            />
            <span>Une preuve sera exigee a la cloture</span>
          </label>

          <label>
            <span>URL de preuve</span>
            <input
              value={formState.proof_url}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  proof_url: event.target.value
                }))
              }
            />
          </label>

          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Creation..." : "Creer la tache"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Backlog operationnel" subtitle="La base reste la source de verite pour le score et les contraintes.">
        {loading ? (
          <p className="muted-copy">Chargement...</p>
        ) : tasks.length === 0 ? (
          <p className="muted-copy">Aucune tache enregistree.</p>
        ) : (
          <div className="list-stack">
            {tasks.map((task) => (
              <article className="list-card" key={task.id}>
                <div>
                  <h3>{task.title}</h3>
                  <p>
                    Projet {projectNames.get(task.project_id ?? "") ?? "Aucun"} · statut {task.status} ·
                    score {toNumber(task.priority_score).toFixed(2)}
                  </p>
                  <p>
                    Echeance {formatDate(task.due_date)} · planifiee {formatDateTime(task.scheduled_at)} ·
                    reports {task.postponed_count}
                  </p>
                  <p>
                    Preuve {task.proof_required ? "requise" : "non"} · cloturee {formatDateTime(task.completed_at)}
                  </p>
                  {task.proof_url ? <p>{task.proof_url}</p> : null}
                </div>
                <div className="button-row">
                  <select
                    value={task.status}
                    onChange={(event) =>
                      void updateStatus(task, event.target.value as TaskStatus)
                    }
                  >
                    {TASK_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => postponeTask(task)}
                  >
                    Reporter
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => removeTask(task.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
