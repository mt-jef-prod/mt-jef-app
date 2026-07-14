import { useCallback, useEffect, useMemo, useState } from "react";
import type { PrayerLogRow } from "../../lib/types";
import {
  buildFallbackPrayerLocation,
  buildPrayerLiveState,
  createGeolocationPrayerLocation,
  currentPrayerDate,
  hasPromptedPrayerGeolocation,
  loadPrayerScheduleBundle,
  markPrayerGeolocationPrompted,
  readPrayerSettings,
  todayPrayerStatuses,
  writePrayerSettings,
  type PrayerLiveState,
  type PrayerLocation,
  type PrayerScheduleBundle,
  type PrayerSettings
} from "./prayerService";

interface UsePrayerTimesOptions {
  city?: string | null;
  country?: string | null;
  timezone?: string | null;
  prayerLogs?: PrayerLogRow[];
}

interface UsePrayerTimesResult {
  loading: boolean;
  bundle: PrayerScheduleBundle | null;
  liveState: PrayerLiveState | null;
  warning: string | null;
  error: string | null;
  settings: PrayerSettings;
  location: PrayerLocation | null;
  setSettings: (settings: PrayerSettings) => void;
  refresh: (options?: {
    forceLocationPrompt?: boolean;
    forceNetwork?: boolean;
    settingsOverride?: PrayerSettings;
  }) => Promise<void>;
}

function browserOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function requestCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation unsupported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 30 * 60 * 1_000
    });
  });
}

async function resolvePrayerLocation(options: {
  city?: string | null;
  country?: string | null;
  timezone?: string | null;
  forceLocationPrompt?: boolean;
}): Promise<PrayerLocation> {
  const fallback = buildFallbackPrayerLocation(options);

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return {
      ...fallback,
      permission: "unsupported"
    };
  }

  let permissionState: PermissionState | "unsupported" = "prompt";

  try {
    if (navigator.permissions?.query) {
      const result = await navigator.permissions.query({
        name: "geolocation"
      } as PermissionDescriptor);
      permissionState = result.state;
    }
  } catch {
    permissionState = "prompt";
  }

  const shouldPrompt =
    options.forceLocationPrompt ||
    permissionState === "granted" ||
    (permissionState === "prompt" && !hasPromptedPrayerGeolocation());

  if (!shouldPrompt) {
    return {
      ...fallback,
      permission: permissionState === "denied" ? "denied" : fallback.permission
    };
  }

  markPrayerGeolocationPrompted();

  try {
    const position = await requestCurrentPosition();

    return createGeolocationPrayerLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      city: options.city,
      country: options.country,
      timezone: options.timezone
    });
  } catch {
    return {
      ...fallback,
      permission: permissionState === "granted" ? "fallback" : "denied"
    };
  }
}

export function usePrayerTimes({
  city,
  country,
  timezone,
  prayerLogs = []
}: UsePrayerTimesOptions): UsePrayerTimesResult {
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState<PrayerScheduleBundle | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettingsState] = useState<PrayerSettings>(() => readPrayerSettings());
  const [location, setLocation] = useState<PrayerLocation | null>(null);
  const [now, setNow] = useState(() => new Date());

  const statuses = useMemo(() => todayPrayerStatuses(prayerLogs), [prayerLogs]);

  const refresh = useCallback(
    async (options?: {
      forceLocationPrompt?: boolean;
      forceNetwork?: boolean;
      settingsOverride?: PrayerSettings;
    }) => {
      setLoading(true);
      setError(null);
      setWarning(null);

      const activeSettings = options?.settingsOverride ?? settings;

      try {
        const resolvedLocation = await resolvePrayerLocation({
          city,
          country,
          timezone,
          forceLocationPrompt: options?.forceLocationPrompt
        });
        const dateKey = currentPrayerDate(resolvedLocation.timezone);
        const result = await loadPrayerScheduleBundle({
          location: resolvedLocation,
          settings: activeSettings,
          dateKey,
          forceRefresh: options?.forceNetwork
        });

        setLocation(resolvedLocation);
        setBundle(result.bundle);
        setWarning(
          !browserOnline()
            ? result.warning ?? "Mode hors ligne : derniers horaires connus affichés."
            : result.warning
        );
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les horaires de prières.";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [city, country, settings, timezone]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!bundle || loading) {
      return;
    }

    const currentDateKey = currentPrayerDate(location?.timezone ?? timezone);

    if (currentDateKey !== bundle.today.dateKey) {
      void refresh();
    }
  }, [bundle, loading, location?.timezone, now, refresh, timezone]);

  const liveState = useMemo(() => {
    if (!bundle) {
      return null;
    }

    return buildPrayerLiveState({
      bundle,
      now,
      prayerStatuses: statuses
    });
  }, [bundle, now, statuses]);

  const setSettings = useCallback((nextSettings: PrayerSettings) => {
    setSettingsState(nextSettings);
    writePrayerSettings(nextSettings);
  }, []);

  return {
    loading,
    bundle,
    liveState,
    warning,
    error,
    settings,
    location,
    setSettings,
    refresh
  };
}
