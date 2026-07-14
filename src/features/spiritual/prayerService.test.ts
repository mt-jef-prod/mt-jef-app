import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PRAYER_SETTINGS,
  buildFallbackPrayerLocation,
  buildPrayerLiveState,
  loadPrayerScheduleBundle,
  zonedDateTimeToDate
} from "./prayerService";

function createApiPayload(
  dateKey: string,
  timings: {
    fajr: string;
    sunrise: string;
    dhuhr: string;
    asr: string;
    maghrib: string;
    isha: string;
  },
  timeZone = "Europe/Paris"
) {
  const [year, month, day] = dateKey.split("-");

  return {
    code: 200,
    data: {
      timings: {
        Fajr: timings.fajr,
        Sunrise: timings.sunrise,
        Dhuhr: timings.dhuhr,
        Asr: timings.asr,
        Maghrib: timings.maghrib,
        Isha: timings.isha
      },
      meta: {
        timezone: timeZone
      },
      date: {
        gregorian: {
          day,
          month: { en: month },
          year
        },
        hijri: {
          day: "18",
          month: { en: "Muharram" },
          year: "1448"
        }
      }
    }
  };
}

function createFetcher(payloads: Record<string, ReturnType<typeof createApiPayload>>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const dateKey = url.match(/\/timings(?:ByCity)?\/(\d{4}-\d{2}-\d{2})\?/)?.[1];

    if (!dateKey || !payloads[dateKey]) {
      return new Response("not found", { status: 404 });
    }

    return new Response(JSON.stringify(payloads[dateKey]), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  });
}

describe("prayerService", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("calcule la prochaine priere, la fenetre courante et parse les horaires", async () => {
    const location = buildFallbackPrayerLocation({
      city: "Montreuil",
      country: "France",
      timezone: "Europe/Paris"
    });
    const fetcher = createFetcher({
      "2026-07-14": createApiPayload("2026-07-14", {
        fajr: "05:12 (CEST)",
        sunrise: "06:44 (CEST)",
        dhuhr: "13:52",
        asr: "17:48",
        maghrib: "21:37",
        isha: "23:01"
      }),
      "2026-07-15": createApiPayload("2026-07-15", {
        fajr: "05:13",
        sunrise: "06:45",
        dhuhr: "13:52",
        asr: "17:48",
        maghrib: "21:36",
        isha: "23:00"
      })
    });

    const result = await loadPrayerScheduleBundle({
      location,
      settings: DEFAULT_PRAYER_SETTINGS,
      dateKey: "2026-07-14",
      fetcher
    });

    expect(result.bundle.today.entries[0].time).toBe("05:12");
    expect(result.bundle.today.calculationLabel).toBe("UOIF - France");

    const state = buildPrayerLiveState({
      bundle: result.bundle,
      now: new Date("2026-07-14T03:30:00.000Z"),
      prayerStatuses: {
        fajr: "completed",
        dhuhr: "not_recorded",
        asr: "late",
        maghrib: "missed",
        isha: "not_recorded"
      }
    });

    expect(state.currentPrayer).toBe("fajr");
    expect(state.nextPrayer).toBe("dhuhr");
    expect(state.completedCount).toBe(2);
    expect(state.dayProgress).toBeGreaterThan(0);
  });

  it("bascule sur le fajr du lendemain apres isha", async () => {
    const location = buildFallbackPrayerLocation({
      city: "Montreuil",
      country: "France",
      timezone: "Europe/Paris"
    });
    const fetcher = createFetcher({
      "2026-07-14": createApiPayload("2026-07-14", {
        fajr: "05:12",
        sunrise: "06:44",
        dhuhr: "13:52",
        asr: "17:48",
        maghrib: "21:37",
        isha: "23:01"
      }),
      "2026-07-15": createApiPayload("2026-07-15", {
        fajr: "05:13",
        sunrise: "06:45",
        dhuhr: "13:52",
        asr: "17:48",
        maghrib: "21:36",
        isha: "23:00"
      })
    });

    const result = await loadPrayerScheduleBundle({
      location,
      settings: DEFAULT_PRAYER_SETTINGS,
      dateKey: "2026-07-14",
      fetcher
    });

    const state = buildPrayerLiveState({
      bundle: result.bundle,
      now: new Date("2026-07-14T21:20:00.000Z")
    });

    expect(state.currentPrayer).toBe("isha");
    expect(state.nextPrayer).toBe("fajr");
    expect(state.nextPrayerTime).toBe("05:13");
  });

  it("retombe sur la ville du profil ou Montreuil si la localisation est indisponible", () => {
    expect(
      buildFallbackPrayerLocation({
        city: "Lille",
        country: "France",
        timezone: "Europe/Paris"
      })
    ).toMatchObject({
      source: "profile_city",
      city: "Lille",
      country: "France",
      timezone: "Europe/Paris"
    });

    expect(buildFallbackPrayerLocation({})).toMatchObject({
      source: "fallback",
      city: "Montreuil",
      country: "France",
      timezone: "Europe/Paris"
    });
  });

  it("reutilise le cache du jour sans refaire un appel reseau", async () => {
    const location = buildFallbackPrayerLocation({
      city: "Montreuil",
      country: "France",
      timezone: "Europe/Paris"
    });
    const liveFetcher = createFetcher({
      "2026-07-14": createApiPayload("2026-07-14", {
        fajr: "05:12",
        sunrise: "06:44",
        dhuhr: "13:52",
        asr: "17:48",
        maghrib: "21:37",
        isha: "23:01"
      }),
      "2026-07-15": createApiPayload("2026-07-15", {
        fajr: "05:13",
        sunrise: "06:45",
        dhuhr: "13:52",
        asr: "17:48",
        maghrib: "21:36",
        isha: "23:00"
      })
    });

    await loadPrayerScheduleBundle({
      location,
      settings: DEFAULT_PRAYER_SETTINGS,
      dateKey: "2026-07-14",
      fetcher: liveFetcher
    });

    const offlineFetcher = vi.fn(async () => {
      throw new Error("offline");
    });

    const cached = await loadPrayerScheduleBundle({
      location,
      settings: DEFAULT_PRAYER_SETTINGS,
      dateKey: "2026-07-14",
      fetcher: offlineFetcher
    });

    expect(cached.bundle.source).toBe("live");
    expect(offlineFetcher).not.toHaveBeenCalled();
  });

  it("garde le dernier horaire connu hors connexion au changement de jour", async () => {
    const location = buildFallbackPrayerLocation({
      city: "Montreuil",
      country: "France",
      timezone: "Europe/Paris"
    });
    const liveFetcher = createFetcher({
      "2026-07-14": createApiPayload("2026-07-14", {
        fajr: "05:12",
        sunrise: "06:44",
        dhuhr: "13:52",
        asr: "17:48",
        maghrib: "21:37",
        isha: "23:01"
      }),
      "2026-07-15": createApiPayload("2026-07-15", {
        fajr: "05:13",
        sunrise: "06:45",
        dhuhr: "13:52",
        asr: "17:48",
        maghrib: "21:36",
        isha: "23:00"
      })
    });

    await loadPrayerScheduleBundle({
      location,
      settings: DEFAULT_PRAYER_SETTINGS,
      dateKey: "2026-07-14",
      fetcher: liveFetcher
    });

    const offlineFetcher = vi.fn(async () => {
      throw new Error("offline");
    });

    const stale = await loadPrayerScheduleBundle({
      location,
      settings: DEFAULT_PRAYER_SETTINGS,
      dateKey: "2026-07-16",
      fetcher: offlineFetcher
    });

    expect(stale.bundle.source).toBe("cache");
    expect(stale.bundle.stale).toBe(true);
    expect(stale.warning).toContain("dernier calcul connu");
    expect(stale.bundle.today.dateKey).toBe("2026-07-14");
  });

  it("respecte le fuseau horaire pour convertir une heure locale en date ISO", () => {
    expect(zonedDateTimeToDate("2026-07-14", "05:00", "Europe/Paris").toISOString()).toBe(
      "2026-07-14T03:00:00.000Z"
    );
    expect(zonedDateTimeToDate("2026-07-14", "05:00", "Africa/Dakar").toISOString()).toBe(
      "2026-07-14T05:00:00.000Z"
    );
  });
});
