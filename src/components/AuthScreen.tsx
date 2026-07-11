import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { messageFromError } from "../lib/utils";

interface AuthScreenProps {
  passwordRecovery?: boolean;
  onInfo: (message: string) => void;
  onError: (message: string) => void;
  onRecoveryResolved?: () => void;
}

type AuthMode = "signin" | "signup" | "forgot";

export function AuthScreen({
  passwordRecovery = false,
  onInfo,
  onError,
  onRecoveryResolved
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

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

    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          throw error;
        }

        onInfo("Connexion reussie.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName
            }
          }
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          onInfo("Compte cree et session ouverte.");
        } else {
          onInfo("Compte cree. Verifie ton e-mail si la confirmation est activee.");
        }
      } else {
        const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo
        });

        if (error) {
          throw error;
        }

        onInfo("Lien de reinitialisation envoye si ce compte existe.");
      }
    } catch (error) {
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
