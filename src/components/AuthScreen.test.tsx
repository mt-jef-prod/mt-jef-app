import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NoticeState } from "../lib/types";
import { AuthScreen } from "./AuthScreen";

const authMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn()
}));

vi.mock("../lib/supabase", () => ({
  resolveSupabaseEndpoint: (path: string) => `https://drimjckdwelctdytxrxz.supabase.co${path}`,
  supabase: {
    auth: {
      signInWithPassword: authMocks.signInWithPassword,
      signUp: authMocks.signUp,
      resetPasswordForEmail: authMocks.resetPasswordForEmail,
      updateUser: authMocks.updateUser
    }
  }
}));

function AuthScreenHarness() {
  const [notice, setNotice] = useState<NoticeState | null>(null);

  return (
    <AuthScreen
      notice={notice}
      onInfo={(message) => setNotice({ kind: "success", message })}
      onError={(message) => setNotice({ kind: "error", message })}
    />
  );
}

describe("AuthScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soumet le formulaire d'inscription et appelle signUp avec un e-mail normalise", async () => {
    const user = userEvent.setup();

    authMocks.signUp.mockResolvedValue({
      data: {
        user: { id: "user-1" },
        session: null
      },
      error: null
    });

    render(<AuthScreenHarness />);

    await user.click(screen.getByRole("button", { name: "Creer un compte" }));
    await user.type(screen.getByLabelText("Prenom"), "  Moussa  ");
    await user.type(screen.getByLabelText("Nom"), "  Jef  ");
    await user.type(screen.getByLabelText("Email"), "  TEST.USER@YOPMAIL.COM  ");
    await user.type(screen.getByLabelText("Mot de passe"), "MotDePasse123!");

    const submitButton = screen.getByRole("button", { name: "Creer mon espace" });
    const form = submitButton.closest("form");

    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(authMocks.signUp).toHaveBeenCalledTimes(1);
    });

    expect(authMocks.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test.user@yopmail.com",
        password: "MotDePasse123!",
        options: expect.objectContaining({
          data: {
            first_name: "Moussa",
            last_name: "Jef"
          },
          emailRedirectTo: expect.stringContaining("/")
        })
      })
    );

    expect(
      screen.getByText("Compte cree. Verifie ton e-mail pour confirmer l'inscription avant de te connecter.")
    ).toBeInTheDocument();
  });

  it("affiche une erreur visible lorsque signUp echoue", async () => {
    const user = userEvent.setup();

    authMocks.signUp.mockResolvedValue({
      data: {
        user: null,
        session: null
      },
      error: {
        message: "User already registered",
        code: "user_already_exists",
        status: 422,
        name: "AuthApiError"
      }
    });

    render(<AuthScreenHarness />);

    await user.click(screen.getByRole("button", { name: "Creer un compte" }));
    await user.type(screen.getByLabelText("Email"), "existing@yopmail.com");
    await user.type(screen.getByLabelText("Mot de passe"), "MotDePasse123!");
    await user.click(screen.getByRole("button", { name: "Creer mon espace" }));

    expect(
      await screen.findByText("Un compte existe deja avec cette adresse e-mail.")
    ).toBeInTheDocument();
  });

  it("desactive le bouton pendant le chargement", async () => {
    const user = userEvent.setup();
    const deferred = { release: null as null | (() => void) };

    authMocks.signUp.mockImplementation(
      () =>
        new Promise<{ data: { user: { id: string }; session: null }; error: null }>((resolve) => {
          deferred.release = () =>
            resolve({
              data: {
                user: { id: "user-2" },
                session: null
              },
              error: null
            });
        })
    );

    render(<AuthScreenHarness />);

    await user.click(screen.getByRole("button", { name: "Creer un compte" }));
    await user.type(screen.getByLabelText("Email"), "loading@yopmail.com");
    await user.type(screen.getByLabelText("Mot de passe"), "MotDePasse123!");
    await user.click(screen.getByRole("button", { name: "Creer mon espace" }));

    expect(screen.getByRole("button", { name: "Patiente..." })).toBeDisabled();

    if (!deferred.release) {
      throw new Error("La promesse d'inscription n'a pas ete capturee.");
    }

    deferred.release();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Entrer dans l'espace" })).toBeEnabled();
    });
  });

  it("appelle signInWithPassword pour la connexion", async () => {
    const user = userEvent.setup();

    authMocks.signInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: "hidden" }
      },
      error: null
    });

    render(<AuthScreenHarness />);

    await user.type(screen.getByLabelText("Email"), "  member@yopmail.com  ");
    await user.type(screen.getByLabelText("Mot de passe"), "MotDePasse123!");
    await user.click(screen.getByRole("button", { name: "Entrer dans l'espace" }));

    await waitFor(() => {
      expect(authMocks.signInWithPassword).toHaveBeenCalledTimes(1);
    });

    expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
      email: "member@yopmail.com",
      password: "MotDePasse123!"
    });

    expect(await screen.findByText("Connexion reussie.")).toBeInTheDocument();
  });
});
