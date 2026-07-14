import type { SectionDefinition } from "../lib/types";

export type PreviewScene =
  | "auth"
  | "dashboard"
  | "assistant"
  | "projects"
  | "tasks"
  | "finances"
  | "family"
  | "spiritual"
  | "review"
  | "dark";

export type PreviewFrameScene = Exclude<PreviewScene, "dark">;

export type PreviewVariant = "default" | "empty" | "loading" | "dense" | "error" | "success";

export type PreviewDevice = "split" | "mobile" | "desktop";

export interface PreviewOption<T extends string> {
  value: T;
  label: string;
}

export interface PreviewProject {
  title: string;
  intention: string;
  nextAction: string;
  due: string;
  budget: string;
  status: "idea" | "preparation" | "active" | "paused" | "blocked";
  progress: number;
}

export interface PreviewTask {
  title: string;
  project: string;
  due: string;
  slot: string;
  status: "todo" | "in_progress" | "blocked" | "completed" | "postponed";
  score: string;
  note: string;
}

export interface PreviewFinanceMetric {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "accent" | "alert" | "success";
}

export interface PreviewFinanceTransaction {
  title: string;
  category: string;
  amount: string;
  currency: string;
  status: "planned" | "committed" | "paid" | "received" | "cancelled";
  note: string;
}

export interface PreviewBudget {
  category: string;
  planned: string;
  remaining: string;
  progress: number;
  tone?: "default" | "accent" | "success";
}

export interface PreviewFamilyMember {
  name: string;
  relation: string;
  birthday: string;
  nextContact: string;
  note: string;
  interests: string[];
}

export interface PreviewPrayer {
  name: string;
  status: "completed" | "late" | "missed" | "not_recorded";
  window: string;
  note: string;
}

export interface PreviewReviewLine {
  label: string;
  value: string;
  tone?: "default" | "accent" | "success" | "warning" | "danger";
  note?: string;
}

export interface PreviewAssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAtLabel: string;
  sources?: string[];
}

export const PREVIEW_SCENE_OPTIONS: PreviewOption<PreviewScene>[] = [
  { value: "auth", label: "Authentification" },
  { value: "dashboard", label: "Aujourd'hui" },
  { value: "assistant", label: "Assistant IA" },
  { value: "projects", label: "Projets" },
  { value: "tasks", label: "Tâches" },
  { value: "finances", label: "Finances" },
  { value: "family", label: "Famille" },
  { value: "spiritual", label: "Prières" },
  { value: "review", label: "Revue quotidienne" },
  { value: "dark", label: "Mode sombre" }
];

export const PREVIEW_VARIANT_OPTIONS: PreviewOption<PreviewVariant>[] = [
  { value: "default", label: "Chargé" },
  { value: "empty", label: "Écran vide" },
  { value: "loading", label: "Chargement" },
  { value: "dense", label: "Beaucoup de données" },
  { value: "error", label: "Erreur" },
  { value: "success", label: "Succès" }
];

export const PREVIEW_DEVICE_OPTIONS: PreviewOption<PreviewDevice>[] = [
  { value: "split", label: "Mobile + desktop" },
  { value: "mobile", label: "iPhone" },
  { value: "desktop", label: "Desktop" }
];

export const PREVIEW_SECTIONS: SectionDefinition[] = [
  { id: "dashboard", label: "Aujourd'hui", kicker: "Vue centrale" },
  { id: "intention", label: "Intention", kicker: "Niyya" },
  { id: "family", label: "Famille", kicker: "Lien & rappels" },
  { id: "projects", label: "Projets", kicker: "Cap & étapes" },
  { id: "tasks", label: "Tâches", kicker: "Action immédiate" },
  { id: "finances", label: "Finances", kicker: "Flux & budgets" },
  { id: "spiritual", label: "Prières", kicker: "Ancrage" },
  { id: "review", label: "Revue", kicker: "Tekki" }
];

export const PREVIEW_PROFILE = {
  id: "preview-user",
  first_name: "Moctar",
  last_name: "Touré",
  birth_date: "1987-04-18",
  city: "Paris",
  country: "France",
  timezone: "Europe/Paris",
  preferred_currency: "EUR",
  created_at: "2026-07-01T09:15:00.000Z",
  updated_at: "2026-07-14T10:42:00.000Z"
};

export const PREVIEW_TODAY_INTENTION =
  "Préserver une journée simple, claire et utile avant d'ajouter quoi que ce soit.";

export const PREVIEW_PROJECTS: PreviewProject[] = [
  {
    title: "Maison Sénégal retraite",
    intention: "Sécuriser le projet sans précipitation ni angle mort.",
    nextAction: "Valider le devis gros œuvre et les frais de transfert.",
    due: "12 août 2026",
    budget: "36 000 €",
    status: "active",
    progress: 62
  },
  {
    title: "Educoncret",
    intention: "Clarifier l'offre avant d'ouvrir la prochaine phase.",
    nextAction: "Réécrire la proposition commerciale en une page nette.",
    due: "28 juillet 2026",
    budget: "1 200 €",
    status: "preparation",
    progress: 34
  },
  {
    title: "VAE",
    intention: "Transformer l'effort administratif en avancée tangible.",
    nextAction: "Préparer le dossier initial et cadrer les pièces justificatives.",
    due: "5 septembre 2026",
    budget: "0 €",
    status: "idea",
    progress: 18
  },
  {
    title: "Logix Forma",
    intention: "Stabiliser le positionnement avant la relance.",
    nextAction: "Rouvrir les échanges partenaires avec un argumentaire plus court.",
    due: "18 septembre 2026",
    budget: "6 400 €",
    status: "paused",
    progress: 48
  },
  {
    title: "Langues",
    intention: "Réinstaller une pratique régulière et légère.",
    nextAction: "Bloquer deux créneaux hebdomadaires de 25 minutes.",
    due: "30 juillet 2026",
    budget: "0 €",
    status: "active",
    progress: 24
  }
];

export const PREVIEW_TASKS: PreviewTask[] = [
  {
    title: "Relancer le maçon au Sénégal",
    project: "Maison Sénégal retraite",
    due: "Aujourd'hui",
    slot: "11:30",
    status: "in_progress",
    score: "19.50",
    note: "Appel court, avec devis et coût du transport sous les yeux."
  },
  {
    title: "Contrôler le flux d'inscription Supabase",
    project: "M.T JËF",
    due: "Aujourd'hui",
    slot: "14:00",
    status: "blocked",
    score: "18.00",
    note: "Le diagnostic réseau doit être compris avant toute retouche."
  },
  {
    title: "Préparer le budget transport août",
    project: "Finances",
    due: "Demain",
    slot: "08:30",
    status: "todo",
    score: "16.50",
    note: "Séparer les trajets France et Sénégal pour garder une lecture simple."
  },
  {
    title: "Corriger les étapes du projet VAE",
    project: "VAE",
    due: "Vendredi",
    slot: "09:15",
    status: "postponed",
    score: "15.00",
    note: "Revenir avec une liste d'étapes plus concrète."
  },
  {
    title: "Envoyer le bilan de la journée",
    project: "Revue",
    due: "Ce soir",
    slot: "20:45",
    status: "completed",
    score: "13.50",
    note: "Le texte doit rester court, lucide et actionnable."
  },
  {
    title: "Réserver deux créneaux langues",
    project: "Langues",
    due: "Samedi",
    slot: "17:00",
    status: "todo",
    score: "12.50",
    note: "Mieux vaut deux sessions courtes qu'une longue session ratée."
  }
];

export const PREVIEW_FINANCE_METRICS: PreviewFinanceMetric[] = [
  {
    label: "Solde réel disponible",
    value: "4 820,00 €",
    hint: "Après dépenses obligatoires et réservées",
    tone: "accent"
  },
  {
    label: "Solde réel Sénégal",
    value: "315 000 XOF",
    hint: "Compte secondaire dédié aux transferts",
    tone: "success"
  },
  {
    label: "Dépenses protégées",
    value: "1 240,00 €",
    hint: "Loyer, transport, école",
    tone: "alert"
  }
];

export const PREVIEW_TRANSACTIONS: PreviewFinanceTransaction[] = [
  {
    title: "Loyer juillet",
    category: "Logement",
    amount: "890,00",
    currency: "EUR",
    status: "committed",
    note: "Sortie prévue, encore non débitée."
  },
  {
    title: "Salaire",
    category: "Revenus professionnels",
    amount: "3 150,00",
    currency: "EUR",
    status: "received",
    note: "Revenu confirmé, utilisé comme base du mois."
  },
  {
    title: "Soutien famille",
    category: "Sénégal",
    amount: "120 000",
    currency: "XOF",
    status: "planned",
    note: "Prévu avant le week-end."
  },
  {
    title: "Mutuelle santé",
    category: "Santé",
    amount: "84,00",
    currency: "EUR",
    status: "paid",
    note: "Déjà encaissé, ne doit plus impacter le solde réel."
  }
];

export const PREVIEW_BUDGETS: PreviewBudget[] = [
  {
    category: "Logement",
    planned: "1 100,00 €",
    remaining: "210,00 €",
    progress: 81,
    tone: "accent"
  },
  {
    category: "Transport",
    planned: "220,00 €",
    remaining: "95,00 €",
    progress: 57,
    tone: "success"
  },
  {
    category: "Projets",
    planned: "450,00 €",
    remaining: "110,00 €",
    progress: 76,
    tone: "default"
  }
];

export const PREVIEW_FAMILY: PreviewFamilyMember[] = [
  {
    name: "Coryan",
    relation: "Enfant",
    birthday: "28 août 1998",
    nextContact: "Appel jeudi 18:30",
    note: "Faire le point sur son organisation de semaine.",
    interests: ["Musique", "Projets", "Famille"]
  },
  {
    name: "Meissa",
    relation: "Enfant",
    birthday: "26 janvier 2010",
    nextContact: "Message demain 17:00",
    note: "Penser à demander les nouvelles du stage.",
    interests: ["Football", "École", "Tech"]
  },
  {
    name: "Yommala-Aïssata",
    relation: "Enfant",
    birthday: "30 avril 2016",
    nextContact: "Visio samedi",
    note: "Prévoir un moment léger et court.",
    interests: ["Lecture", "Danse", "Jeux"]
  },
  {
    name: "Chayan",
    relation: "Enfant",
    birthday: "19 septembre 2018",
    nextContact: "Message vocal ce soir",
    note: "Laisser de la place à la spontanéité.",
    interests: ["Dessins", "Histoires", "Animaux"]
  }
];

export const PREVIEW_PRAYERS: PreviewPrayer[] = [
  { name: "Fajr", status: "completed", window: "05:18", note: "Accomplie à l'heure." },
  { name: "Dhuhr", status: "late", window: "13:42", note: "Rattrapée après une séquence de travail." },
  { name: "Asr", status: "not_recorded", window: "17:19", note: "Pas encore renseignée." },
  { name: "Maghrib", status: "not_recorded", window: "21:35", note: "Prévoir un rappel discret." },
  { name: "Isha", status: "not_recorded", window: "23:02", note: "Clôture du jour." }
];

export const PREVIEW_REVIEW_LINES: PreviewReviewLine[] = [
  {
    label: "Prière",
    value: "Ancrage tenu sur la première moitié de journée",
    tone: "success",
    note: "Rester attentif au creux de fin d'après-midi."
  },
  {
    label: "Priorité",
    value: "Deux actions importantes réellement avancées",
    tone: "accent",
    note: "Éviter d'ouvrir une nouvelle piste après 18h."
  },
  {
    label: "Famille",
    value: "Présence courte mais sincère",
    tone: "success",
    note: "Programmer un créneau plus calme demain."
  },
  {
    label: "Argent",
    value: "Flux compris, arbitrage encore à poser",
    tone: "warning",
    note: "Confirmer les dépenses réservées avant validation."
  },
  {
    label: "Énergie",
    value: "3/5",
    tone: "default",
    note: "La reprise après déjeuner reste le point faible."
  }
];

export const PREVIEW_ASSISTANT_MESSAGES: PreviewAssistantMessage[] = [
  {
    id: "assistant-user-1",
    role: "user",
    content: "Que dois-je prioriser aujourd'hui ?",
    createdAtLabel: "11:08"
  },
  {
    id: "assistant-bot-1",
    role: "assistant",
    content:
      "Commence par le projet Maison Sénégal retraite, puis vérifie le flux d'inscription Supabase. Ce sont les deux sujets avec le meilleur ratio impact / clarté.",
    createdAtLabel: "11:09",
    sources: ["projects", "tasks", "finances"]
  },
  {
    id: "assistant-user-2",
    role: "user",
    content: "Et côté budget ?",
    createdAtLabel: "11:10"
  },
  {
    id: "assistant-bot-2",
    role: "assistant",
    content:
      "Le logement est déjà consommé à 81 %. Le transport reste maîtrisé. Le prochain arbitrage utile concerne l'enveloppe Projets avant d'engager une nouvelle dépense.",
    createdAtLabel: "11:10",
    sources: ["vue_budget_status", "vue_solde_reel_disponible"]
  }
];

export function projectTone(status: PreviewProject["status"]) {
  switch (status) {
    case "active":
      return "accent";
    case "blocked":
      return "warning";
    case "paused":
      return "default";
    default:
      return "default";
  }
}

export function taskTone(status: PreviewTask["status"]) {
  switch (status) {
    case "in_progress":
      return "accent";
    case "completed":
      return "success";
    case "blocked":
      return "warning";
    default:
      return "default";
  }
}

export function prayerTone(status: PreviewPrayer["status"]) {
  switch (status) {
    case "completed":
      return "success";
    case "late":
      return "warning";
    case "missed":
      return "danger";
    default:
      return "default";
  }
}
