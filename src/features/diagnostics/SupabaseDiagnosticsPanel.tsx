import React from "react";
import {
  isSupabaseConfigured,
  resetMtJefApplicationCache,
  supabaseRuntimeDebug,
  testSupabaseConnection
} from "../../lib/supabase";
import type {
  AuthAttemptDiagnostic,
  SupabaseDiagnosticCategory,
  SupabaseNetworkDiagnostic
} from "../../lib/types";

interface SupabaseDiagnosticsPanelProps {
  authAttempt: AuthAttemptDiagnostic | null;
}

const CATEGORY_LABELS: Record<SupabaseDiagnosticCategory, string> = {
  configuration: "configuration",
  dns: "DNS",
  cors: "CORS",
  timeout: "timeout",
  network_unavailable: "réseau indisponible",
  http: "erreur HTTP",
  supabase_auth: "erreur Supabase Auth",
  other: "autre"
};

export function SupabaseDiagnosticsPanel({ authAttempt }: SupabaseDiagnosticsPanelProps) {
  const [open, setOpen] = React.useState(true);
  const [testing, setTesting] = React.useState(false);
  const [resettingCache, setResettingCache] = React.useState(false);
  const [networkDiagnostic, setNetworkDiagnostic] = React.useState<SupabaseNetworkDiagnostic | null>(null);
  const [panelStatus, setPanelStatus] = React.useState<string | null>(null);

  const diagnosticText = React.useMemo(() => {
    const lines = [
      "M.T JËF — Diagnostic Supabase",
      `Supabase configuré: ${isSupabaseConfigured ? "oui" : "non"}`,
      `Host Supabase: ${supabaseRuntimeDebug.urlHost ?? "indisponible"}`,
      `URL valide: ${supabaseRuntimeDebug.urlValid ? "oui" : "non"}`,
      `Type de clé: ${supabaseRuntimeDebug.anonKeyKind}`,
      `Longueur de clé: ${supabaseRuntimeDebug.anonKeyLength}`
    ];

    if (networkDiagnostic) {
      lines.push(
        "",
        "Test réseau",
        `État: ${networkDiagnostic.state}`,
        `Endpoint testé: ${networkDiagnostic.endpoint ?? "indisponible"}`,
        `Statut HTTP: ${networkDiagnostic.http_status ?? "indisponible"}`,
        `Nom de l’erreur: ${networkDiagnostic.error_name ?? "aucune"}`,
        `Message de l’erreur: ${networkDiagnostic.error_message ?? "aucun"}`,
        `Catégorie estimée: ${CATEGORY_LABELS[networkDiagnostic.category]}`,
        `Projet accessible: ${networkDiagnostic.project_accessible ? "oui" : "non"}`,
        `Domaine joignable: ${networkDiagnostic.host_reachable == null ? "indéterminé" : networkDiagnostic.host_reachable ? "oui" : "non"}`,
        `Durée: ${networkDiagnostic.duration_ms ?? "indisponible"} ms`,
        `Horodatage: ${networkDiagnostic.tested_at}`
      );

      if (networkDiagnostic.notes.length > 0) {
        lines.push(`Notes: ${networkDiagnostic.notes.join(" | ")}`);
      }
    }

    if (authAttempt) {
      lines.push(
        "",
        "Dernière tentative d’authentification",
        `Action: ${authAttempt.action}`,
        `Endpoint appelé: ${authAttempt.endpoint}`,
        `Heure de la tentative: ${authAttempt.attempted_at}`,
        `Durée: ${authAttempt.duration_ms ?? "indisponible"} ms`,
        `Succès: ${authAttempt.success == null ? "indéterminé" : authAttempt.success ? "oui" : "non"}`,
        `Statut HTTP: ${authAttempt.http_status ?? "indisponible"}`,
        `Code Supabase: ${authAttempt.supabase_code ?? "aucun"}`,
        `Nom de l’erreur: ${authAttempt.error_name ?? "aucune"}`,
        `Message de l’erreur: ${authAttempt.error_message ?? "aucun"}`,
        `Catégorie estimée: ${authAttempt.category ? CATEGORY_LABELS[authAttempt.category] : "indéterminée"}`
      );
    }

    return lines.join("\n");
  }, [authAttempt, networkDiagnostic]);

  async function handleConnectionTest() {
    setTesting(true);
    setPanelStatus(null);

    try {
      const result = await testSupabaseConnection();
      setNetworkDiagnostic(result);
      setPanelStatus("Diagnostic réseau mis à jour.");
    } catch (error) {
      setPanelStatus(
        error instanceof Error ? error.message : "Le diagnostic réseau a échoué."
      );
    } finally {
      setTesting(false);
    }
  }

  async function handleCopyDiagnostic() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(diagnosticText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = diagnosticText;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setPanelStatus("Diagnostic copié.");
    } catch (error) {
      setPanelStatus(
        error instanceof Error ? error.message : "Impossible de copier le diagnostic."
      );
    }
  }

  async function handleResetCache() {
    setResettingCache(true);
    setPanelStatus("Réinitialisation du cache de l’application…");

    try {
      await resetMtJefApplicationCache();
    } catch (error) {
      setResettingCache(false);
      setPanelStatus(
        error instanceof Error ? error.message : "Échec de la réinitialisation du cache."
      );
    }
  }

  return (
    <>
      <button
        type="button"
        className="diagnostic-fab"
        aria-expanded={open}
        aria-controls="supabase-diagnostic-panel"
        onClick={() => setOpen((current) => !current)}
      >
        Diagnostic Supabase
      </button>

      <aside
        id="supabase-diagnostic-panel"
        className={`diagnostic-panel${open ? " is-open" : ""}`}
        aria-label="Panneau de diagnostic Supabase"
      >
        <div className="diagnostic-panel__header">
          <div>
            <p className="profile-card__eyebrow">Diagnostic temporaire</p>
            <h2>Connexion Supabase</h2>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setOpen(false)}
          >
            Réduire
          </button>
        </div>

        <div className="diagnostic-panel__body">
          <section className="diagnostic-card">
            <h3>Configuration runtime</h3>
            <dl className="diagnostic-grid">
              <div>
                <dt>Supabase configuré</dt>
                <dd>{isSupabaseConfigured ? "oui" : "non"}</dd>
              </div>
              <div>
                <dt>Host utilisé</dt>
                <dd>{supabaseRuntimeDebug.urlHost ?? "indisponible"}</dd>
              </div>
              <div>
                <dt>URL valide</dt>
                <dd>{supabaseRuntimeDebug.urlValid ? "oui" : "non"}</dd>
              </div>
              <div>
                <dt>Type de clé</dt>
                <dd>{supabaseRuntimeDebug.anonKeyKind}</dd>
              </div>
              <div>
                <dt>Longueur de clé</dt>
                <dd>{supabaseRuntimeDebug.anonKeyLength}</dd>
              </div>
            </dl>
          </section>

          <section className="diagnostic-card">
            <div className="diagnostic-card__header">
              <h3>Test réseau</h3>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void handleConnectionTest()}
                disabled={testing}
              >
                {testing ? "Test en cours..." : "Tester la connexion Supabase"}
              </button>
            </div>

            <dl className="diagnostic-grid">
              <div>
                <dt>État du test</dt>
                <dd>{networkDiagnostic?.state ?? "non exécuté"}</dd>
              </div>
              <div>
                <dt>Endpoint testé</dt>
                <dd>{networkDiagnostic?.endpoint ?? "indisponible"}</dd>
              </div>
              <div>
                <dt>Statut HTTP</dt>
                <dd>{networkDiagnostic?.http_status ?? "indisponible"}</dd>
              </div>
              <div>
                <dt>Nom de l’erreur</dt>
                <dd>{networkDiagnostic?.error_name ?? "aucune"}</dd>
              </div>
              <div>
                <dt>Message de l’erreur</dt>
                <dd>{networkDiagnostic?.error_message ?? "aucun"}</dd>
              </div>
              <div>
                <dt>Catégorie estimée</dt>
                <dd>
                  {networkDiagnostic ? CATEGORY_LABELS[networkDiagnostic.category] : "indéterminée"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="diagnostic-card">
            <h3>Dernière tentative d’authentification</h3>
            <dl className="diagnostic-grid">
              <div>
                <dt>Action exécutée</dt>
                <dd>{authAttempt?.action ?? "aucune"}</dd>
              </div>
              <div>
                <dt>Endpoint appelé</dt>
                <dd>{authAttempt?.endpoint ?? "indisponible"}</dd>
              </div>
              <div>
                <dt>Heure de la tentative</dt>
                <dd>{authAttempt?.attempted_at ?? "indisponible"}</dd>
              </div>
              <div>
                <dt>Durée</dt>
                <dd>{authAttempt?.duration_ms == null ? "indisponible" : `${authAttempt.duration_ms} ms`}</dd>
              </div>
              <div>
                <dt>Succès ou échec</dt>
                <dd>
                  {authAttempt?.success == null
                    ? "indéterminé"
                    : authAttempt.success
                      ? "succès"
                      : "échec"}
                </dd>
              </div>
              <div>
                <dt>Statut HTTP</dt>
                <dd>{authAttempt?.http_status ?? "indisponible"}</dd>
              </div>
              <div>
                <dt>Code Supabase</dt>
                <dd>{authAttempt?.supabase_code ?? "aucun"}</dd>
              </div>
              <div>
                <dt>Nom de l’erreur</dt>
                <dd>{authAttempt?.error_name ?? "aucune"}</dd>
              </div>
              <div>
                <dt>Message de l’erreur</dt>
                <dd>{authAttempt?.error_message ?? "aucun"}</dd>
              </div>
              <div>
                <dt>Catégorie estimée</dt>
                <dd>
                  {authAttempt?.category ? CATEGORY_LABELS[authAttempt.category] : "indéterminée"}
                </dd>
              </div>
            </dl>
          </section>

          <div className="diagnostic-panel__actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void handleCopyDiagnostic()}
            >
              Copier le diagnostic
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => void handleResetCache()}
              disabled={resettingCache}
            >
              {resettingCache
                ? "Réinitialisation..."
                : "Réinitialiser le cache de l’application"}
            </button>
          </div>

          {panelStatus ? (
            <p className="diagnostic-panel__status" role="status">
              {panelStatus}
            </p>
          ) : null}
        </div>
      </aside>
    </>
  );
}
