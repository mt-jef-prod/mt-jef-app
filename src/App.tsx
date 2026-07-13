import { useEffect, useState } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { AppShell } from "./components/AppShell";
import { SupabaseDiagnosticsPanel } from "./features/diagnostics/SupabaseDiagnosticsPanel";
import { supabase, isSupabaseConfigured, supabaseConfigError } from "./lib/supabase";
import type { AuthAttemptDiagnostic, NoticeState, ProfileRow, SectionDefinition } from "./lib/types";
import { messageFromError } from "./lib/utils";
import { useAuthSession } from "./hooks/useAuthSession";
import { DashboardSection } from "./features/dashboard/DashboardSection";
import { IntentionSection } from "./features/intentions/IntentionSection";
import { FamilySection } from "./features/family/FamilySection";
import { ProjectsSection } from "./features/projects/ProjectsSection";
import { TasksSection } from "./features/tasks/TasksSection";
import { FinancesSection } from "./features/finances/FinancesSection";
import { SpiritualSection } from "./features/spiritual/SpiritualSection";
import { DailyReviewSection } from "./features/review/DailyReviewSection";

const SECTIONS: SectionDefinition[] = [
  { id: "dashboard", label: "Cockpit", kicker: "Vue d'ensemble" },
  { id: "intention", label: "Niyya", kicker: "Intention du jour" },
  { id: "family", label: "Famille", kicker: "Lien & rappels" },
  { id: "projects", label: "Projets", kicker: "Cap & étapes" },
  { id: "tasks", label: "Tâches", kicker: "Action immédiate" },
  { id: "finances", label: "Finances", kicker: "Flux & budgets" },
  { id: "spiritual", label: "Prières", kicker: "Ancrage" },
  { id: "review", label: "Tekki", kicker: "Revue du soir" }
];

export default function App() {
  const { user, authEvent, loading } = useAuthSession();
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [activeSection, setActiveSection] = useState<SectionDefinition["id"]>("dashboard");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [passwordRecoveryOpen, setPasswordRecoveryOpen] = useState(false);
  const [authAttempt, setAuthAttempt] = useState<AuthAttemptDiagnostic | null>(null);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 4200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  useEffect(() => {
    if (!supabase || !user) {
      setProfile(null);
      return;
    }

    const client = supabase;
    const currentUser = user;
    let active = true;

    async function loadProfile() {
      setProfileLoading(true);

      try {
        const { data, error } = await client
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .maybeSingle();

        if (!active) {
          return;
        }

        if (error) {
          setNotice({
            kind: "error",
            message: messageFromError(error)
          });
          return;
        }

        setProfile((data as ProfileRow | null) ?? null);
      } finally {
        if (active) {
          setProfileLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [user, dataVersion]);

  useEffect(() => {
    if (authEvent === "PASSWORD_RECOVERY") {
      setPasswordRecoveryOpen(true);
    }
  }, [authEvent]);

  function setInfo(message: string) {
    setNotice({ kind: "success", message });
  }

  function setError(message: string) {
    setNotice({ kind: "error", message });
  }

  function bumpDataVersion() {
    setDataVersion((current) => current + 1);
  }

  async function handleSaveProfile(payload: Partial<ProfileRow>) {
    if (!supabase || !user) {
      return;
    }

    try {
      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);

      if (error) {
        throw error;
      }

      setInfo("Profil mis à jour.");
      bumpDataVersion();
    } catch (error) {
      setError(messageFromError(error));
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(messageFromError(error));
      return;
    }

    setNotice({ kind: "info", message: "Session terminée." });
  }

  if (!isSupabaseConfigured) {
    return (
      <>
        <main className="config-screen">
          <section className="config-panel fade-up">
            <p className="auth-panel__kicker">Configuration requise</p>
            <h1>M.T JËF</h1>
            <p>
              {supabaseConfigError ??
                "Renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans ton environnement avant de lancer l'application."}
            </p>
            <pre>
              <code>{`cp .env.example .env\n# puis complète les valeurs Supabase locales`}</code>
            </pre>
          </section>
        </main>
        <SupabaseDiagnosticsPanel authAttempt={authAttempt} />
      </>
    );
  }

  if (loading) {
    return (
      <>
        <main className="config-screen">
          <section className="config-panel fade-up">
            <p className="auth-panel__kicker">Initialisation</p>
            <h1>Chargement de la session</h1>
          </section>
        </main>
        <SupabaseDiagnosticsPanel authAttempt={authAttempt} />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <AuthScreen
          notice={notice}
          onInfo={setInfo}
          onError={setError}
          onAuthAttempt={setAuthAttempt}
        />
        <SupabaseDiagnosticsPanel authAttempt={authAttempt} />
      </>
    );
  }

  if (passwordRecoveryOpen) {
    return (
      <>
        <AuthScreen
          passwordRecovery
          notice={notice}
          onInfo={setInfo}
          onError={setError}
          onAuthAttempt={setAuthAttempt}
          onRecoveryResolved={() => setPasswordRecoveryOpen(false)}
        />
        <SupabaseDiagnosticsPanel authAttempt={authAttempt} />
      </>
    );
  }

  const timezone = profile?.timezone ?? "Europe/Paris";

  return (
    <>
      <AppShell
        profile={profile}
        profileLoading={profileLoading}
        sections={SECTIONS}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onSignOut={handleSignOut}
        notice={notice}
        onSaveProfile={handleSaveProfile}
        assistantTimeZone={timezone}
      >
        {activeSection === "dashboard" ? (
          <DashboardSection
            userId={user.id}
            timezone={timezone}
            refreshToken={dataVersion}
            onError={setError}
          />
        ) : null}

        {activeSection === "intention" ? (
          <IntentionSection
            userId={user.id}
            timezone={timezone}
            refreshToken={dataVersion}
            onDataChanged={bumpDataVersion}
            onInfo={setInfo}
            onError={setError}
          />
        ) : null}

        {activeSection === "family" ? (
          <FamilySection
            userId={user.id}
            timezone={timezone}
            refreshToken={dataVersion}
            onDataChanged={bumpDataVersion}
            onInfo={setInfo}
            onError={setError}
          />
        ) : null}

        {activeSection === "projects" ? (
          <ProjectsSection
            userId={user.id}
            refreshToken={dataVersion}
            onDataChanged={bumpDataVersion}
            onInfo={setInfo}
            onError={setError}
          />
        ) : null}

        {activeSection === "tasks" ? (
          <TasksSection
            userId={user.id}
            timezone={timezone}
            refreshToken={dataVersion}
            onDataChanged={bumpDataVersion}
            onInfo={setInfo}
            onError={setError}
          />
        ) : null}

        {activeSection === "finances" ? (
          <FinancesSection
            userId={user.id}
            timezone={timezone}
            refreshToken={dataVersion}
            onDataChanged={bumpDataVersion}
            onInfo={setInfo}
            onError={setError}
          />
        ) : null}

        {activeSection === "spiritual" ? (
          <SpiritualSection
            userId={user.id}
            timezone={timezone}
            refreshToken={dataVersion}
            onDataChanged={bumpDataVersion}
            onInfo={setInfo}
            onError={setError}
          />
        ) : null}

        {activeSection === "review" ? (
          <DailyReviewSection
            userId={user.id}
            timezone={timezone}
            refreshToken={dataVersion}
            onDataChanged={bumpDataVersion}
            onInfo={setInfo}
            onError={setError}
          />
        ) : null}
      </AppShell>
      <SupabaseDiagnosticsPanel authAttempt={authAttempt} />
    </>
  );
}
