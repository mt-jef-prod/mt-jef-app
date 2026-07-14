import { useState } from "react";
import { supabase } from "../../lib/supabase";
import type {
  AssistantFunctionResponse,
  AssistantHistoryItem,
  AssistantMessage
} from "../../lib/types";
import { resolveAssistantErrorMessage } from "./assistantErrors";

const MAX_MESSAGE_LENGTH = 1_500;
const MAX_HISTORY_ITEMS = 8;

interface UseAssistantChatOptions {
  timezone: string;
  firstName?: string | null;
}

function buildHistory(messages: AssistantMessage[]): AssistantHistoryItem[] {
  return messages.slice(-MAX_HISTORY_ITEMS).map(({ role, content }) => ({
    role,
    content
  }));
}

export function useAssistantChat({ timezone, firstName }: UseAssistantChatOptions) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyResponse, setEmptyResponse] = useState(false);

  async function sendMessage(rawMessage: string) {
    const content = rawMessage.trim();

    if (!content || sending) {
      return;
    }

    if (!supabase) {
      setError("Configuration Supabase indisponible.");
      return;
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      setError(`Le message ne doit pas dépasser ${MAX_MESSAGE_LENGTH} caractères.`);
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

      const { data, error: invokeError } =
        await supabase.functions.invoke<AssistantFunctionResponse>("mt-jef-assistant", {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            message: content,
            history,
            timezone,
            firstName: firstName?.trim() || null
          }
        });

      if (invokeError) {
        throw invokeError;
      }

      const reply = data?.reply?.trim() ?? "";

      if (!reply) {
        setEmptyResponse(true);
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: reply,
          createdAt: new Date().toISOString(),
          sources: data?.sources ?? []
        }
      ]);
    } catch (assistantError) {
      setError(await resolveAssistantErrorMessage(assistantError));
    } finally {
      setSending(false);
    }
  }

  function resetConversation() {
    if (sending) {
      return;
    }

    setMessages([]);
    setError(null);
    setEmptyResponse(false);
  }

  return {
    messages,
    sending,
    error,
    emptyResponse,
    sendMessage,
    resetConversation
  };
}
