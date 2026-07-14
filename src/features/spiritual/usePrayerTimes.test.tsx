import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrayerScheduleBundle } from "./prayerService";

const prayerServiceMocks = vi.hoisted(() => ({
  loadPrayerScheduleBundle: vi.fn(),
  hasPromptedPrayerGeolocation: vi.fn(() => false),
  markPrayerGeolocationPrompted: vi.fn()
}));

vi.mock("./prayerService", async () => {
  const actual = await vi.importActual<typeof import("./prayerService")>("./prayerService");

  return {
    ...actual,
    loadPrayerScheduleBundle: prayerServiceMocks.loadPrayerScheduleBundle,
    hasPromptedPrayerGeolocation: prayerServiceMocks.hasPromptedPrayerGeolocation,
    markPrayerGeolocationPrompted: prayerServiceMocks.markPrayerGeolocationPrompted
  };
});

import { usePrayerTimes } from "./usePrayerTimes";

function createBundle(): PrayerScheduleBundle {
  return {
    location: {
      source: "profile_city",
      permission: "denied",
      city: "Marseille",
      country: "France",
      label: "Marseille",
      latitude: null,
      longitude: null,
      timezone: "Europe/Paris"
    },
    settings: {
      calculationMethod: "uoif",
      madhab: "standard",
      adjustments: {
        fajr: 0,
        sunrise: 0,
        dhuhr: 0,
        asr: 0,
        maghrib: 0,
        isha: 0
      }
    },
    today: {
      dateKey: "2026-07-14",
      gregorianLabel: "mardi 14 juillet 2026",
      hijriLabel: "18 Muharram 1448",
      timezone: "Europe/Paris",
      locationLabel: "Marseille",
      calculationLabel: "UOIF - France",
      method: "uoif",
      madhab: "standard",
      entries: [
        {
          name: "fajr",
          label: "Fajr",
          time: "05:12",
          iso: "2026-07-14T03:12:00.000Z"
        },
        {
          name: "sunrise",
          label: "Chourouq",
          time: "06:44",
          iso: "2026-07-14T04:44:00.000Z"
        },
        {
          name: "dhuhr",
          label: "Dhuhr",
          time: "13:52",
          iso: "2026-07-14T11:52:00.000Z"
        },
        {
          name: "asr",
          label: "Asr",
          time: "17:48",
          iso: "2026-07-14T15:48:00.000Z"
        },
        {
          name: "maghrib",
          label: "Maghrib",
          time: "21:37",
          iso: "2026-07-14T19:37:00.000Z"
        },
        {
          name: "isha",
          label: "Isha",
          time: "23:01",
          iso: "2026-07-14T21:01:00.000Z"
        }
      ],
      fetchedAt: "2026-07-14T08:00:00.000Z"
    },
    tomorrow: {
      dateKey: "2026-07-15",
      gregorianLabel: "mercredi 15 juillet 2026",
      hijriLabel: "19 Muharram 1448",
      timezone: "Europe/Paris",
      locationLabel: "Marseille",
      calculationLabel: "UOIF - France",
      method: "uoif",
      madhab: "standard",
      entries: [
        {
          name: "fajr",
          label: "Fajr",
          time: "05:13",
          iso: "2026-07-15T03:13:00.000Z"
        },
        {
          name: "sunrise",
          label: "Chourouq",
          time: "06:45",
          iso: "2026-07-15T04:45:00.000Z"
        },
        {
          name: "dhuhr",
          label: "Dhuhr",
          time: "13:52",
          iso: "2026-07-15T11:52:00.000Z"
        },
        {
          name: "asr",
          label: "Asr",
          time: "17:48",
          iso: "2026-07-15T15:48:00.000Z"
        },
        {
          name: "maghrib",
          label: "Maghrib",
          time: "21:36",
          iso: "2026-07-15T19:36:00.000Z"
        },
        {
          name: "isha",
          label: "Isha",
          time: "23:00",
          iso: "2026-07-15T21:00:00.000Z"
        }
      ],
      fetchedAt: "2026-07-14T08:00:00.000Z"
    },
    source: "live",
    stale: false,
    fetchedAt: "2026-07-14T08:00:00.000Z"
  };
}

function HookHarness() {
  const state = usePrayerTimes({
    city: "Marseille",
    country: "France",
    timezone: "Europe/Paris"
  });

  return (
    <div>
      <span data-testid="location-source">{state.location?.source ?? "none"}</span>
      <span data-testid="location-city">{state.location?.city ?? "none"}</span>
      <span data-testid="warning">{state.warning ?? ""}</span>
      <span data-testid="date-key">{state.bundle?.today.dateKey ?? "none"}</span>
    </div>
  );
}

describe("usePrayerTimes", () => {
  beforeEach(() => {
    prayerServiceMocks.loadPrayerScheduleBundle.mockReset();
    prayerServiceMocks.hasPromptedPrayerGeolocation.mockReturnValue(false);
    prayerServiceMocks.markPrayerGeolocationPrompted.mockReset();
    prayerServiceMocks.loadPrayerScheduleBundle.mockResolvedValue({
      bundle: createBundle(),
      warning: null
    });

    Object.defineProperty(window.navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: "denied" })
      }
    });

    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn()
      }
    });
  });

  it("utilise la ville du profil si la geolocalisation est refusee", async () => {
    render(<HookHarness />);

    await waitFor(() => {
      expect(screen.getByTestId("location-source")).toHaveTextContent("profile_city");
    });

    expect(screen.getByTestId("location-city")).toHaveTextContent("Marseille");
    expect(prayerServiceMocks.loadPrayerScheduleBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        location: expect.objectContaining({
          source: "profile_city",
          city: "Marseille",
          country: "France"
        })
      })
    );
  });
});
