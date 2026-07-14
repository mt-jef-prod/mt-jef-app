import React from "react";
import type { AssistantMessage } from "../../lib/types";
import { formatDateTime } from "../../lib/utils";
import {
  ChatComposer,
  FloatingAssistantButton,
  GhostButton,
  SecondaryButton,
  StatusBadge
} from "../../components/ui";
import { useAssistantChat } from "./useAssistantChat";

interface AssistantWidgetProps {
  timezone: string;
  firstName?: string | null;
}

const QUICK_SUGGESTIONS = [
  "Que dois-je prioriser aujourd'hui ?",
  "Fais le bilan de ma journée.",
  "Analyse mon budget.",
  "Aide-moi à avancer sur un projet.",
  "Quelle est mon intention du jour ?"
];

export function AssistantWidget({ timezone, firstName }: AssistantWidgetProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const endRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const { messages, sending, error, emptyResponse, sendMessage, resetConversation } =
    useAssistantChat({
      timezone,
      firstName
    });

  React.useEffect(() => {
    if (!open) {
      return;
    }

    inputRef.current?.focus();
  }, [open]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, open, error, emptyResponse]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function submitDraft() {
    const message = draft.trim();

    if (!message || sending) {
      return;
    }

    setDraft("");
    await sendMessage(message);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitDraft();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void submitDraft();
    }
  }

  async function useSuggestion(value: string) {
    setDraft("");
    await sendMessage(value);
  }

  const helperName = firstName?.trim() ? ` pour ${firstName.trim()}` : "";

  return (
    <>
      <FloatingAssistantButton open={open} onClick={() => setOpen((current) => !current)} />

      {open ? (
        <button
          type="button"
          className="assistant-overlay"
          aria-label="Fermer l’assistant"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        id="assistant-panel"
        className={`assistant-panel${open ? " is-open" : ""}`}
        role="dialog"
        aria-label="Assistant IA"
        aria-modal="false"
      >
        <div className="assistant-panel__header">
          <div>
            <p className="profile-card__eyebrow">Copilote personnel</p>
            <h2>Assistant IA{helperName}</h2>
            <p className="assistant-panel__intro">
              Lecture seule, connectée à tes données Supabase et assistée par Gemini via une Edge
              Function sécurisée.
            </p>
            <div className="assistant-chip-row">
              <StatusBadge tone="accent">Gemini</StatusBadge>
              <StatusBadge>Lecture seule</StatusBadge>
            </div>
          </div>
          <div className="assistant-panel__actions">
            <SecondaryButton onClick={resetConversation} disabled={sending}>
              Nouvelle conversation
            </SecondaryButton>
            <GhostButton onClick={() => setOpen(false)}>Fermer</GhostButton>
          </div>
        </div>

        <div className="assistant-panel__body">
          {messages.length === 0 ? (
            <section className="assistant-empty">
              <div>
                <p className="assistant-empty__title">Un copilote de lecture, pas d'écriture.</p>
                <p>
                  Demande une synthèse, une priorisation ou une lecture de budget. Si les données
                  utiles ne sont pas disponibles, Gemini le dira clairement sans inventer.
                </p>
              </div>
              <div className="assistant-suggestion-grid">
                {QUICK_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="assistant-suggestion"
                    onClick={() => void useSuggestion(suggestion)}
                    disabled={sending}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {messages.map((message) => (
            <AssistantBubble key={message.id} message={message} />
          ))}

          {sending ? (
            <div className="assistant-message assistant-message--assistant assistant-message--loading">
              <p>L'assistant prépare une réponse utile…</p>
            </div>
          ) : null}

          {error ? (
            <p className="assistant-status assistant-status--error" role="alert">
              {error}
            </p>
          ) : null}

          {emptyResponse ? (
            <p className="assistant-status assistant-status--info">
              La réponse reçue est vide. Reformule la question ou relance une conversation.
            </p>
          ) : null}

          <div ref={endRef} />
        </div>

        <form className="assistant-panel__composer" onSubmit={handleSubmit}>
          <ChatComposer
            value={draft}
            maxLength={1_500}
            sending={sending}
            onChange={setDraft}
            onSubmit={() => void submitDraft()}
            onKeyDown={handleKeyDown}
            textareaRef={inputRef}
            placeholder="Exemple : quels projets demandent une action prioritaire cette semaine ?"
          />
        </form>
      </aside>
    </>
  );
}

interface AssistantBubbleProps {
  message: AssistantMessage;
}

function AssistantBubble({ message }: AssistantBubbleProps) {
  const label = message.role === "assistant" ? "Assistant" : "Vous";

  return (
    <article className={`assistant-message assistant-message--${message.role}`}>
      <div className="assistant-message__meta">
        <strong>{label}</strong>
        <small>{formatDateTime(message.createdAt)}</small>
      </div>
      <p>{message.content}</p>
      {message.role === "assistant" && message.sources?.length ? (
        <div className="assistant-chip-row" aria-label="Sources utilisées">
          {message.sources.map((source) => (
            <StatusBadge key={`${message.id}-${source}`} tone="accent">
              {source}
            </StatusBadge>
          ))}
        </div>
      ) : null}
    </article>
  );
}
