import React, { type PropsWithChildren } from "react";
import { AssistantWidget } from "../features/assistant/AssistantWidget";
import type { NoticeState, ProfileRow, SectionDefinition } from "../lib/types";
import {
  Avatar,
  BottomNavigation,
  BottomSheet,
  Card,
  FormField,
  GhostButton,
  Modal,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  Toast
} from "./ui";

interface AppShellProps extends PropsWithChildren {
  profile: ProfileRow | null;
  profileLoading: boolean;
  sections: SectionDefinition[];
  activeSection: SectionDefinition["id"];
  onSelectSection: (sectionId: SectionDefinition["id"]) => void;
  onSignOut: () => Promise<void>;
  notice: NoticeState | null;
  onSaveProfile: (payload: Partial<ProfileRow>) => Promise<void>;
  assistantTimeZone: string;
  assistantSlot?: React.ReactNode;
}

const PRIMARY_NAV: Array<{ id: SectionDefinition["id"] | "more"; label: string }> = [
  { id: "dashboard", label: "Aujourd'hui" },
  { id: "projects", label: "Projets" },
  { id: "tasks", label: "Tâches" },
  { id: "finances", label: "Finances" },
  { id: "more", label: "Plus" }
];

const MORE_SECTIONS: SectionDefinition["id"][] = ["intention", "family", "spiritual", "review"];

const SECTION_SENTENCES: Record<SectionDefinition["id"], string> = {
  dashboard: "Une vue calme et utile pour décider de l'essentiel.",
  intention: "Clarifie l'intention avant de passer à l'action.",
  family: "Entretiens les liens importants avec régularité.",
  projects: "Transforme les intentions en trajectoires concrètes.",
  tasks: "Fais avancer l'essentiel sans surcharge visuelle.",
  finances: "Garde une lecture nette de tes marges réelles.",
  spiritual: "Ancre la journée avec un suivi simple et discret.",
  review: "Clôture la journée avec lucidité et correction."
};

const SECTION_HERO: Record<
  SectionDefinition["id"],
  {
    eyebrow: string;
    title: string;
    description: string;
  }
> = {
  dashboard: {
    eyebrow: "Cadre du jour",
    title: "Une journée plus claire, plus utile et plus stable.",
    description:
      "L'écran d'accueil doit aider à choisir vite, sans bruit visuel ni dispersion inutile."
  },
  intention: {
    eyebrow: "Point d'appui",
    title: "Formuler un cap simple avant d'ouvrir de nouvelles pistes.",
    description:
      "L'intention du jour reste courte, relisible et immédiatement exploitable dans le reste de l'application."
  },
  family: {
    eyebrow: "Point d'appui",
    title: "Rester proche avec des rappels sobres, humains et utilisables.",
    description:
      "Les liens importants doivent rester visibles sans devenir une charge administrative."
  },
  projects: {
    eyebrow: "Point d'appui",
    title: "Transformer une intention en trajectoire lisible.",
    description:
      "Chaque projet doit faire apparaître le prochain mouvement, le rythme et le coût sans noyer l'utilisateur."
  },
  tasks: {
    eyebrow: "Point d'appui",
    title: "Faire émerger l'essentiel avant la liste complète.",
    description:
      "La hiérarchie visuelle met l'accent sur les actions qui débloquent réellement la journée."
  },
  finances: {
    eyebrow: "Point d'appui",
    title: "Voir ce qui est disponible, protégé et déjà engagé.",
    description:
      "Les montants importants doivent rester comparables d'un coup d'oeil, sur mobile comme au bureau."
  },
  spiritual: {
    eyebrow: "Point d'appui",
    title: "Garder un suivi discret, régulier et sans surcharge.",
    description:
      "Le module spirituel reste calme, exact et respectueux, sans métrique artificielle."
  },
  review: {
    eyebrow: "Point d'appui",
    title: "Fermer la journée avec lucidité, correction et continuité.",
    description:
      "La revue doit aider à ajuster demain sans transformer la fin de journée en formulaire pesant."
  }
};

function formatToday(timeZone: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone
  }).format(new Date());
}

function navIcon(id: string) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (id) {
    case "dashboard":
      return (
        <svg {...common}>
          <path d="M4 13.5 12 5l8 8.5" />
          <path d="M6 11.5V20h12v-8.5" />
        </svg>
      );
    case "projects":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="3" />
          <path d="M8 9h8M8 13h5" />
        </svg>
      );
    case "tasks":
      return (
        <svg {...common}>
          <path d="M8 7h11M8 12h11M8 17h11" />
          <path d="m4.5 7 1.4 1.4L7.8 6.5" />
          <path d="m4.5 12 1.4 1.4L7.8 11.5" />
          <circle cx="6" cy="17" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "finances":
      return (
        <svg {...common}>
          <path d="M5 18V9.5M12 18V6M19 18v-4.5" />
          <path d="M4 18h16" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

export function AppShell({
  profile,
  profileLoading,
  sections,
  activeSection,
  onSelectSection,
  onSignOut,
  notice,
  onSaveProfile,
  assistantTimeZone,
  assistantSlot,
  children
}: AppShellProps) {
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
  const shortName = profile?.first_name?.trim() || "toi";
  const profileSummary = [profile?.city, profile?.country ?? "France"].filter(Boolean).join(", ");
  const profileMeta = [profileSummary || null, profile?.timezone ?? assistantTimeZone]
    .filter(Boolean)
    .join(" · ");

  const sectionMap = new Map(sections.map((section) => [section.id, section]));
  const moreItems = MORE_SECTIONS.map((sectionId) => sectionMap.get(sectionId)).filter(Boolean) as SectionDefinition[];
  const activeNavId = PRIMARY_NAV.some((item) => item.id === activeSection) ? activeSection : "more";
  const todayLabel = formatToday(profile?.timezone ?? assistantTimeZone);
  const activeSectionConfig = sectionMap.get(activeSection);
  const activeHero = SECTION_HERO[activeSection];
  const headerEyebrow =
    activeSection === "dashboard"
      ? "Aujourd'hui"
      : activeSectionConfig?.kicker ?? activeSectionConfig?.label ?? "M.T JËF";
  const headerTitle =
    activeSection === "dashboard" ? `Bonjour ${shortName}` : activeSectionConfig?.label ?? "M.T JËF";

  return (
    <main className="app-shell">
      <div className="app-shell__aurora" />

      <div className="app-shell__frame">
        <aside className="app-sidebar">
          <Card className="app-sidebar__brand" tone="accent">
            <p className="page-header__eyebrow">M.T JËF</p>
            <h2>Niyya → Jëf → Tekki</h2>
            <p>
              Une application personnelle sobre, structurée et pensée pour agir avec constance.
            </p>
          </Card>

          <nav className="app-sidebar__nav" aria-label="Navigation">
            {PRIMARY_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === activeNavId ? "is-active" : ""}
                onClick={() => {
                  if (item.id === "more") {
                    setMoreOpen(true);
                    return;
                  }

                  onSelectSection(item.id);
                }}
              >
                <span className="app-sidebar__icon">{navIcon(item.id)}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <Card className="app-sidebar__profile">
            <Avatar
              name={displayName || "Utilisateur connecté"}
              detail={profileMeta || "Profil encore à compléter"}
            />
            <div className="app-sidebar__profile-actions">
              <SecondaryButton onClick={() => setProfileOpen(true)}>Profil</SecondaryButton>
              <GhostButton onClick={() => void onSignOut()}>Déconnexion</GhostButton>
            </div>
          </Card>
        </aside>

        <div className="app-shell__main">
          <PageHeader
            eyebrow={headerEyebrow}
            title={headerTitle}
            description={SECTION_SENTENCES[activeSection]}
            meta={
              <>
                <span className="hero-chip">{todayLabel}</span>
                <span className="hero-chip">Niyya</span>
                <span className="hero-chip">Jëf</span>
                <span className="hero-chip">Tekki</span>
              </>
            }
            actions={
              <div className="page-header__action-group">
                <GhostButton onClick={() => setMoreOpen(true)}>Plus</GhostButton>
                <PrimaryButton onClick={() => setProfileOpen(true)}>Profil</PrimaryButton>
              </div>
            }
          />

          <Card className="hero-summary">
            <div className="hero-summary__copy">
              <p className="page-header__eyebrow">{activeHero.eyebrow}</p>
              <h2>{activeHero.title}</h2>
              <p>{activeHero.description}</p>
            </div>
            <Avatar
              name={displayName || "Utilisateur connecté"}
              detail={profileMeta || "Fuseau Europe/Paris par défaut"}
            />
          </Card>

          <section className="app-shell__content">{children}</section>
        </div>
      </div>

      <BottomNavigation
        items={PRIMARY_NAV.map((item) => ({
          id: item.id,
          label: item.label,
          icon: navIcon(item.id)
        }))}
        activeId={activeNavId}
        onSelect={(itemId) => {
          if (itemId === "more") {
            setMoreOpen(true);
            return;
          }

          onSelectSection(itemId as SectionDefinition["id"]);
        }}
      />

      <BottomSheet
        open={moreOpen}
        title="Plus"
        description="Sections secondaires, profil et dépannage."
        onClose={() => setMoreOpen(false)}
        actions={<GhostButton onClick={() => setMoreOpen(false)}>Fermer</GhostButton>}
      >
        <div className="more-menu">
          {moreItems.map((section) => (
            <button
              key={section.id}
              type="button"
              className={section.id === activeSection ? "is-active" : ""}
              onClick={() => {
                onSelectSection(section.id);
                setMoreOpen(false);
              }}
            >
              <strong>{section.label}</strong>
              <span>{section.kicker}</span>
            </button>
          ))}

          <button
            type="button"
            className="more-menu__profile"
            onClick={() => {
              setMoreOpen(false);
              setProfileOpen(true);
            }}
          >
            <strong>Profil</strong>
            <span>Coordonnées, fuseau et devise préférée</span>
          </button>
        </div>
      </BottomSheet>

      <Modal
        open={profileOpen}
        title="Profil"
        description="Renseigne l'essentiel sans surcharger l'expérience principale."
        onClose={() => setProfileOpen(false)}
        actions={<GhostButton onClick={() => setProfileOpen(false)}>Fermer</GhostButton>}
      >
        <ProfileEditor profile={profile} loading={profileLoading} onSaveProfile={onSaveProfile} />
      </Modal>

      <Toast notice={notice} />
      {assistantSlot ?? (
        <AssistantWidget timezone={assistantTimeZone} firstName={profile?.first_name ?? null} />
      )}
    </main>
  );
}

interface ProfileEditorProps {
  profile: ProfileRow | null;
  loading: boolean;
  onSaveProfile: (payload: Partial<ProfileRow>) => Promise<void>;
}

function ProfileEditor({ profile, loading, onSaveProfile }: ProfileEditorProps) {
  const [formState, setFormState] = React.useState({
    first_name: "",
    last_name: "",
    birth_date: "",
    city: "",
    country: "France",
    timezone: "Europe/Paris",
    preferred_currency: "EUR"
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setFormState({
      first_name: profile?.first_name ?? "",
      last_name: profile?.last_name ?? "",
      birth_date: profile?.birth_date ?? "",
      city: profile?.city ?? "",
      country: profile?.country ?? "France",
      timezone: profile?.timezone ?? "Europe/Paris",
      preferred_currency: profile?.preferred_currency ?? "EUR"
    });
  }, [profile]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await onSaveProfile({
        first_name: formState.first_name.trim() || null,
        last_name: formState.last_name.trim() || null,
        birth_date: formState.birth_date || null,
        city: formState.city.trim() || null,
        country: formState.country.trim() || "France",
        timezone: formState.timezone.trim() || "Europe/Paris",
        preferred_currency: formState.preferred_currency.trim().toUpperCase() || "EUR"
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading && !profile) {
    return <p className="muted-copy">Chargement du profil…</p>;
  }

  return (
    <form className="stack-form stack-form--dense" onSubmit={handleSubmit}>
      <div className="grid-two">
        <FormField label="Prénom">
          <input
            value={formState.first_name}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                first_name: event.target.value
              }))
            }
          />
        </FormField>
        <FormField label="Nom">
          <input
            value={formState.last_name}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                last_name: event.target.value
              }))
            }
          />
        </FormField>
      </div>

      <div className="grid-three">
        <FormField label="Date de naissance">
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
        </FormField>
        <FormField label="Ville">
          <input
            value={formState.city}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                city: event.target.value
              }))
            }
          />
        </FormField>
      </div>

      <div className="grid-three">
        <FormField label="Pays">
          <input
            value={formState.country}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                country: event.target.value
              }))
            }
          />
        </FormField>
        <FormField label="Fuseau horaire">
          <input
            value={formState.timezone}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                timezone: event.target.value
              }))
            }
          />
        </FormField>
        <FormField label="Devise">
          <input
            value={formState.preferred_currency}
            maxLength={3}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                preferred_currency: event.target.value.toUpperCase()
              }))
            }
          />
        </FormField>
      </div>

      <PrimaryButton type="submit" disabled={saving}>
        {saving ? "Enregistrement..." : "Mettre à jour le profil"}
      </PrimaryButton>
    </form>
  );
}
