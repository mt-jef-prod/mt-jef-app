import React, { type PropsWithChildren } from "react";
import { AssistantWidget } from "../features/assistant/AssistantWidget";
import type { NoticeState, ProfileRow, SectionDefinition } from "../lib/types";

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
  children
}: AppShellProps) {
  const displayName = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ");
  const profileSummary = [profile?.city, profile?.country ?? "France"]
    .filter(Boolean)
    .join(", ");
  const profileMeta = [profileSummary || null, profile?.timezone ?? "Europe/Paris"]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="app-shell">
      <div className="app-shell__aurora" />
      <div className="app-shell__frame">
        <header className="hero-panel fade-up">
          <div className="hero-panel__copy">
            <p className="hero-panel__kicker">Assistant personnel intelligent</p>
            <h1>M.T JËF</h1>
            <p className="hero-panel__lead">
              Une application de pilotage quotidien fondée sur la séquence
              intention, action, accomplissement.
            </p>
            <div className="hero-panel__pill-row" aria-label="Méthode M.T JËF">
              <span>Niyya</span>
              <span>Jëf</span>
              <span>Tekki</span>
            </div>
          </div>

          <aside className="profile-card">
            <div className="profile-card__header">
              <div>
                <p className="profile-card__eyebrow">Profil</p>
                <h2>{displayName || "Utilisateur connecté"}</h2>
                <p className="profile-card__summary">{profileMeta}</p>
              </div>
              <button type="button" className="ghost-button" onClick={onSignOut}>
                Déconnexion
              </button>
            </div>

            <ProfileEditor
              profile={profile}
              loading={profileLoading}
              onSaveProfile={onSaveProfile}
            />
          </aside>
        </header>

        {notice ? (
          <div className={`notice-banner notice-banner--${notice.kind}`}>
            {notice.message}
          </div>
        ) : null}

        <div className="section-nav__surface fade-up">
          <nav className="section-nav" aria-label="Sections">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={section.id === activeSection ? "is-active" : ""}
                onClick={() => onSelectSection(section.id)}
              >
                <span>{section.label}</span>
                <small>{section.kicker}</small>
              </button>
            ))}
          </nav>
        </div>

        <section className="app-shell__content">{children}</section>
      </div>

      <AssistantWidget timezone={assistantTimeZone} firstName={profile?.first_name ?? null} />
    </main>
  );
}

interface ProfileEditorProps {
  profile: ProfileRow | null;
  loading: boolean;
  onSaveProfile: (payload: Partial<ProfileRow>) => Promise<void>;
}

function ProfileEditor({
  profile,
  loading,
  onSaveProfile
}: ProfileEditorProps) {
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
        <label>
          <span>Prénom</span>
          <input
            value={formState.first_name}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                first_name: event.target.value
              }))
            }
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
      </div>

      <div className="grid-three">
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
          <span>Ville</span>
          <input
            value={formState.city}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                city: event.target.value
              }))
            }
          />
        </label>
      </div>

      <div className="grid-three">
        <label>
          <span>Pays</span>
          <input
            value={formState.country}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                country: event.target.value
              }))
            }
          />
        </label>
        <label>
          <span>Fuseau horaire</span>
          <input
            value={formState.timezone}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                timezone: event.target.value
              }))
            }
          />
        </label>
        <label>
          <span>Devise</span>
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
        </label>
      </div>

      <button type="submit" className="secondary-button" disabled={saving}>
        {saving ? "Enregistrement..." : "Mettre a jour le profil"}
      </button>
    </form>
  );
}
