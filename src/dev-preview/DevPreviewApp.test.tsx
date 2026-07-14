import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DevPreviewApp } from "./DevPreviewApp";

function setPreviewUrl(search: string) {
  window.history.replaceState({}, "", `/__preview${search}`);
}

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("DevPreviewApp", () => {
  it("affiche le tableau de bord du mode preview en mode contrôle", () => {
    setPreviewUrl("?scene=tasks&variant=dense&device=split");

    render(<DevPreviewApp />);

    expect(screen.getByText("Aperçu rapide de toutes les vues")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tâches" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTitle("Aperçu iPhone preview")).toBeInTheDocument();
    expect(screen.getByTitle("Aperçu desktop preview")).toBeInTheDocument();
  });

  it("rend la frame d'authentification avec un état succès simulé", () => {
    setPreviewUrl("?frame=1&scene=auth&variant=success&theme=light&device=desktop");

    render(<DevPreviewApp />);

    expect(screen.getByText("Acceder a l'application")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Compte créé. Vérifie ton e-mail pour confirmer l'inscription avant la première connexion."
      )
    ).toBeInTheDocument();
  });

  it("ouvre l'assistant mocké dans la frame dédiée", () => {
    setPreviewUrl("?frame=1&scene=assistant&variant=error&theme=light&device=mobile");

    render(<DevPreviewApp />);

    expect(screen.getByRole("dialog", { name: "Assistant IA" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Le copilote de preview simule une erreur lisible, sans exposer de détail technique."
      )
    ).toBeInTheDocument();
  });
});
