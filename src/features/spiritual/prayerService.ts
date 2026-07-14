import type { PrayerLogRow, PrayerStatus } from "../../lib/types";
import { resolveTimeZone, todayDate } from "../../lib/utils";

export type PrayerTimingName = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";
export type PrayerTrackedName = PrayerLogRow["prayer_name"];
export type PrayerCalculationMethod =
  | "uoif"
  | "muslim_world_league"
  | "egyptian"
  | "umm_al_qura";
export type PrayerMadhab = "standard" | "hanafi";
export type PrayerLocationSource = "geolocation" | "profile_city" | "fallback";
export type PrayerPermissionState = "granted" | "prompt" | "denied" | "unsupported" | "fallback";

export interface PrayerAdjustmentMap {
  fajr: number;
  sunrise: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

export interface PrayerSettings {
  calculationMethod: PrayerCalculationMethod;
  madhab: PrayerMadhab;
  adjustments: PrayerAdjustmentMap;
}

export interface PrayerLocation {
  source: PrayerLocationSource;
  permission: PrayerPermissionState;
  city: string;
  country: string;
  label: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
}

export interface PrayerEntry {
  name: PrayerTimingName;
  label: string;
  time: string;
  iso: string;
}

export interface PrayerDaySchedule {
  dateKey: string;
  gregorianLabel: string;
  hijriLabel: string;
  timezone: string;
  locationLabel: string;
  calculationLabel: string;
  method: PrayerCalculationMethod;
  madhab: PrayerMadhab;
  entries: PrayerEntry[];
  fetchedAt: string;
}

export interface PrayerScheduleBundle {
  location: PrayerLocation;
  settings: PrayerSettings;
  today: PrayerDaySchedule;
  tomorrow: PrayerDaySchedule;
  source: "live" | "cache";
  stale: boolean;
  fetchedAt: string;
}

export interface PrayerLiveState {
  nextPrayer: PrayerTrackedName;
  nextPrayerLabel: string;
  nextPrayerTime: string;
  nextPrayerIso: string;
  countdownLabel: string;
  currentPrayer: PrayerTrackedName | null;
  currentPrayerLabel: string | null;
  dayProgress: number;
  completedCount: number;
  completionProgress: number;
}

export interface PrayerLoadResult {
  bundle: PrayerScheduleBundle;
  warning: string | null;
}

interface AlAdhanDatePart {
  day?: string;
  month?: { en?: string };
  year?: string;
}

interface AlAdhanResponse {
  code?: number;
  data?: {
    timings?: Record<string, string | undefined>;
    meta?: {
      timezone?: string;
    };
    date?: {
      gregorian?: AlAdhanDatePart;
      hijri?: AlAdhanDatePart;
    };
  };
}

const PRAYER_CACHE_PREFIX = "mt-jef-prayers-cache-v1:";
const PRAYER_SETTINGS_STORAGE_KEY = "mt-jef-prayers-settings-v1";
const PRAYER_GEOLOCATION_PROMPT_KEY = "mt-jef-prayers-geolocation-prompted-v1";
const DEFAULT_CITY = "Montreuil";
const DEFAULT_COUNTRY = "France";
const DEFAULT_TIMEZONE = "Europe/Paris";
const ALADHAN_BASE_URL = "https://api.aladhan.com/v1";

const TRACKED_PRAYERS: PrayerTrackedName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const SCHEDULE_PRAYERS: PrayerTimingName[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

const PRAYER_LABELS: Record<PrayerTimingName, string> = {
  fajr: "Fajr",
  sunrise: "Chourouq",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha"
};

const TRACKED_LABELS: Record<PrayerTrackedName, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha"
};

const CALCULATION_METHODS: Record<
  PrayerCalculationMethod,
  { id: number; label: string }
> = {
  uoif: { id: 12, label: "UOIF - France" },
  muslim_world_league: { id: 3, label: "Ligue musulmane mondiale" },
  egyptian: { id: 5, label: "Autorité égyptienne" },
  umm_al_qura: { id: 4, label: "Umm al-Qura" }
};

export const PRAYER_STATUS_OPTIONS: Array<{ value: PrayerStatus; label: string }> = [
  { value: "completed", label: "Accomplie" },
  { value: "late", label: "En retard" },
  { value: "missed", label: "Manquée" },
  { value: "not_recorded", label: "Non notée" }
];

export const DEFAULT_PRAYER_SETTINGS: PrayerSettings = {
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
};

export const PRAYER_CALCULATION_OPTIONS = Object.entries(CALCULATION_METHODS).map(
  ([value, option]) => ({
    value: value as PrayerCalculationMethod,
    label: option.label
  })
);

export const PRAYER_MADHAB_OPTIONS: Array<{ value: PrayerMadhab; label: string }> = [
  { value: "standard", label: "Standard" },
  { value: "hanafi", label: "Hanafi" }
];

function readStorageValue(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parseOffsetToMinutes(offsetLabel: string): number {
  const match = offsetLabel.match(/GMT([+-])(\d{2}):?(\d{2})?/i);

  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");

  return sign * (hours * 60 + minutes);
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23"
  });

  const offsetLabel =
    formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";

  return parseOffsetToMinutes(offsetLabel);
}

export function zonedDateTimeToDate(dateKey: string, time: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = normalizeTimingValue(time).split(":").map(Number);
  const utcBase = Date.UTC(year, month - 1, day, hours, minutes, 0);
  let result = new Date(utcBase - getTimeZoneOffsetMinutes(new Date(utcBase), timeZone) * 60_000);
  const nextOffset = getTimeZoneOffsetMinutes(result, timeZone);
  result = new Date(utcBase - nextOffset * 60_000);

  return result;
}

export function normalizeTimingValue(value: string): string {
  const match = value.match(/(\d{1,2}:\d{2})/);
  return match?.[1] ?? value.slice(0, 5);
}

function formatGregorianLabel(dateKey: string, timeZone: string): string {
  const date = zonedDateTimeToDate(dateKey, "12:00", timeZone);

  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone
  }).format(date);
}

function formatHijriLabel(dateKey: string, timeZone: string): string {
  const date = zonedDateTimeToDate(dateKey, "12:00", timeZone);

  return new Intl.DateTimeFormat("fr-FR-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone
  }).format(date);
}

function formatApiDate(part: AlAdhanDatePart | undefined, fallback: string): string {
  const day = part?.day;
  const month = part?.month?.en;
  const year = part?.year;

  if (!day || !month || !year) {
    return fallback;
  }

  return `${day} ${month} ${year}`;
}

function tuneQuery(settings: PrayerSettings): string {
  const adjustments = settings.adjustments;
  return [
    adjustments.fajr,
    adjustments.sunrise,
    adjustments.dhuhr,
    adjustments.asr,
    adjustments.maghrib,
    adjustments.isha
  ].join(",");
}

export function buildPrayerFetchUrl(
  dateKey: string,
  location: PrayerLocation,
  settings: PrayerSettings
): string {
  const methodId = CALCULATION_METHODS[settings.calculationMethod].id;
  const school = settings.madhab === "hanafi" ? "1" : "0";
  const params = new URLSearchParams({
    method: String(methodId),
    school,
    tune: tuneQuery(settings)
  });

  if (location.latitude != null && location.longitude != null) {
    params.set("latitude", String(location.latitude));
    params.set("longitude", String(location.longitude));
    return `${ALADHAN_BASE_URL}/timings/${dateKey}?${params.toString()}`;
  }

  params.set("city", location.city);
  params.set("country", location.country);
  return `${ALADHAN_BASE_URL}/timingsByCity/${dateKey}?${params.toString()}`;
}

function buildScheduleEntries(
  dateKey: string,
  timeZone: string,
  timings: Record<PrayerTimingName, string>
): PrayerEntry[] {
  return SCHEDULE_PRAYERS.map((name) => ({
    name,
    label: PRAYER_LABELS[name],
    time: normalizeTimingValue(timings[name]),
    iso: zonedDateTimeToDate(dateKey, timings[name], timeZone).toISOString()
  }));
}

function parseScheduleDay(
  payload: AlAdhanResponse,
  dateKey: string,
  location: PrayerLocation,
  settings: PrayerSettings
): PrayerDaySchedule {
  const timings = payload.data?.timings;

  if (!timings) {
    throw new Error("Réponse d'horaires de prières invalide.");
  }

  const parsedTimings: Record<PrayerTimingName, string> = {
    fajr: normalizeTimingValue(timings.Fajr ?? ""),
    sunrise: normalizeTimingValue(timings.Sunrise ?? ""),
    dhuhr: normalizeTimingValue(timings.Dhuhr ?? ""),
    asr: normalizeTimingValue(timings.Asr ?? ""),
    maghrib: normalizeTimingValue(timings.Maghrib ?? ""),
    isha: normalizeTimingValue(timings.Isha ?? "")
  };

  const timeZone = payload.data?.meta?.timezone ?? location.timezone;

  if (Object.values(parsedTimings).some((value) => !/^\d{1,2}:\d{2}$/.test(value))) {
    throw new Error("Certaines heures de prières sont invalides.");
  }

  return {
    dateKey,
    gregorianLabel: formatApiDate(payload.data?.date?.gregorian, formatGregorianLabel(dateKey, timeZone)),
    hijriLabel: formatApiDate(payload.data?.date?.hijri, formatHijriLabel(dateKey, timeZone)),
    timezone: timeZone,
    locationLabel: location.label,
    calculationLabel: CALCULATION_METHODS[settings.calculationMethod].label,
    method: settings.calculationMethod,
    madhab: settings.madhab,
    entries: buildScheduleEntries(dateKey, timeZone, parsedTimings),
    fetchedAt: new Date().toISOString()
  };
}

function cacheKey(location: PrayerLocation, settings: PrayerSettings, dateKey: string): string {
  const adjustments = Object.values(settings.adjustments).join(",");
  const locationKey =
    location.latitude != null && location.longitude != null
      ? `${location.latitude.toFixed(2)}:${location.longitude.toFixed(2)}`
      : `${location.city.toLowerCase()}:${location.country.toLowerCase()}`;

  return [
    PRAYER_CACHE_PREFIX,
    dateKey,
    locationKey,
    settings.calculationMethod,
    settings.madhab,
    adjustments
  ].join("|");
}

function readPrayerCache(
  location: PrayerLocation,
  settings: PrayerSettings,
  dateKey: string
): PrayerScheduleBundle | null {
  return safeJsonParse<PrayerScheduleBundle>(readStorageValue(cacheKey(location, settings, dateKey)));
}

function matchesCacheContext(
  bundle: PrayerScheduleBundle,
  location: PrayerLocation,
  settings: PrayerSettings
): boolean {
  const sameCoordinates =
    bundle.location.latitude === location.latitude && bundle.location.longitude === location.longitude;
  const samePlace =
    bundle.location.city.toLowerCase() === location.city.toLowerCase() &&
    bundle.location.country.toLowerCase() === location.country.toLowerCase();
  const sameMethod =
    bundle.settings.calculationMethod === settings.calculationMethod &&
    bundle.settings.madhab === settings.madhab;
  const sameAdjustments =
    JSON.stringify(bundle.settings.adjustments) === JSON.stringify(settings.adjustments);

  return (sameCoordinates || samePlace) && sameMethod && sameAdjustments;
}

function readLatestPrayerCache(
  location: PrayerLocation,
  settings: PrayerSettings
): PrayerScheduleBundle | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    let latestBundle: PrayerScheduleBundle | null = null;

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);

      if (!key?.startsWith(PRAYER_CACHE_PREFIX)) {
        continue;
      }

      const bundle = safeJsonParse<PrayerScheduleBundle>(window.localStorage.getItem(key));

      if (!bundle || !matchesCacheContext(bundle, location, settings)) {
        continue;
      }

      if (!latestBundle || bundle.fetchedAt > latestBundle.fetchedAt) {
        latestBundle = bundle;
      }
    }

    return latestBundle;
  } catch {
    return null;
  }
}

function writePrayerCache(bundle: PrayerScheduleBundle) {
  writeStorageValue(cacheKey(bundle.location, bundle.settings, bundle.today.dateKey), JSON.stringify(bundle));
}

async function fetchPrayerDay(
  dateKey: string,
  location: PrayerLocation,
  settings: PrayerSettings,
  fetcher: typeof fetch
): Promise<PrayerDaySchedule> {
  const response = await fetcher(buildPrayerFetchUrl(dateKey, location, settings), {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Impossible de récupérer les horaires de prières (${response.status}).`);
  }

  const payload = (await response.json()) as AlAdhanResponse;
  return parseScheduleDay(payload, dateKey, location, settings);
}

export async function loadPrayerScheduleBundle(args: {
  location: PrayerLocation;
  settings: PrayerSettings;
  dateKey: string;
  fetcher?: typeof fetch;
  forceRefresh?: boolean;
}): Promise<PrayerLoadResult> {
  const { location, settings, dateKey, forceRefresh = false } = args;
  const fetcher = args.fetcher ?? fetch;
  const cached = !forceRefresh ? readPrayerCache(location, settings, dateKey) : null;

  if (cached) {
    return {
      bundle: cached,
      warning: null
    };
  }

  try {
    const tomorrowDate = addDays(dateKey, 1);
    const [today, tomorrow] = await Promise.all([
      fetchPrayerDay(dateKey, location, settings, fetcher),
      fetchPrayerDay(tomorrowDate, location, settings, fetcher)
    ]);

    const bundle: PrayerScheduleBundle = {
      location,
      settings,
      today,
      tomorrow,
      source: "live",
      stale: false,
      fetchedAt: new Date().toISOString()
    };

    writePrayerCache(bundle);

    return {
      bundle,
      warning: null
    };
  } catch (error) {
    const stale = readPrayerCache(location, settings, dateKey) ?? readLatestPrayerCache(location, settings);

    if (stale) {
      return {
        bundle: {
          ...stale,
          source: "cache",
          stale: true
        },
        warning: "Horaires hors ligne : affichage du dernier calcul connu."
      };
    }

    throw error;
  }
}

export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + days);

  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function trackedPrayerTime(bundle: PrayerDaySchedule, name: PrayerTrackedName): PrayerEntry {
  const match = bundle.entries.find((entry) => entry.name === name);

  if (!match) {
    throw new Error(`Horaire ${name} manquant.`);
  }

  return match;
}

function prayerLogStatusMap(logs: Record<PrayerTrackedName, PrayerStatus | undefined>) {
  return TRACKED_PRAYERS.map((name) => logs[name] === "completed" || logs[name] === "late");
}

export function buildPrayerLiveState(args: {
  bundle: PrayerScheduleBundle;
  now?: Date;
  prayerStatuses?: Partial<Record<PrayerTrackedName, PrayerStatus>>;
}): PrayerLiveState {
  const now = args.now ?? new Date();
  const { bundle } = args;
  const trackedToday = TRACKED_PRAYERS.map((name) => trackedPrayerTime(bundle.today, name));
  const tomorrowFajr = trackedPrayerTime(bundle.tomorrow, "fajr");
  const nextPrayerEntry = trackedToday.find((entry) => new Date(entry.iso).getTime() > now.getTime()) ?? tomorrowFajr;
  const nextPrayer = nextPrayerEntry.name as PrayerTrackedName;
  const nextPrayerAt = new Date(nextPrayerEntry.iso);

  let currentPrayer: PrayerTrackedName | null = null;

  const fajr = trackedPrayerTime(bundle.today, "fajr");
  const sunrise = bundle.today.entries.find((entry) => entry.name === "sunrise");
  const dhuhr = trackedPrayerTime(bundle.today, "dhuhr");
  const asr = trackedPrayerTime(bundle.today, "asr");
  const maghrib = trackedPrayerTime(bundle.today, "maghrib");
  const isha = trackedPrayerTime(bundle.today, "isha");

  const windows: Array<{ prayer: PrayerTrackedName; start: string; end: string }> = [
    { prayer: "fajr", start: fajr.iso, end: sunrise?.iso ?? dhuhr.iso },
    { prayer: "dhuhr", start: dhuhr.iso, end: asr.iso },
    { prayer: "asr", start: asr.iso, end: maghrib.iso },
    { prayer: "maghrib", start: maghrib.iso, end: isha.iso },
    { prayer: "isha", start: isha.iso, end: tomorrowFajr.iso }
  ];

  currentPrayer =
    windows.find((window) => {
      const start = new Date(window.start).getTime();
      const end = new Date(window.end).getTime();
      return now.getTime() >= start && now.getTime() < end;
    })?.prayer ?? null;

  const firstPrayerTime = new Date(fajr.iso).getTime();
  const lastPrayerTime = new Date(isha.iso).getTime();
  const dayProgress =
    now.getTime() <= firstPrayerTime
      ? 0
      : now.getTime() >= lastPrayerTime
        ? 100
        : Math.round(((now.getTime() - firstPrayerTime) / (lastPrayerTime - firstPrayerTime)) * 100);

  const statuses = prayerLogStatusMap({
    fajr: args.prayerStatuses?.fajr,
    dhuhr: args.prayerStatuses?.dhuhr,
    asr: args.prayerStatuses?.asr,
    maghrib: args.prayerStatuses?.maghrib,
    isha: args.prayerStatuses?.isha
  });

  const completedCount = statuses.filter(Boolean).length;

  return {
    nextPrayer,
    nextPrayerLabel: TRACKED_LABELS[nextPrayer],
    nextPrayerTime: nextPrayerEntry.time,
    nextPrayerIso: nextPrayerEntry.iso,
    countdownLabel: formatCountdown(nextPrayerAt.getTime() - now.getTime()),
    currentPrayer,
    currentPrayerLabel: currentPrayer ? TRACKED_LABELS[currentPrayer] : null,
    dayProgress,
    completedCount,
    completionProgress: Math.round((completedCount / TRACKED_PRAYERS.length) * 100)
  };
}

export function formatCountdown(milliseconds: number): string {
  if (milliseconds <= 0) {
    return "Maintenant";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} h ${pad2(minutes)}`;
  }

  if (minutes > 0) {
    return `${minutes} min ${pad2(seconds)} s`;
  }

  return `${seconds} s`;
}

export function formatPrayerTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone
  }).format(new Date(iso));
}

export function buildFallbackPrayerLocation(input: {
  city?: string | null;
  country?: string | null;
  timezone?: string | null;
}): PrayerLocation {
  const city = input.city?.trim() || DEFAULT_CITY;
  const country = input.country?.trim() || DEFAULT_COUNTRY;
  const source: PrayerLocationSource = input.city?.trim() ? "profile_city" : "fallback";

  return {
    source,
    permission: source === "fallback" ? "fallback" : "denied",
    city,
    country,
    label: city,
    latitude: null,
    longitude: null,
    timezone: resolveTimeZone(input.timezone ?? DEFAULT_TIMEZONE)
  };
}

export function createGeolocationPrayerLocation(input: {
  latitude: number;
  longitude: number;
  city?: string | null;
  country?: string | null;
  timezone?: string | null;
}): PrayerLocation {
  return {
    source: "geolocation",
    permission: "granted",
    city: input.city?.trim() || "Position actuelle",
    country: input.country?.trim() || DEFAULT_COUNTRY,
    label: input.city?.trim() || "Position actuelle",
    latitude: input.latitude,
    longitude: input.longitude,
    timezone: resolveTimeZone(input.timezone ?? DEFAULT_TIMEZONE)
  };
}

export function readPrayerSettings(): PrayerSettings {
  const parsed = safeJsonParse<PrayerSettings>(readStorageValue(PRAYER_SETTINGS_STORAGE_KEY));

  if (!parsed) {
    return DEFAULT_PRAYER_SETTINGS;
  }

  return {
    calculationMethod: parsed.calculationMethod ?? DEFAULT_PRAYER_SETTINGS.calculationMethod,
    madhab: parsed.madhab ?? DEFAULT_PRAYER_SETTINGS.madhab,
    adjustments: {
      ...DEFAULT_PRAYER_SETTINGS.adjustments,
      ...parsed.adjustments
    }
  };
}

export function writePrayerSettings(settings: PrayerSettings) {
  writeStorageValue(PRAYER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function hasPromptedPrayerGeolocation(): boolean {
  return readStorageValue(PRAYER_GEOLOCATION_PROMPT_KEY) === "1";
}

export function markPrayerGeolocationPrompted() {
  writeStorageValue(PRAYER_GEOLOCATION_PROMPT_KEY, "1");
}

export function prayerTimingLabel(name: PrayerTimingName): string {
  return PRAYER_LABELS[name];
}

export function trackedPrayerLabel(name: PrayerTrackedName): string {
  return TRACKED_LABELS[name];
}

export function todayPrayerStatuses(logs: PrayerLogRow[]): Partial<Record<PrayerTrackedName, PrayerStatus>> {
  return logs.reduce<Partial<Record<PrayerTrackedName, PrayerStatus>>>((accumulator, log) => {
    accumulator[log.prayer_name] = log.status;
    return accumulator;
  }, {});
}

export function currentPrayerDate(timeZone?: string | null): string {
  return todayDate(resolveTimeZone(timeZone));
}
