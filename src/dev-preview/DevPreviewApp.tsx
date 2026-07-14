import React from "react";
import { AppShell } from "../components/AppShell";
import { AuthScreen } from "../components/AuthScreen";
import { SectionCard } from "../components/SectionCard";
import {
  ActionCard,
  Card,
  EmptyState,
  FormField,
  GhostButton,
  ListRow,
  LoadingSkeleton,
  MetricCard,
  PageHeader,
  PrimaryButton,
  ProgressBar,
  SearchField,
  SecondaryButton,
  SegmentedControl,
  StatusBadge
} from "../components/ui";
import type { NoticeState, SectionDefinition } from "../lib/types";
import { PreviewAssistantWidget } from "./PreviewAssistantWidget";
import {
  PREVIEW_BUDGETS,
  PREVIEW_DEVICE_OPTIONS,
  PREVIEW_FAMILY,
  PREVIEW_FINANCE_METRICS,
  PREVIEW_PRAYERS,
  PREVIEW_PROFILE,
  PREVIEW_PROJECTS,
  PREVIEW_REVIEW_LINES,
  PREVIEW_SCENE_OPTIONS,
  PREVIEW_SECTIONS,
  PREVIEW_TASKS,
  PREVIEW_TODAY_INTENTION,
  PREVIEW_TRANSACTIONS,
  prayerTone,
  projectTone,
  taskTone,
  type PreviewDevice,
  type PreviewFrameScene,
  type PreviewScene,
  type PreviewVariant,
  PREVIEW_VARIANT_OPTIONS
} from "./previewFixtures";

const PREVIEW_PATH = "/__preview";

const DARK_THEME_VARS = {
  "--bg-canvas": "#0f1720",
  "--bg-subtle": "#131d28",
  "--bg-elevated": "rgba(18, 26, 36, 0.9)",
  "--bg-elevated-strong": "rgba(20, 29, 40, 0.96)",
  "--bg-tint": "rgba(111, 168, 209, 0.12)",
  "--bg-accent": "#7ab1d5",
  "--bg-accent-soft": "rgba(122, 177, 213, 0.14)",
  "--bg-sage": "rgba(132, 168, 150, 0.14)",
  "--bg-success": "rgba(91, 165, 121, 0.18)",
  "--bg-warning": "rgba(214, 158, 76, 0.18)",
  "--bg-danger": "rgba(214, 108, 92, 0.18)",
  "--border-soft": "rgba(148, 163, 184, 0.16)",
  "--border-strong": "rgba(148, 163, 184, 0.24)",
  "--ink": "#f8fafc",
  "--ink-soft": "#cbd5e1",
  "--ink-faint": "#94a3b8",
  "--white": "#ffffff",
  "--accent": "#7ab1d5",
  "--accent-strong": "#93c5e6",
  "--accent-soft": "rgba(122, 177, 213, 0.18)",
  "--sage": "#95b3a6",
  "--teal": "#8cb7b9",
  "--warning": "#e5b05f",
  "--danger": "#ec8c7d",
  "--success": "#76ba91",
  "--shadow-soft": "0 20px 40px rgba(2, 6, 23, 0.24)",
  "--shadow-strong": "0 38px 90px rgba(2, 6, 23, 0.38)"
} as const;

type PreviewTheme = "light" | "dark";

interface BoardState {
  scene: PreviewScene;
  variant: PreviewVariant;
  device: PreviewDevice;
}

function clampScene(value: string | null): PreviewScene {
  const allowed = new Set(PREVIEW_SCENE_OPTIONS.map((option) => option.value));
  return allowed.has(value as PreviewScene) ? (value as PreviewScene) : "dashboard";
}

function clampVariant(value: string | null): PreviewVariant {
  const allowed = new Set(PREVIEW_VARIANT_OPTIONS.map((option) => option.value));
  return allowed.has(value as PreviewVariant) ? (value as PreviewVariant) : "default";
}

function clampDevice(value: string | null): PreviewDevice {
  const allowed = new Set(PREVIEW_DEVICE_OPTIONS.map((option) => option.value));
  return allowed.has(value as PreviewDevice) ? (value as PreviewDevice) : "split";
}

function clampFrameScene(value: string | null): PreviewFrameScene {
  const frameScenes = new Set(
    PREVIEW_SCENE_OPTIONS
      .map((option) => option.value)
      .filter((value): value is PreviewFrameScene => value !== "dark")
  );

  return frameScenes.has(value as PreviewFrameScene) ? (value as PreviewFrameScene) : "dashboard";
}

function readBoardState(): BoardState {
  const params = new URLSearchParams(window.location.search);

  return {
    scene: clampScene(params.get("scene")),
    variant: clampVariant(params.get("variant")),
    device: clampDevice(params.get("device"))
  };
}

function readFrameParams() {
  const params = new URLSearchParams(window.location.search);

  return {
    scene: clampFrameScene(params.get("scene")),
    variant: clampVariant(params.get("variant")),
    device: params.get("device") === "mobile" ? "mobile" : "desktop",
    theme: params.get("theme") === "dark" ? "dark" : "light"
  } as const;
}

function sceneToSection(scene: PreviewFrameScene): SectionDefinition["id"] {
  switch (scene) {
    case "projects":
      return "projects";
    case "tasks":
      return "tasks";
    case "finances":
      return "finances";
    case "family":
      return "family";
    case "spiritual":
      return "spiritual";
    case "review":
      return "review";
    default:
      return "dashboard";
  }
}

function frameStyle(theme: PreviewTheme, device: "mobile" | "desktop") {
  const base: React.CSSProperties = {
    minHeight: "100vh",
    colorScheme: theme,
    background:
      theme === "dark"
        ? "radial-gradient(circle at top left, rgba(149, 179, 166, 0.08), transparent 24%), radial-gradient(circle at top right, rgba(122, 177, 213, 0.1), transparent 28%), linear-gradient(180deg, #0f1720 0%, #131d28 100%)"
        : "radial-gradient(circle at top left, rgba(111, 145, 131, 0.08), transparent 24%), radial-gradient(circle at top right, rgba(61, 116, 155, 0.08), transparent 28%), linear-gradient(180deg, #f5f7fa 0%, #eef2f6 100%)"
  };

  (base as Record<string, string>)["--safe-top"] = device === "mobile" ? "18px" : "0px";
  (base as Record<string, string>)["--safe-bottom"] = device === "mobile" ? "28px" : "0px";

  if (theme === "dark") {
    Object.assign(base as Record<string, string>, DARK_THEME_VARS);
  }

  return base;
}

function makeFrameUrl(scene: PreviewScene, variant: PreviewVariant, theme: PreviewTheme, device: "mobile" | "desktop") {
  const actualScene = scene === "dark" ? "dashboard" : scene;
  const params = new URLSearchParams({
    frame: "1",
    scene: actualScene,
    variant,
    theme,
    device
  });

  return `${PREVIEW_PATH}?${params.toString()}`;
}

function previewNotice(variant: PreviewVariant, scene: PreviewFrameScene): NoticeState | null {
  if (variant === "error") {
    return {
      kind: "error",
      message:
        scene === "assistant"
          ? "Erreur simulée : le copilote a renvoyé une réponse lisible sans détail technique."
          : "Erreur simulée : cette vue permet de vérifier les toasts, contrastes et retours visuels."
    };
  }

  if (variant === "success") {
    return {
      kind: "success",
      message:
        scene === "review"
          ? "Revue enregistrée avec succès dans le preview."
          : "État succès simulé : utile pour vérifier le feedback visuel."
    };
  }

  if (variant === "loading") {
    return {
      kind: "info",
      message: "Chargement simulé : vérifier les skeletons, espacements et la perception du temps."
    };
  }

  return null;
}

function renderRows<T>(items: T[], variant: PreviewVariant, baseCount: number) {
  if (variant === "dense") {
    return items;
  }

  return items.slice(0, baseCount);
}

function DashboardPreview({ variant }: { variant: PreviewVariant }) {
  if (variant === "loading") {
    return (
      <div className="today-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <SectionCard
            key={index}
            title={index === 0 ? "Intention du jour" : "Chargement"}
            subtitle="Prévisualisation des états de chargement"
          >
            <LoadingSkeleton lines={4} />
          </SectionCard>
        ))}
      </div>
    );
  }

  if (variant === "empty") {
    return (
      <div className="today-grid">
        <SectionCard title="Intention du jour" subtitle="Vue vide utile pour vérifier la respiration de la page.">
          <EmptyState
            title="Aucune intention enregistrée"
            description="Le vide doit rester clair, calme et ne jamais ressembler à une erreur."
          />
        </SectionCard>
        <SectionCard title="Prière du jour" subtitle="États non renseignés.">
          <EmptyState
            title="Aucun statut saisi"
            description="Le design doit rester structuré même quand la journée n'est pas encore documentée."
          />
        </SectionCard>
        <SectionCard title="Priorités du jour" subtitle="Sans élément, sans stress visuel.">
          <EmptyState
            title="Aucune tâche prioritaire"
            description="Cette vue doit rester utile dès l'ouverture du compte."
          />
        </SectionCard>
        <SectionCard title="Finances" subtitle="Cartes synthétiques même sans données.">
          <EmptyState
            title="Aucun solde disponible"
            description="Le cadre financier doit rester propre sans tableau vide."
          />
        </SectionCard>
      </div>
    );
  }

  const projects = renderRows(PREVIEW_PROJECTS, variant, 3);
  const tasks = renderRows(PREVIEW_TASKS, variant, 3);
  const prayers = renderRows(PREVIEW_PRAYERS, variant, 5);
  const financeMetrics = renderRows(PREVIEW_FINANCE_METRICS, variant, 3);

  return (
    <div className="today-grid">
      <SectionCard
        title="Intention du jour"
        subtitle="La journée commence par un cap simple, lisible et concret."
      >
        <ActionCard
          title={PREVIEW_TODAY_INTENTION}
          description="Enregistrée pour aujourd'hui, avec un focus sur la clarté et l'action utile."
          meta={<StatusBadge tone="accent">En place</StatusBadge>}
        />
      </SectionCard>

      <SectionCard title="Prière du jour" subtitle="Suivi simple, sans score ni surcharge.">
        <div className="list-stack">
          {prayers.map((prayer) => (
            <ListRow
              key={prayer.name}
              title={prayer.name}
              description={`${prayer.window} · ${prayer.note}`}
              aside={<StatusBadge tone={prayerTone(prayer.status)}>{prayer.status}</StatusBadge>}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Priorités du jour"
        subtitle="Trois éléments maximum pour garder une vraie capacité d'action."
      >
        <div className="list-stack">
          {tasks.map((task) => (
            <ListRow
              key={task.title}
              title={task.title}
              description={`${task.project} · ${task.note}`}
              meta={<StatusBadge tone={taskTone(task.status)}>{task.status}</StatusBadge>}
              aside={<strong>{task.slot}</strong>}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Projets à faire avancer"
        subtitle="Deux ou trois chantiers lisibles, avec prochaine action et progression."
      >
        <div className="list-stack">
          {projects.map((project) => (
            <ActionCard
              key={project.title}
              title={project.title}
              description={project.nextAction}
              meta={<StatusBadge tone={projectTone(project.status)}>{project.status}</StatusBadge>}
            >
              <ProgressBar value={project.progress} />
            </ActionCard>
          ))}
        </div>
      </SectionCard>

      <Card className="section-card fade-up">
        <div className="section-card__body">
          <div className="stats-grid">
            {financeMetrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                hint={metric.hint}
                tone={metric.tone}
              />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function IntentionPreview({ variant }: { variant: PreviewVariant }) {
  return (
    <div className="content-grid">
      <SectionCard title="Intention" subtitle="Un écran secondaire sobre, guidé par une seule décision.">
        {variant === "loading" ? (
          <LoadingSkeleton lines={5} />
        ) : variant === "empty" ? (
          <EmptyState
            title="Aucune intention"
            description="Le premier usage doit être immédiat et non intimidant."
          />
        ) : (
          <ActionCard
            title={PREVIEW_TODAY_INTENTION}
            description="Formulation courte, respirante, utilisable au réveil comme en milieu de journée."
            meta={<StatusBadge tone="accent">Niyya</StatusBadge>}
            actions={
              <>
                <SecondaryButton>Modifier</SecondaryButton>
                <GhostButton>Archiver</GhostButton>
              </>
            }
          >
            <FormField label="Réécriture rapide">
              <textarea
                rows={5}
                defaultValue="Préserver une journée simple, claire et utile avant d'ajouter quoi que ce soit."
              />
            </FormField>
          </ActionCard>
        )}
      </SectionCard>
    </div>
  );
}

function ProjectsPreview({ variant }: { variant: PreviewVariant }) {
  if (variant === "loading") {
    return (
      <div className="content-grid">
        <SectionCard title="Cap en cours" subtitle="Prévisualisation chargement">
          <LoadingSkeleton lines={5} />
        </SectionCard>
        <SectionCard title="Étapes" subtitle="Prévisualisation chargement">
          <LoadingSkeleton lines={6} />
        </SectionCard>
      </div>
    );
  }

  if (variant === "empty") {
    return (
      <div className="content-grid">
        <SectionCard title="Cap en cours" subtitle="Aucun projet fictif chargé">
          <EmptyState
            title="Aucun projet visible"
            description="L'écran doit rester structuré même avant la première création."
          />
        </SectionCard>
      </div>
    );
  }

  const projects = renderRows(PREVIEW_PROJECTS, variant, 3);

  return (
    <div className="content-grid">
      <SectionCard title="Cap en cours" subtitle="Trois projets structurés pour décider vite.">
        <div className="list-stack">
          {projects.map((project) => (
            <ActionCard
              key={project.title}
              title={project.title}
              description={project.intention}
              meta={<StatusBadge tone={projectTone(project.status)}>{project.status}</StatusBadge>}
              actions={
                <>
                  <SecondaryButton>Étapes</SecondaryButton>
                  <GhostButton>Éditer</GhostButton>
                </>
              }
            >
              <ListRow
                title="Prochaine action"
                description={project.nextAction}
                aside={<strong>{project.due}</strong>}
              />
              <ListRow title="Budget" description={project.budget} aside={<strong>{project.progress} %</strong>} />
              <ProgressBar value={project.progress} />
            </ActionCard>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Filtrer" subtitle="Le preview garde aussi la lisibilité du design system.">
        <div className="stack-form stack-form--dense">
          <SearchField placeholder="Rechercher un projet ou une prochaine action" />
          <div className="grid-two">
            <FormField label="Statut">
              <select defaultValue="active">
                <option value="idea">idea</option>
                <option value="preparation">preparation</option>
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="blocked">blocked</option>
              </select>
            </FormField>
            <FormField label="Devise">
              <select defaultValue="EUR">
                <option value="EUR">EUR</option>
                <option value="XOF">XOF</option>
                <option value="USD">USD</option>
              </select>
            </FormField>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function TasksPreview({ variant }: { variant: PreviewVariant }) {
  if (variant === "loading") {
    return (
      <div className="content-grid">
        <SectionCard title="Aujourd'hui" subtitle="Prévisualisation chargement">
          <LoadingSkeleton lines={6} />
        </SectionCard>
        <SectionCard title="À venir" subtitle="Prévisualisation chargement">
          <LoadingSkeleton lines={5} />
        </SectionCard>
      </div>
    );
  }

  const tasks = renderRows(PREVIEW_TASKS, variant, 4);
  const todayTasks = tasks.filter((task) => task.status !== "completed").slice(0, 3);
  const doneTasks = tasks.filter((task) => task.status === "completed");

  if (variant === "empty") {
    return (
      <div className="content-grid">
        <SectionCard title="Aujourd'hui" subtitle="Rien à faire, sans sensation d'abandon.">
          <EmptyState
            title="Aucune tâche prioritaire"
            description="Le vide doit sembler maîtrisé, pas cassé."
          />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="content-grid">
      <SectionCard title="Aujourd'hui" subtitle="Inspiré de Things 3, avec une lecture plus calme.">
        <div className="list-stack">
          {todayTasks.map((task) => (
            <ListRow
              key={task.title}
              title={task.title}
              description={`${task.project} · ${task.note}`}
              meta={<StatusBadge tone={taskTone(task.status)}>{task.status}</StatusBadge>}
              aside={<strong>{task.slot}</strong>}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="À venir" subtitle="Les prochaines tâches restent visibles sans écraser aujourd'hui.">
        <div className="list-stack">
          {tasks.slice(1).map((task) => (
            <ListRow
              key={`${task.title}-upcoming`}
              title={task.title}
              description={`Échéance ${task.due} · score ${task.score}`}
              aside={<StatusBadge tone={taskTone(task.status)}>{task.status}</StatusBadge>}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Terminées récemment" subtitle="La base reste la source de vérité pour les statuts.">
        {doneTasks.length === 0 ? (
          <EmptyState
            title="Aucune tâche terminée"
            description="Le composant doit rester propre même sans historique."
          />
        ) : (
          <div className="list-stack">
            {doneTasks.map((task) => (
              <ListRow
                key={`${task.title}-done`}
                title={task.title}
                description={task.note}
                aside={<StatusBadge tone="success">completed</StatusBadge>}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function FinancesPreview({ variant }: { variant: PreviewVariant }) {
  if (variant === "loading") {
    return (
      <div className="content-grid">
        <SectionCard title="Synthèse" subtitle="Prévisualisation chargement">
          <LoadingSkeleton lines={6} />
        </SectionCard>
        <SectionCard title="Transactions" subtitle="Prévisualisation chargement">
          <LoadingSkeleton lines={7} />
        </SectionCard>
      </div>
    );
  }

  if (variant === "empty") {
    return (
      <div className="content-grid">
        <SectionCard title="Synthèse" subtitle="Vue vide utile pour les premiers comptes">
          <EmptyState
            title="Aucun flux enregistré"
            description="La page doit rester lisible avant le premier solde ou la première transaction."
          />
        </SectionCard>
      </div>
    );
  }

  const transactions = renderRows(PREVIEW_TRANSACTIONS, variant, 3);
  const budgets = renderRows(PREVIEW_BUDGETS, variant, 3);

  return (
    <div className="content-grid">
      <Card className="section-card fade-up">
        <div className="section-card__body">
          <div className="stats-grid">
            {PREVIEW_FINANCE_METRICS.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                hint={metric.hint}
                tone={metric.tone}
              />
            ))}
          </div>
        </div>
      </Card>

      <SectionCard title="Transactions récentes" subtitle="Lecture synthétique des flux sans tableau lourd.">
        <div className="list-stack">
          {transactions.map((transaction) => (
            <ListRow
              key={transaction.title}
              title={transaction.title}
              description={`${transaction.category} · ${transaction.note}`}
              meta={<StatusBadge tone={transaction.status === "received" ? "success" : "default"}>{transaction.status}</StatusBadge>}
              aside={<strong>{transaction.amount} {transaction.currency}</strong>}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Budgets" subtitle="Vue claire du prévu, de l'engagé et du restant.">
        <div className="list-stack">
          {budgets.map((budget) => (
            <ActionCard
              key={budget.category}
              title={budget.category}
              description={`Prévu ${budget.planned} · restant ${budget.remaining}`}
              meta={<StatusBadge tone={budget.tone}>{budget.progress} %</StatusBadge>}
            >
              <ProgressBar value={budget.progress} />
            </ActionCard>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function FamilyPreview({ variant }: { variant: PreviewVariant }) {
  if (variant === "loading") {
    return (
      <div className="content-grid">
        <SectionCard title="Famille proche" subtitle="Prévisualisation chargement">
          <LoadingSkeleton lines={6} />
        </SectionCard>
      </div>
    );
  }

  if (variant === "empty") {
    return (
      <div className="content-grid">
        <SectionCard title="Famille proche" subtitle="Aucun membre fictif chargé">
          <EmptyState
            title="Aucun membre suivi"
            description="Le premier usage doit rester humain et non administratif."
          />
        </SectionCard>
      </div>
    );
  }

  const family = renderRows(PREVIEW_FAMILY, variant, 4);

  return (
    <div className="content-grid">
      <SectionCard title="Famille proche" subtitle="Cartes humaines, douces et lisibles sur mobile.">
        <div className="list-stack">
          {family.map((member) => (
            <ActionCard
              key={member.name}
              title={member.name}
              description={`${member.relation} · anniversaire ${member.birthday}`}
              meta={<StatusBadge tone="accent">{member.nextContact}</StatusBadge>}
              actions={
                <>
                  <SecondaryButton>Contacter</SecondaryButton>
                  <GhostButton>Notes</GhostButton>
                </>
              }
            >
              <p className="muted-copy">{member.note}</p>
              <div className="assistant-chip-row">
                {member.interests.map((interest) => (
                  <StatusBadge key={`${member.name}-${interest}`} tone="default">
                    {interest}
                  </StatusBadge>
                ))}
              </div>
            </ActionCard>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function SpiritualPreview({ variant }: { variant: PreviewVariant }) {
  if (variant === "loading") {
    return (
      <div className="content-grid">
        <SectionCard title="Prières" subtitle="Prévisualisation chargement">
          <LoadingSkeleton lines={6} />
        </SectionCard>
      </div>
    );
  }

  if (variant === "empty") {
    return (
      <div className="content-grid">
        <SectionCard title="Prières" subtitle="Aucun statut renseigné">
          <EmptyState
            title="Journée non documentée"
            description="Le vide doit rester digne et simple, jamais culpabilisant."
          />
        </SectionCard>
      </div>
    );
  }

  const prayers = renderRows(PREVIEW_PRAYERS, variant, 5);

  return (
    <div className="content-grid">
      <SectionCard title="Prières" subtitle="Un suivi clair, calme et ancré.">
        <div className="list-stack">
          {prayers.map((prayer) => (
            <ListRow
              key={prayer.name}
              title={prayer.name}
              description={`${prayer.window} · ${prayer.note}`}
              aside={<StatusBadge tone={prayerTone(prayer.status)}>{prayer.status}</StatusBadge>}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function ReviewPreview({ variant }: { variant: PreviewVariant }) {
  if (variant === "loading") {
    return (
      <div className="content-grid">
        <SectionCard title="Revue quotidienne" subtitle="Prévisualisation chargement">
          <LoadingSkeleton lines={7} />
        </SectionCard>
      </div>
    );
  }

  if (variant === "empty") {
    return (
      <div className="content-grid">
        <SectionCard title="Revue quotidienne" subtitle="Aucune réponse enregistrée">
          <EmptyState
            title="Pas encore de revue"
            description="L'entrée doit donner envie d'écrire sans transformer la fin de journée en formulaire lourd."
          />
        </SectionCard>
      </div>
    );
  }

  const lines = renderRows(PREVIEW_REVIEW_LINES, variant, 5);

  return (
    <div className="content-grid">
      <SectionCard title="Revue quotidienne" subtitle="Une clôture lucide, guidée et légère.">
        <div className="list-stack">
          {lines.map((line) => (
            <ActionCard
              key={line.label}
              title={line.label}
              description={line.value}
              meta={<StatusBadge tone={line.tone}>{line.tone ?? "default"}</StatusBadge>}
            >
              {line.note ? <p className="muted-copy">{line.note}</p> : null}
            </ActionCard>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function renderFrameContent(activeSection: SectionDefinition["id"], variant: PreviewVariant) {
  switch (activeSection) {
    case "intention":
      return <IntentionPreview variant={variant} />;
    case "projects":
      return <ProjectsPreview variant={variant} />;
    case "tasks":
      return <TasksPreview variant={variant} />;
    case "finances":
      return <FinancesPreview variant={variant} />;
    case "family":
      return <FamilyPreview variant={variant} />;
    case "spiritual":
      return <SpiritualPreview variant={variant} />;
    case "review":
      return <ReviewPreview variant={variant} />;
    default:
      return <DashboardPreview variant={variant} />;
  }
}

function PreviewFrame() {
  const { scene, variant, device, theme } = readFrameParams();
  const [activeSection, setActiveSection] = React.useState<SectionDefinition["id"]>(
    sceneToSection(scene)
  );

  React.useEffect(() => {
    setActiveSection(sceneToSection(scene));
  }, [scene]);

  if (scene === "auth") {
    const notice =
      variant === "error"
        ? {
            kind: "error" as const,
            message:
              "Connexion réseau impossible vers Supabase. Vérifie la connexion, l'URL du projet et les autorisations réseau."
          }
        : variant === "success"
          ? {
              kind: "success" as const,
              message:
                "Compte créé. Vérifie ton e-mail pour confirmer l'inscription avant la première connexion."
            }
          : variant === "loading"
            ? {
                kind: "info" as const,
                message:
                  "Utilise le bouton principal pour revoir le chargement et l'état désactivé en conditions réelles."
              }
            : null;

    return (
      <div className={theme === "dark" ? "preview-theme--dark" : undefined} style={frameStyle(theme, device)}>
        <AuthScreen
          notice={notice}
          onInfo={() => undefined}
          onError={() => undefined}
          onAuthAttempt={() => undefined}
        />
      </div>
    );
  }

  return (
    <div className={theme === "dark" ? "preview-theme--dark" : undefined} style={frameStyle(theme, device)}>
      <AppShell
        profile={PREVIEW_PROFILE}
        profileLoading={variant === "loading"}
        sections={PREVIEW_SECTIONS}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onSignOut={async () => undefined}
        notice={previewNotice(variant, scene)}
        onSaveProfile={async () => undefined}
        assistantTimeZone={PREVIEW_PROFILE.timezone}
        assistantSlot={
          <PreviewAssistantWidget
            firstName={PREVIEW_PROFILE.first_name}
            variant={scene === "assistant" ? variant : "default"}
            defaultOpen={scene === "assistant"}
          />
        }
      >
        {renderFrameContent(activeSection, variant)}
      </AppShell>
    </div>
  );
}

function PreviewPane({
  title,
  caption,
  scene,
  variant,
  theme,
  device
}: {
  title: string;
  caption: string;
  scene: PreviewScene;
  variant: PreviewVariant;
  theme: PreviewTheme;
  device: "mobile" | "desktop";
}) {
  const iframeSrc = makeFrameUrl(scene, variant, theme, device);
  const scale = device === "mobile" ? 1 : 0.68;
  const frameWidth = device === "mobile" ? 390 : 1280;
  const frameHeight = device === "mobile" ? 844 : 920;
  const canvasHeight = frameHeight * scale;

  return (
    <Card className="fade-up" tone="muted">
      <div style={{ display: "grid", gap: "0.35rem", marginBottom: "0.9rem" }}>
        <strong style={{ fontSize: "1rem" }}>{title}</strong>
        <span style={{ color: "var(--ink-faint)", fontSize: "0.92rem" }}>{caption}</span>
      </div>

      {device === "mobile" ? (
        <div
          style={{
            width: "422px",
            maxWidth: "100%",
            margin: "0 auto",
            padding: "14px",
            borderRadius: "36px",
            background: "#0b1220",
            boxShadow: "0 28px 64px rgba(15, 23, 42, 0.18)"
          }}
        >
          <div
            style={{
              width: "100%",
              height: `${canvasHeight + 14}px`,
              borderRadius: "26px",
              overflow: "hidden",
              background: theme === "dark" ? "#0f1720" : "#eef2f6",
              position: "relative"
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: "10px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "138px",
                height: "28px",
                borderRadius: "999px",
                background: "#05070b",
                zIndex: 2
              }}
            />

            <iframe
              key={iframeSrc}
              title={`${title} preview`}
              src={iframeSrc}
              style={{
                width: `${frameWidth}px`,
                height: `${frameHeight}px`,
                border: 0,
                display: "block",
                marginTop: "16px",
                transform: `scale(${scale})`,
                transformOrigin: "top left"
              }}
            />
          </div>
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            minHeight: `${canvasHeight + 12}px`,
            overflow: "hidden",
            borderRadius: "26px",
            border: "1px solid var(--border-soft)",
            background: "var(--bg-elevated)"
          }}
        >
          <iframe
            key={iframeSrc}
            title={`${title} preview`}
            src={iframeSrc}
            style={{
              width: `${frameWidth}px`,
              height: `${frameHeight}px`,
              border: 0,
              transform: `scale(${scale})`,
              transformOrigin: "top left"
            }}
          />
        </div>
      )}
    </Card>
  );
}

function PreviewBoard() {
  const initialState = React.useMemo(readBoardState, []);
  const [scene, setScene] = React.useState<PreviewScene>(initialState.scene);
  const [variant, setVariant] = React.useState<PreviewVariant>(initialState.variant);
  const [device, setDevice] = React.useState<PreviewDevice>(initialState.device);

  React.useEffect(() => {
    const params = new URLSearchParams({
      scene,
      variant,
      device
    });

    window.history.replaceState(null, "", `${PREVIEW_PATH}?${params.toString()}`);
  }, [device, scene, variant]);

  const theme: PreviewTheme = scene === "dark" ? "dark" : "light";
  const panes =
    device === "split"
      ? ([
          {
            title: "Aperçu iPhone",
            caption: "390 × 844 · safe areas simulées",
            device: "mobile"
          },
          {
            title: "Aperçu desktop",
            caption: "1280 × 920 · layout large",
            device: "desktop"
          }
        ] as const)
      : ([
          {
            title: device === "mobile" ? "Aperçu iPhone" : "Aperçu desktop",
            caption:
              device === "mobile"
                ? "390 × 844 · safe areas simulées"
                : "1280 × 920 · layout large",
            device: device === "mobile" ? "mobile" : "desktop"
          }
        ] as const);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "clamp(16px, 2vw, 28px)",
        background:
          "radial-gradient(circle at top left, rgba(111, 145, 131, 0.12), transparent 24%), radial-gradient(circle at top right, rgba(61, 116, 155, 0.12), transparent 28%), linear-gradient(180deg, var(--bg-canvas) 0%, var(--bg-subtle) 100%)"
      }}
    >
      <div style={{ display: "grid", gap: "1.2rem" }}>
        <PageHeader
          eyebrow="Mode Preview · développement"
          title="Aperçu rapide de toutes les vues"
          description="Données fictives, iframes isolées pour respecter le comportement mobile, et aucune écriture réelle dans Supabase."
          meta={
            <>
              <span className="hero-chip">Dev only</span>
              <span className="hero-chip">Jamais dans le build prod</span>
            </>
          }
          actions={
            <div className="page-header__action-group">
              <GhostButton onClick={() => window.location.assign("/")}>Retour à l'application</GhostButton>
              <SecondaryButton onClick={() => window.location.reload()}>Rafraîchir</SecondaryButton>
            </div>
          }
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)",
            gap: "1rem",
            alignItems: "start"
          }}
        >
          <Card className="fade-up">
            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <strong style={{ display: "block", marginBottom: "0.3rem" }}>Vue</strong>
                <SegmentedControl
                  ariaLabel="Écran à prévisualiser"
                  value={scene}
                  onChange={setScene}
                  options={PREVIEW_SCENE_OPTIONS}
                />
              </div>

              <div>
                <strong style={{ display: "block", marginBottom: "0.3rem" }}>Variante</strong>
                <SegmentedControl
                  ariaLabel="Variante de données"
                  value={variant}
                  onChange={setVariant}
                  options={PREVIEW_VARIANT_OPTIONS}
                />
              </div>

              <div>
                <strong style={{ display: "block", marginBottom: "0.3rem" }}>Support</strong>
                <SegmentedControl
                  ariaLabel="Support à prévisualiser"
                  value={device}
                  onChange={setDevice}
                  options={PREVIEW_DEVICE_OPTIONS}
                />
              </div>

              <ActionCard
                title="Ce que ce mode vérifie"
                description="Responsive, dark mode, safe areas, états vides, chargement, toasts et cohérence du design system."
                meta={<StatusBadge tone="accent">Dev only</StatusBadge>}
              >
                <p className="muted-copy">
                  L'URL locale reste stable : <code>{PREVIEW_PATH}</code>. Le build production ne
                  charge jamais ce module.
                </p>
              </ActionCard>
            </div>
          </Card>

          <div
            style={{
              display: "grid",
              gap: "1rem",
              gridTemplateColumns:
                device === "split" ? "repeat(auto-fit, minmax(320px, 1fr))" : "minmax(0, 1fr)"
            }}
          >
            {panes.map((pane) => (
              <PreviewPane
                key={pane.title}
                title={pane.title}
                caption={`${pane.caption} · ${theme === "dark" ? "thème sombre" : "thème clair"}`}
                scene={scene}
                variant={variant}
                theme={theme}
                device={pane.device}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export function DevPreviewApp() {
  const params = new URLSearchParams(window.location.search);

  if (params.get("frame") === "1") {
    return <PreviewFrame />;
  }

  return <PreviewBoard />;
}
