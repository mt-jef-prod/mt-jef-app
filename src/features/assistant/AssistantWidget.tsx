import React from "react";
import type { AssistantMessage } from "../../lib/types";
import { formatDateTime } from "../../lib/utils";
import { useAssistantChat } from "./useAssistantChat";

interface AssistantWidgetProps {
  timezone: string;
  firstName?: string | null;
}

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = draft.trim();

    if (!message || sending) {
      return;
    }

    setDraft("");
    await sendMessage(message);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      const form = event.currentTarget.form;
      form?.requestSubmit();
    }
  }

  const helperName = firstName?.trim() ? ` pour ${firstName.trim()}` : "";
  const remainingCharacters = 1_500 - draft.length;

  return (
    <>
      <button
        type="button"
        className="assistant-fab"
        aria-expanded={open}
        aria-controls="assistant-panel"
        onClick={() => setOpen((current) => !current)}
      >
        Assistant IA
      </button>

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
          </div>
          <div className="assistant-panel__actions">
            <button
              type="button"
              className="secondary-button"
              onClick={resetConversation}
              disabled={sending}
            >
              Nouvelle conversation
            </button>
            <button type="button" className="ghost-button" onClick={() => setOpen(false)}>
              Fermer
            </button>
          </div>
        </div>

        <div className="assistant-panel__body">
          {messages.length === 0 ? (
            <section className="assistant-empty">
              <p className="assistant-empty__title">Lecture seule, connectée à vos données Supabase</p>
              <p>
                Posez une question sur vos projets, tâches, budgets, dépenses ou objectifs. L’assistant
                n’écrit rien en base dans cette première version.
              </p>
            </section>
          ) : null}

          {messages.map((message) => (
            <AssistantBubble key={message.id} message={message} />
          ))}

          {sending ? (
            <div className="assistant-message assistant-message--assistant assistant-message--loading">
              <p>L’assistant prépare une réponse…</p>
            </div>
          ) : null}

          {error ? (
            <p className="assistant-status assistant-status--error" role="alert">
              {error}
            </p>
          ) : null}

          {emptyResponse ? (
            <p className="assistant-status assistant-status--info">
              Réponse vide reçue. Reformulez la question ou relancez une nouvelle conversation.
            </p>
          ) : null}

          <div ref={endRef} />
        </div>

        <form className="assistant-panel__composer" onSubmit={handleSubmit}>
          <label>
            <span>Votre question</span>
            <textarea
              ref={inputRef}
              rows={4}
              maxLength={1_500}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Exemple : quels projets demandent une action prioritaire cette semaine ?"
            />
          </label>
          <div className="assistant-panel__composer-footer">
            <small>{remainingCharacters} caractères restants</small>
            <button type="submit" className="primary-button" disabled={sending || draft.trim() === ""}>
              Envoyer
            </button>
          </div>
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
            <span key={`${message.id}-${source}`}>{source}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
