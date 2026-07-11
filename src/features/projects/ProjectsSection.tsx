import { useEffect, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import { supabase } from "../../lib/supabase";
import type { ProjectRow, ProjectStatus, ProjectStepRow, TaskStatus } from "../../lib/types";
import { formatDate, formatMoney, messageFromError } from "../../lib/utils";

interface ProjectsSectionProps {
  userId: string;
  refreshToken: number;
  onDataChanged: () => void;
  onInfo: (message: string) => void;
  onError: (message: string) => void;
}

const PROJECT_STATUSES: ProjectStatus[] = [
  "idea",
  "preparation",
  "active",
  "blocked",
  "paused",
  "completed",
  "abandoned",
  "archived"
];

const STEP_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "completed",
  "postponed",
  "cancelled"
];

type ProjectDraft = {
  category: string;
  target_date: string;
  estimated_budget: string;
  currency: string;
  first_action_title: string;
  cost_estimation_status: ProjectRow["cost_estimation_status"];
};

type StepEdit = {
  title: string;
  status: TaskStatus;
};

export function ProjectsSection({
  userId,
  refreshToken,
  onDataChanged,
  onInfo,
  onError
}: ProjectsSectionProps) {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [steps, setSteps] = useState<ProjectStepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectDrafts, setProjectDrafts] = useState<Record<string, ProjectDraft>>({});
  const [stepDrafts, setStepDrafts] = useState<Record<string, string>>({});
  const [stepEdits, setStepEdits] = useState<Record<string, StepEdit>>({});
  const [formState, setFormState] = useState({
    title: "",
    status: "idea" as ProjectStatus,
    category: "",
    target_date: "",
    estimated_budget: "",
    currency: "EUR",
    first_action_title: "",
    cost_estimation_status: "unknown_to_estimate" as ProjectRow["cost_estimation_status"]
  });

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const [{ data: projectData, error: projectError }, { data: stepData, error: stepError }] =
          await Promise.all([
            client.from("projects").select("*").order("updated_at", { ascending: false }),
            client.from("project_steps").select("*").order("order_index", { ascending: true })
          ]);

        if (projectError ?? stepError) {
          throw projectError ?? stepError;
        }

        if (!active) {
          return;
        }

        const nextProjects = (projectData as ProjectRow[]) ?? [];
        const nextSteps = (stepData as ProjectStepRow[]) ?? [];

        setProjects(nextProjects);
        setSteps(nextSteps);
        setProjectDrafts(
          nextProjects.reduce<Record<string, ProjectDraft>>((accumulator, project) => {
            accumulator[project.id] = {
              category: project.category ?? "",
              target_date: project.target_date ?? "",
              estimated_budget: String(project.estimated_budget ?? ""),
              currency: project.currency,
              first_action_title: project.first_action_title ?? "",
              cost_estimation_status: project.cost_estimation_status
            };
            return accumulator;
          }, {})
        );
        setStepEdits(
          nextSteps.reduce<Record<string, StepEdit>>((accumulator, step) => {
            accumulator[step.id] = {
              title: step.title,
              status: step.status
            };
            return accumulator;
          }, {})
        );
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
      const firstActionTitle = formState.first_action_title.trim();

      const { error } = await supabase.from("projects").insert({
        user_id: userId,
        title: formState.title.trim(),
        status: formState.status,
        category: formState.category.trim() || null,
        target_date: formState.target_date || null,
        estimated_budget: formState.estimated_budget ? Number(formState.estimated_budget) : 0,
        currency: formState.currency.trim().toUpperCase(),
        first_action_title: firstActionTitle || null,
        first_action_defined: firstActionTitle.length > 0,
        cost_estimation_status: formState.cost_estimation_status
      });

      if (error) {
        throw error;
      }

      setFormState({
        title: "",
        status: "idea",
        category: "",
        target_date: "",
        estimated_budget: "",
        currency: "EUR",
        first_action_title: "",
        cost_estimation_status: "unknown_to_estimate"
      });
      onInfo("Projet cree.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    } finally {
      setSaving(false);
    }
  }

  async function saveProject(projectId: string) {
    if (!supabase) {
      return;
    }

    const draft = projectDrafts[projectId];

    if (!draft) {
      return;
    }

    try {
      const firstActionTitle = draft.first_action_title.trim();

      const { error } = await supabase
        .from("projects")
        .update({
          category: draft.category.trim() || null,
          target_date: draft.target_date || null,
          estimated_budget: draft.estimated_budget ? Number(draft.estimated_budget) : 0,
          currency: draft.currency.trim().toUpperCase(),
          first_action_title: firstActionTitle || null,
          first_action_defined: firstActionTitle.length > 0,
          cost_estimation_status: draft.cost_estimation_status
        })
        .eq("id", projectId);

      if (error) {
        throw error;
      }

      onInfo("Projet mis a jour.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    }
  }

  async function updateStatus(projectId: string, status: ProjectStatus) {
    if (!supabase) {
      return;
    }

    try {
      const { error } = await supabase.from("projects").update({ status }).eq("id", projectId);

      if (error) {
        throw error;
      }

      onInfo("Statut du projet mis a jour.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    }
  }

  async function addStep(projectId: string) {
    if (!supabase) {
      return;
    }

    const title = (stepDrafts[projectId] ?? "").trim();

    if (!title) {
      return;
    }

    try {
      const nextOrderIndex =
        steps
          .filter((step) => step.project_id === projectId)
          .reduce((max, step) => Math.max(max, step.order_index), -1) + 1;

      const { error } = await supabase.from("project_steps").insert({
        project_id: projectId,
        user_id: userId,
        title,
        order_index: nextOrderIndex
      });

      if (error) {
        throw error;
      }

      setStepDrafts((current) => ({ ...current, [projectId]: "" }));
      onInfo("Etape ajoutee.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    }
  }

  async function saveStep(stepId: string) {
    if (!supabase) {
      return;
    }

    const draft = stepEdits[stepId];

    if (!draft) {
      return;
    }

    try {
      const { error } = await supabase
        .from("project_steps")
        .update({
          title: draft.title.trim(),
          status: draft.status
        })
        .eq("id", stepId);

      if (error) {
        throw error;
      }

      onInfo("Etape mise a jour.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    }
  }

  async function removeStep(stepId: string) {
    if (!supabase) {
      return;
    }

    try {
      const { error } = await supabase.from("project_steps").delete().eq("id", stepId);

      if (error) {
        throw error;
      }

      onInfo("Etape supprimee.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    }
  }

  async function removeProject(projectId: string) {
    if (!supabase) {
      return;
    }

    try {
      const { error } = await supabase.from("projects").delete().eq("id", projectId);

      if (error) {
        throw error;
      }

      onInfo("Projet supprime.");
      onDataChanged();
    } catch (error) {
      onError(messageFromError(error));
    }
  }

  const stepsByProject = projects.reduce<Record<string, ProjectStepRow[]>>((accumulator, project) => {
    accumulator[project.id] = steps.filter((step) => step.project_id === project.id);
    return accumulator;
  }, {});

  return (
    <div className="content-grid">
      <SectionCard title="Creer un projet" subtitle="Formalise l'objectif, le cap et la premiere action.">
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
              <span>Statut</span>
              <select
                value={formState.status}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    status: event.target.value as ProjectStatus
                  }))
                }
              >
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid-three">
            <label>
              <span>Categorie</span>
              <input
                value={formState.category}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    category: event.target.value
                  }))
                }
              />
            </label>
            <label>
              <span>Echeance</span>
              <input
                type="date"
                value={formState.target_date}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    target_date: event.target.value
                  }))
                }
              />
            </label>
            <label>
              <span>Devise</span>
              <input
                value={formState.currency}
                maxLength={3}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase()
                  }))
                }
              />
            </label>
          </div>

          <div className="grid-two">
            <label>
              <span>Budget estime</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formState.estimated_budget}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    estimated_budget: event.target.value
                  }))
                }
              />
            </label>
            <label>
              <span>Statut estimation cout</span>
              <select
                value={formState.cost_estimation_status}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    cost_estimation_status: event.target.value as ProjectRow["cost_estimation_status"]
                  }))
                }
              >
                <option value="unknown_to_estimate">unknown_to_estimate</option>
                <option value="known">known</option>
                <option value="free">free</option>
              </select>
            </label>
          </div>

          <label>
            <span>Premiere action</span>
            <input
              value={formState.first_action_title}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  first_action_title: event.target.value
                }))
              }
              placeholder="Exemple : appeler le contact cle"
            />
          </label>

          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Creation..." : "Creer le projet"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Portefeuille projets" subtitle="Modification du projet et gestion fine des etapes.">
        {loading ? (
          <p className="muted-copy">Chargement...</p>
        ) : projects.length === 0 ? (
          <p className="muted-copy">Aucun projet enregistre.</p>
        ) : (
          <div className="list-stack">
            {projects.map((project) => {
              const projectSteps = stepsByProject[project.id] ?? [];
              const completedSteps = projectSteps.filter((step) => step.status === "completed").length;
              const draft = projectDrafts[project.id];

              return (
                <article className="list-card list-card--stacked" key={project.id}>
                  <div className="list-card__header">
                    <div>
                      <h3>{project.title}</h3>
                      <p>
                        {project.status} · progression {project.progress}% · {completedSteps}/
                        {projectSteps.length} etapes terminees · echeance {formatDate(project.target_date)}
                      </p>
                      <p>
                        Budget estime {formatMoney(project.estimated_budget, project.currency)} ·
                        disponible {formatMoney(project.available_funding, project.currency)}
                      </p>
                    </div>
                    <div className="button-row">
                      <select
                        value={project.status}
                        onChange={(event) =>
                          void updateStatus(project.id, event.target.value as ProjectStatus)
                        }
                      >
                        {PROJECT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => removeProject(project.id)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>

                  {draft ? (
                    <div className="stack-form stack-form--dense">
                      <div className="grid-three">
                        <label>
                          <span>Categorie</span>
                          <input
                            value={draft.category}
                            onChange={(event) =>
                              setProjectDrafts((current) => ({
                                ...current,
                                [project.id]: {
                                  ...current[project.id],
                                  category: event.target.value
                                }
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>Echeance</span>
                          <input
                            type="date"
                            value={draft.target_date}
                            onChange={(event) =>
                              setProjectDrafts((current) => ({
                                ...current,
                                [project.id]: {
                                  ...current[project.id],
                                  target_date: event.target.value
                                }
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>Devise</span>
                          <input
                            value={draft.currency}
                            maxLength={3}
                            onChange={(event) =>
                              setProjectDrafts((current) => ({
                                ...current,
                                [project.id]: {
                                  ...current[project.id],
                                  currency: event.target.value.toUpperCase()
                                }
                              }))
                            }
                          />
                        </label>
                      </div>

                      <div className="grid-two">
                        <label>
                          <span>Budget estime</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.estimated_budget}
                            onChange={(event) =>
                              setProjectDrafts((current) => ({
                                ...current,
                                [project.id]: {
                                  ...current[project.id],
                                  estimated_budget: event.target.value
                                }
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>Statut estimation cout</span>
                          <select
                            value={draft.cost_estimation_status}
                            onChange={(event) =>
                              setProjectDrafts((current) => ({
                                ...current,
                                [project.id]: {
                                  ...current[project.id],
                                  cost_estimation_status:
                                    event.target.value as ProjectRow["cost_estimation_status"]
                                }
                              }))
                            }
                          >
                            <option value="unknown_to_estimate">unknown_to_estimate</option>
                            <option value="known">known</option>
                            <option value="free">free</option>
                          </select>
                        </label>
                      </div>

                      <label>
                        <span>Premiere action</span>
                        <input
                          value={draft.first_action_title}
                          onChange={(event) =>
                            setProjectDrafts((current) => ({
                              ...current,
                              [project.id]: {
                                ...current[project.id],
                                first_action_title: event.target.value
                              }
                            }))
                          }
                        />
                      </label>

                      <div className="button-row">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => saveProject(project.id)}
                        >
                          Enregistrer
                        </button>
                        <div className="inline-pills">
                          <span>{project.cost_estimation_status}</span>
                          {project.first_action_title ? <span>{project.first_action_title}</span> : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="nested-panel">
                    <div className="nested-panel__header">
                      <h4>Etapes</h4>
                      <span>{projectSteps.length}</span>
                    </div>

                    <div className="list-stack">
                      {projectSteps.map((step) => {
                        const edit = stepEdits[step.id];

                        return (
                          <article className="mini-card mini-card--stacked" key={step.id}>
                            <div className="stack-form stack-form--dense">
                              <input
                                value={edit?.title ?? step.title}
                                onChange={(event) =>
                                  setStepEdits((current) => ({
                                    ...current,
                                    [step.id]: {
                                      title: event.target.value,
                                      status: current[step.id]?.status ?? step.status
                                    }
                                  }))
                                }
                              />
                              <div className="button-row">
                                <select
                                  value={edit?.status ?? step.status}
                                  onChange={(event) =>
                                    setStepEdits((current) => ({
                                      ...current,
                                      [step.id]: {
                                        title: current[step.id]?.title ?? step.title,
                                        status: event.target.value as TaskStatus
                                      }
                                    }))
                                  }
                                >
                                  {STEP_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => saveStep(step.id)}
                                >
                                  Enregistrer
                                </button>
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() => removeStep(step.id)}
                                >
                                  Supprimer
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    <div className="inline-form">
                      <input
                        value={stepDrafts[project.id] ?? ""}
                        onChange={(event) =>
                          setStepDrafts((current) => ({
                            ...current,
                            [project.id]: event.target.value
                          }))
                        }
                        placeholder="Ajouter une etape"
                      />
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => addStep(project.id)}
                      >
                        Ajouter
                      </button>
                    </div>
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
