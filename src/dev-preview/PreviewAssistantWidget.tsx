import React from "react";
import {
  ChatComposer,
  FloatingAssistantButton,
  GhostButton,
  SecondaryButton,
  StatusBadge
} from "../components/ui";
import type { PreviewAssistantMessage, PreviewVariant } from "./previewFixtures";
import { PREVIEW_ASSISTANT_MESSAGES } from "./previewFixtures";

const QUICK_SUGGESTIONS = [
  "Que dois-je prioriser aujourd'hui ?",
  "Fais le bilan de ma journée.",
  "Analyse mon budget.",
  "Aide-moi à avancer sur un projet.",
  "Quelle est mon intention du jour ?"
];

interface PreviewAssistantWidgetProps {
  firstName?: string | null;
  variant: PreviewVariant;
  defaultOpen?: boolean;
}

function messagesForVariant(variant: PreviewVariant): PreviewAssistantMessage[] {
  if (variant === "empty") {
    return [];
  }

  if (variant === "dense") {
    return [
      ...PREVIEW_ASSISTANT_MESSAGES,
      {
        id: "assistant-user-3",
        role: "user",
        content: "Que faire ce soir pour garder de l'élan ?",
        createdAtLabel: "11:12"
      },
      {
        id: "assistant-bot-3",
        role: "assistant",
        content:
          "Clôture la journée par une revue courte, puis bloque un créneau précis pour le suivi budget et un autre pour le projet VAE.",
        createdAtLabel: "11:13",
        sources: ["daily_reviews", "tasks"]
      }
    ];
  }

  return PREVIEW_ASSISTANT_MESSAGES;
}

export function PreviewAssistantWidget({
  firstName,
  variant,
  defaultOpen = false
}: PreviewAssistantWidgetProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [draft, setDraft] = React.useState("");
  const helperName = firstName?.trim() ? ` pour ${firstName.trim()}` : "";
  const messages = React.useMemo(() => messagesForVariant(variant), [variant]);
  const sending = variant === "loading";
  const error =
    variant === "error"
      ? "Le copilote de preview simule une erreur lisible, sans exposer de détail technique."
      : null;
  const emptyResponse = variant === "success" ? false : false;

  React.useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  async function handleFakeSubmit() {
    setDraft("");
  }

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
              Simulation de lecture seule, réservée au développement. Aucun appel réel à l'Edge
              Function ni à Gemini n'est déclenché ici.
            </p>
          </div>
          <div className="assistant-panel__actions">
            <SecondaryButton onClick={() => setDraft("")} disabled={sending}>
              Nouvelle conversation
            </SecondaryButton>
            <GhostButton onClick={() => setOpen(false)}>Fermer</GhostButton>
          </div>
        </div>

        <div className="assistant-panel__body">
          {messages.length === 0 ? (
            <section className="assistant-empty">
              <div>
                <p className="assistant-empty__title">Assistant en lecture seule.</p>
                <p>
                  Utilise cette vue pour vérifier les espacements, les bulles, les suggestions,
                  les états vides et la qualité du panneau mobile.
                </p>
              </div>
              <div className="assistant-suggestion-grid">
                {QUICK_SUGGESTIONS.map((suggestion) => (
                  <button key={suggestion} type="button" className="assistant-suggestion">
                    {suggestion}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {messages.map((message) => (
            <article key={message.id} className={`assistant-message assistant-message--${message.role}`}>
              <div className="assistant-message__meta">
                <strong>{message.role === "assistant" ? "Assistant" : "Vous"}</strong>
                <small>{message.createdAtLabel}</small>
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
        </div>

        <form
          className="assistant-panel__composer"
          onSubmit={(event) => {
            event.preventDefault();
            void handleFakeSubmit();
          }}
        >
          <ChatComposer
            value={draft}
            maxLength={1_500}
            sending={sending}
            onChange={setDraft}
            onSubmit={() => void handleFakeSubmit()}
            placeholder="Prévisualisation locale : aucun envoi réel n'est effectué."
          />
        </form>
      </aside>
    </>
  );
}
