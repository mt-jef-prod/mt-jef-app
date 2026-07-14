import { useState } from "react";
import { supabase } from "../../lib/supabase";
import type {
  AssistantFunctionResponse,
  AssistantHistoryItem,
  AssistantMessage,
  CoachHistoryEntry,
  CoachInsightReport
} from "../../lib/types";
import { resolveAssistantErrorMessage } from "../assistant/assistantErrors";
import {
  buildCoachAssistantMessage,
  buildCoachHistoryEntry,
  buildCoachRequestPayload
} from "./coachEngine";

const MAX_MESSAGE_LENGTH = 900;
const MAX_HISTORY_ITEMS = 6;
const COACH_HISTORY_STORAGE_KEY = "mt-jef-coach-history-v1";

function buildHistory(messages: AssistantMessage[]): AssistantHistoryItem[] {
  return messages.slice(-MAX_HISTORY_ITEMS).map(({ role, content }) => ({
    role,
    content
  }));
}

function readStoredHistory() {
  if (typeof window === "undefined") {
    return [] as CoachHistoryEntry[];
  }

  try {
    const raw = window.localStorage.getItem(COACH_HISTORY_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as CoachHistoryEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch {
    return [];
  }
}

function writeStoredHistory(entries: CoachHistoryEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(COACH_HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, 10)));
  } catch {
    // ignore local storage failures
  }
}

export function useCoachConversation(args: {
  timezone: string;
  firstName?: string | null;
}) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyResponse, setEmptyResponse] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<CoachHistoryEntry[]>(() => readStoredHistory());
  const [latestRecommendation, setLatestRecommendation] = useState<CoachHistoryEntry | null>(
    () => readStoredHistory()[0] ?? null
  );

  function startConversation(report: CoachInsightReport) {
    if (messages.length > 0) {
      return;
    }

    const initialQuestion =
      report.primary_signal?.question ??
      "Qu'est-ce qui t'a le plus freiné aujourd'hui, si tu devais choisir une seule chose ?";

    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: initialQuestion,
        createdAt: new Date().toISOString()
      }
    ]);
  }

  async function sendReply(rawMessage: string, report: CoachInsightReport) {
    const content = rawMessage.trim();

    if (!content || sending) {
      return;
    }

    if (!supabase) {
      setError("Configuration Supabase indisponible.");
      return;
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      setError(`La réponse ne doit pas dépasser ${MAX_MESSAGE_LENGTH} caractères.`);
      return;
    }

    setSending(true);
    setError(null);
    setEmptyResponse(false);

    const userMessage: AssistantMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString()
    };
    const history = buildHistory(messages);

    setMessages((current) => [...current, userMessage]);

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session utilisateur indisponible. Reconnectez-vous puis réessayez.");
      }

      const payload = buildCoachRequestPayload({
        message: content,
        timezone: args.timezone,
        firstName: args.firstName,
        history,
        report
      });

      const { data, error: invokeError } =
        await supabase.functions.invoke<AssistantFunctionResponse>("mt-jef-assistant", {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: payload
        });

      if (invokeError) {
        throw invokeError;
      }

      const coachPayload = data?.coach;

      if (!coachPayload) {
        setEmptyResponse(true);
        return;
      }

      const recommendation = buildCoachHistoryEntry({
        recommendation: coachPayload,
        report,
        userResponse: content
      });

      setLatestRecommendation(recommendation);
      setHistoryEntries((current) => {
        const nextEntries = [recommendation, ...current].slice(0, 10);
        writeStoredHistory(nextEntries);
        return nextEntries;
      });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: buildCoachAssistantMessage(coachPayload),
          createdAt: new Date().toISOString(),
          sources: data.sources
        }
      ]);
    } catch (coachError) {
      setError(await resolveAssistantErrorMessage(coachError));
    } finally {
      setSending(false);
    }
  }

  function resetConversation(report?: CoachInsightReport | null) {
    if (sending) {
      return;
    }

    setMessages([]);
    setError(null);
    setEmptyResponse(false);

    if (report) {
      const initialQuestion =
        report.primary_signal?.question ??
        "Qu'est-ce qui t'a le plus freiné aujourd'hui, si tu devais choisir une seule chose ?";
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: initialQuestion,
          createdAt: new Date().toISOString()
        }
      ]);
    }
  }

  return {
    messages,
    sending,
    error,
    emptyResponse,
    historyEntries,
    latestRecommendation,
    hasHistory: historyEntries.length > 0,
    sendReply,
    startConversation,
    resetConversation
  };
}
