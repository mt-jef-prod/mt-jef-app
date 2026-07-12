import type { NumericLike } from "./types";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_APP_TIMEZONE = "Europe/Paris";

function dateFormatterParts(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
}

function dateOnlyToLocalMidday(value: string): Date | null {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export function resolveTimeZone(timeZone?: string | null): string {
  return timeZone?.trim() || DEFAULT_APP_TIMEZONE;
}

export function todayDate(timeZone?: string | null): string {
  const parts = dateFormatterParts(new Date(), resolveTimeZone(timeZone));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function toNumber(value: NumericLike | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }

  return 0;
}

export function formatMoney(
  value: NumericLike | null | undefined,
  currency = "EUR"
): string {
  const amount = toNumber(value);

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = dateOnlyToLocalMidday(value) ?? new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function localDateTimeInputToIso(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function isoToLocalDateTimeInput(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function csvToArray(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function arrayToCsv(value: string[] | null | undefined): string {
  return value?.join(", ") ?? "";
}

export function calculateAge(birthDate: string | null | undefined): number | null {
  if (!birthDate || !DATE_ONLY_PATTERN.test(birthDate)) {
    return null;
  }

  const [year, month, day] = birthDate.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - year;
  const hasHadBirthdayThisYear =
    now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function messageFromError(error: unknown): string {
  if (error && typeof error === "object") {
    const message = "message" in error ? String(error.message) : null;
    const code = "code" in error ? String(error.code) : null;
    const status = "status" in error ? Number(error.status) : null;

    if (code === "23505") {
      return "Cette valeur existe deja ou viole une regle d'unicite.";
    }

    if (code === "23503") {
      return "Cette relation reference un element indisponible ou non autorise.";
    }

    if (message?.includes("row-level security policy")) {
      return "Action refusee par la politique de securite de la base.";
    }

    if (
      message?.includes("Could not find the table") ||
      (message?.includes("relation") && message.includes("does not exist")) ||
      message?.includes("schema cache")
    ) {
      return "La base Supabase n'est pas initialisee pour cette application. Appliquez les migrations du projet puis reessayez.";
    }

    if (message?.includes("violates check constraint")) {
      return `La base a refuse cette valeur car elle ne respecte pas une regle metier. Detail: ${message}`;
    }

    if (code === "email_address_invalid") {
      return "L'adresse e-mail est invalide. Verifie le format et supprime les espaces avant ou apres.";
    }

    if (
      code === "user_already_exists" ||
      message?.includes("User already registered") ||
      message?.includes("already been registered")
    ) {
      return "Un compte existe deja avec cette adresse e-mail.";
    }

    if (
      code === "weak_password" ||
      message?.includes("Password should be at least") ||
      message?.includes("Password should contain")
    ) {
      return "Le mot de passe est trop faible. Utilise au moins 8 caracteres avec une structure plus robuste.";
    }

    if (message?.includes("Email not confirmed")) {
      return "Cette adresse e-mail n'a pas encore ete confirmee. Verifie ta boite mail puis reessaie.";
    }

    if (message?.includes("Invalid login credentials")) {
      return "E-mail ou mot de passe incorrect.";
    }

    if (message?.includes("Signups not allowed for this instance")) {
      return "La creation de compte est desactivee sur ce projet Supabase.";
    }

    if (message?.includes("fetch failed") || status === 0) {
      return "Connexion reseau impossible vers Supabase. Verifie la connexion, l'URL du projet et les autorisations reseau.";
    }

    if (message) {
      return message;
    }
  }

  return "Une erreur inattendue s'est produite.";
}
