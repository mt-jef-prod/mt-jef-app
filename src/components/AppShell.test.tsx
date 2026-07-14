import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import type { NoticeState, ProfileRow, SectionDefinition } from "../lib/types";

vi.mock("../features/assistant/AssistantWidget", () => ({
  AssistantWidget: () => <div data-testid="assistant-widget">AssistantWidget</div>
}));

const sections: SectionDefinition[] = [
  { id: "dashboard", label: "Aujourd'hui", kicker: "Vue centrale" },
  { id: "intention", label: "Intention", kicker: "Niyya" },
  { id: "family", label: "Famille", kicker: "Lien & rappels" },
  { id: "projects", label: "Projets", kicker: "Cap & étapes" },
  { id: "tasks", label: "Tâches", kicker: "Action immédiate" },
  { id: "finances", label: "Finances", kicker: "Flux & budgets" },
  { id: "spiritual", label: "Prières", kicker: "Ancrage" },
  { id: "review", label: "Revue", kicker: "Tekki" }
];

const profile: ProfileRow = {
  id: "user-1",
  first_name: "Moctar",
  last_name: "Jef",
  birth_date: null,
  city: "Paris",
  country: "France",
  timezone: "Europe/Paris",
  preferred_currency: "EUR",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

function renderShell(notice: NoticeState | null = null) {
  return render(
    <AppShell
      profile={profile}
      profileLoading={false}
      sections={sections}
      activeSection="dashboard"
      onSelectSection={vi.fn()}
      onSignOut={vi.fn().mockResolvedValue(undefined)}
      notice={notice}
      onSaveProfile={vi.fn().mockResolvedValue(undefined)}
      assistantTimeZone="Europe/Paris"
    >
      <div>Contenu</div>
    </AppShell>
  );
}

describe("AppShell", () => {
  it("affiche la navigation principale", () => {
    renderShell();

    expect(screen.getByRole("navigation", { name: "Navigation principale" })).toBeInTheDocument();
    expect(screen.getAllByText("Aujourd'hui").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Projets").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Finances").length).toBeGreaterThan(0);
  });

  it("ouvre le panneau Plus", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getAllByRole("button", { name: "Plus" })[0]);

    expect(
      screen.getByText("Sections secondaires, profil et dépannage.")
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Profil" }).length).toBeGreaterThan(0);
  });

  it("adapte l'en-tête principal à la section active", () => {
    render(
      <AppShell
        profile={profile}
        profileLoading={false}
        sections={sections}
        activeSection="projects"
        onSelectSection={vi.fn()}
        onSignOut={vi.fn().mockResolvedValue(undefined)}
        notice={null}
        onSaveProfile={vi.fn().mockResolvedValue(undefined)}
        assistantTimeZone="Europe/Paris"
      >
        <div>Contenu</div>
      </AppShell>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Projets" })).toBeInTheDocument();
    expect(screen.getByText("Transformer une intention en trajectoire lisible.")).toBeInTheDocument();
  });

  it("affiche la notification via le toast", () => {
    renderShell({ kind: "success", message: "Profil mis à jour." });

    expect(screen.getByText("Profil mis à jour.")).toBeInTheDocument();
  });

  it("utilise un assistant injecté quand un slot est fourni", () => {
    render(
      <AppShell
        profile={profile}
        profileLoading={false}
        sections={sections}
        activeSection="dashboard"
        onSelectSection={vi.fn()}
        onSignOut={vi.fn().mockResolvedValue(undefined)}
        notice={null}
        onSaveProfile={vi.fn().mockResolvedValue(undefined)}
        assistantTimeZone="Europe/Paris"
        assistantSlot={<div data-testid="preview-assistant">PreviewAssistant</div>}
      >
        <div>Contenu</div>
      </AppShell>
    );

    expect(screen.getByTestId("preview-assistant")).toBeInTheDocument();
    expect(screen.queryByTestId("assistant-widget")).not.toBeInTheDocument();
  });
});
