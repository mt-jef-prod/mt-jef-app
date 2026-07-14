import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PrayerSummaryCard } from "./PrayerSummaryCard";

describe("PrayerSummaryCard", () => {
  it("affiche la synthese, le warning hors ligne et le raccourci vers l'ecran complet", () => {
    const onOpenDetails = vi.fn();

    render(
      <PrayerSummaryCard
        liveState={{
          nextPrayer: "maghrib",
          nextPrayerLabel: "Maghrib",
          nextPrayerTime: "21:37",
          nextPrayerIso: "2026-07-14T19:37:00.000Z",
          countdownLabel: "42 min 12 s",
          currentPrayer: "asr",
          currentPrayerLabel: "Asr",
          dayProgress: 73,
          completedCount: 3,
          completionProgress: 60
        }}
        warning="Mode hors ligne : derniers horaires connus affiches."
        onOpenDetails={onOpenDetails}
      />
    );

    expect(screen.getByText("Maghrib · 21:37")).toBeInTheDocument();
    expect(screen.getByText("Prochaine prière dans 42 min 12 s")).toBeInTheDocument();
    expect(screen.getByText("Mode hors ligne : derniers horaires connus affiches.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voir toutes les prières" })).toBeInTheDocument();
    expect(screen.getByText("73 %")).toBeInTheDocument();
    expect(screen.getByText("3/5")).toBeInTheDocument();
  });
});
