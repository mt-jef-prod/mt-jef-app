import { useMemo, useState } from "react";
import { resolveSupabaseEndpoint, supabase } from "../lib/supabase";
import type { AuthAttemptDiagnostic, NoticeState, SupabaseDiagnosticCategory } from "../lib/types";
import { messageFromError } from "../lib/utils";

interface AuthScreenProps {
  passwordRecovery?: boolean;
  onInfo: (message: string) => void;
  onError: (message: string) => void;
  onAuthAttempt?: (diagnostic: AuthAttemptDiagnostic) => void;
  onRecoveryResolved?: () => void;
  notice?: NoticeState | null;
}

type AuthMode = "signin" | "signup" | "forgot";

function authDebug(step: string, details: Record<string, unknown>) {
  if (!import.meta.env.DEV || import.meta.env.MODE === "test") {
    return;
  }

  console.info("[mt-jef-auth]", step, details);
}

export function AuthScreen({
  passwordRecovery = false,
  onInfo,
  onError,
  onAuthAttempt,
  onRecoveryResolved,
  notice
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  function nowMs() {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  function getDurationMs(startedAtMs: number) {
    return Math.round(nowMs() - startedAtMs);
  }

  function getErrorName(error: unknown) {
    if (error && typeof error === "object" && "name" in error && typeof error.name === "string") {
      return error.name;
    }

    return null;
  }

  function getErrorMessage(error: unknown) {
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
      return error.message;
    }

    return typeof error === "string" ? error : null;
  }

  function getErrorStatus(error: unknown) {
    if (error && typeof error === "object" && "status" in error) {
      const status = Number(error.status);

      return Number.isFinite(status) ? status : null;
    }

    return null;
  }

  function getErrorCode(error: unknown) {
    if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
      return error.code;
    }

    return null;
  }

  function classifyAuthError(error: unknown): SupabaseDiagnosticCategory {
    const errorName = getErrorName(error);
    const errorMessage = getErrorMessage(error)?.toLowerCase() ?? "";
    const status = getErrorStatus(error);
    const browserOnline = typeof navigator === "undefined" ? true : navigator.onLine;

    if (errorName === "AbortError") {
      return "timeout";
    }

    if (!browserOnline) {
      return "network_unavailable";
    }

    if (errorMessage.includes("cors") || errorMessage.includes("cross-origin")) {
      return "cors";
    }

    if (
      errorMessage.includes("failed to fetch") ||
      errorMessage.includes("fetch failed") ||
      errorMessage.includes("err_name_not_resolved") ||
      errorMessage.includes("name not resolved")
    ) {
      return "other";
    }

    if (status != null && [400, 401, 403, 422, 429].includes(status)) {
      return "supabase_auth";
    }

    if (status != null && status >= 400) {
      return "http";
    }

    return "other";
  }

  function reportAuthAttempt(diagnostic: AuthAttemptDiagnostic) {
    onAuthAttempt?.(diagnostic);
  }

  const submitLabel = useMemo(() => {
    if (passwordRecovery) {
      return loading ? "Mise a jour..." : "Definir le nouveau mot de passe";
    }

    if (mode === "forgot") {
      return loading ? "Envoi..." : "Recevoir le lien de reinitialisation";
    }

    if (mode === "signin") {
      return loading ? "Patiente..." : "Entrer dans l'espace";
    }

    return loading ? "Patiente..." : "Creer mon espace";
  }, [loading, mode, passwordRecovery]);

  async function handlePasswordRecovery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      onError("Supabase n'est pas configure.");
      return;
    }

    if (password.length < 8) {
      onError("Le nouveau mot de passe doit contenir au moins 8 caracteres.");
      return;
    }

    if (password !== passwordConfirm) {
      onError("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password
      });

      if (error) {
        throw error;
      }

      onInfo("Mot de passe mis a jour.");
      onRecoveryResolved?.();
      setPassword("");
      setPasswordConfirm("");
    } catch (error) {
      onError(messageFromError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passwordRecovery) {
      await handlePasswordRecovery(event);
      return;
    }

    if (!supabase) {
      onError("Supabase n'est pas configure.");
      return;
    }

    if (loading) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanedFirstName = firstName.trim();
    const cleanedLastName = lastName.trim();

    if (!normalizedEmail) {
      onError("Renseigne une adresse e-mail valide.");
      return;
    }

    authDebug("submit:enter", {
      mode,
      email: normalizedEmail,
      hasFirstName: Boolean(cleanedFirstName),
      hasLastName: Boolean(cleanedLastName)
    });

    setLoading(true);
    const attemptedAt = new Date().toISOString();
    const startedAtMs = nowMs();

    try {
      if (mode === "signin") {
        const endpoint = resolveSupabaseEndpoint("/auth/v1/token?grant_type=password") ?? "/auth/v1/token?grant_type=password";

        authDebug("signin:request", {
          email: normalizedEmail
        });

        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });

        authDebug("signin:result", {
          email: normalizedEmail,
          hasError: Boolean(error)
        });

        if (error) {
          throw error;
        }

        reportAuthAttempt({
          action: "signin",
          attempted_at: attemptedAt,
          category: null,
          duration_ms: getDurationMs(startedAtMs),
          endpoint,
          error_message: null,
          error_name: null,
          http_status: null,
          success: true,
          supabase_code: null
        });

        onInfo("Connexion reussie.");
      } else if (mode === "signup") {
        const emailRedirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
        const endpoint = resolveSupabaseEndpoint("/auth/v1/signup") ?? "/auth/v1/signup";

        authDebug("signup:request", {
          email: normalizedEmail,
          hasFirstName: Boolean(cleanedFirstName),
          hasLastName: Boolean(cleanedLastName)
        });

        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo,
            data: {
              ...(cleanedFirstName ? { first_name: cleanedFirstName } : {}),
              ...(cleanedLastName ? { last_name: cleanedLastName } : {})
            }
          }
        });

        authDebug("signup:result", {
          email: normalizedEmail,
          hasError: Boolean(error),
          hasUser: Boolean(data.user),
          hasSession: Boolean(data.session)
        });

        if (error) {
          throw error;
        }

        reportAuthAttempt({
          action: "signup",
          attempted_at: attemptedAt,
          category: null,
          duration_ms: getDurationMs(startedAtMs),
          endpoint,
          error_message: null,
          error_name: null,
          http_status: null,
          success: true,
          supabase_code: null
        });

        if (data.session) {
          onInfo("Compte cree et session ouverte.");
        } else {
          onInfo(
            "Compte cree. Verifie ton e-mail pour confirmer l'inscription avant de te connecter."
          );
        }

        setEmail(normalizedEmail);
        setPassword("");
        setMode("signin");
      } else {
        const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString();

        authDebug("forgot-password:request", {
          email: normalizedEmail,
          redirectTo
        });

        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo
        });

        authDebug("forgot-password:result", {
          email: normalizedEmail,
          hasError: Boolean(error)
        });

        if (error) {
          throw error;
        }

        onInfo("Lien de reinitialisation envoye si ce compte existe.");
      }
    } catch (error) {
      if (mode === "signin" || mode === "signup") {
        const endpoint =
          mode === "signup"
            ? resolveSupabaseEndpoint("/auth/v1/signup") ?? "/auth/v1/signup"
            : resolveSupabaseEndpoint("/auth/v1/token?grant_type=password") ?? "/auth/v1/token?grant_type=password";

        reportAuthAttempt({
          action: mode === "signup" ? "signup" : "signin",
          attempted_at: attemptedAt,
          category: classifyAuthError(error),
          duration_ms: getDurationMs(startedAtMs),
          endpoint,
          error_message: getErrorMessage(error),
          error_name: getErrorName(error),
          http_status: getErrorStatus(error),
          success: false,
          supabase_code: getErrorCode(error)
        });
      }

      authDebug("submit:error", {
        mode,
        email: normalizedEmail,
        error:
          error && typeof error === "object" && "message" in error
            ? String(error.message)
            : String(error)
      });
      onError(messageFromError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-screen__backdrop" />
      <section className="auth-panel fade-up">
        <p className="auth-panel__kicker">Niyya -&gt; Jëf -&gt; Tekki</p>
        <h1>M.T JËF</h1>
        <p className="auth-panel__intro">
          Un cockpit personnel pour transformer l'intention en action suivie,
          puis en accomplissement concret.
        </p>

        {notice ? (
          <div className={`notice-banner notice-banner--${notice.kind}`}>
            {notice.message}
          </div>
        ) : null}

        {!passwordRecovery ? (
          <div className="segmented-control">
            <button
              type="button"
              className={mode === "signin" ? "is-active" : ""}
              onClick={() => setMode("signin")}
            >
              Se connecter
            </button>
            <button
              type="button"
              className={mode === "signup" ? "is-active" : ""}
              onClick={() => setMode("signup")}
            >
              Creer un compte
            </button>
          </div>
        ) : null}

        <form className="stack-form" onSubmit={handleSubmit}>
          {passwordRecovery ? (
            <>
              <label>
                <span>Nouveau mot de passe</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
              </label>

              <label>
                <span>Confirmation du mot de passe</span>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
              </label>
            </>
          ) : (
            <>
              {mode === "signup" ? (
                <div className="grid-two">
                  <label>
                    <span>Prenom</span>
                    <input
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="Moussa"
                    />
                  </label>
                  <label>
                    <span>Nom</span>
                    <input
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder="Jef"
                    />
                  </label>
                </div>
              ) : null}

              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="toi@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              {mode !== "forgot" ? (
                <label>
                  <span>Mot de passe</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    minLength={8}
                    required
                  />
                </label>
              ) : null}
            </>
          )}

          <button type="submit" className="primary-button" disabled={loading}>
            {submitLabel}
          </button>

          {!passwordRecovery ? (
            <button
              type="button"
              className="ghost-button"
              onClick={() => setMode((current) => (current === "forgot" ? "signin" : "forgot"))}
            >
              {mode === "forgot" ? "Retour a la connexion" : "Mot de passe oublie"}
            </button>
          ) : null}
        </form>
      </section>
    </main>
  );
}
