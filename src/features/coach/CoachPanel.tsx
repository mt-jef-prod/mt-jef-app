import React from "react";
import {
  ActionCard,
  BottomSheet,
  ChatComposer,
  EmptyState,
  GhostButton,
  MetricCard,
  SecondaryButton,
  SegmentedControl,
  StatusBadge
} from "../../components/ui";
import type { AssistantMessage, CoachHistoryEntry, CoachInsightReport } from "../../lib/types";
import { formatDateTime } from "../../lib/utils";

type CoachPanelTab = "coach" | "week" | "history";

interface CoachPanelProps {
  open: boolean;
  loading: boolean;
  report: CoachInsightReport | null;
  latestRecommendation: CoachHistoryEntry | null;
  historyEntries: CoachHistoryEntry[];
  messages: AssistantMessage[];
  sending: boolean;
  error: string | null;
  emptyResponse: boolean;
  onClose: () => void;
  onStartConversation: (report: CoachInsightReport) => void;
  onResetConversation: (report?: CoachInsightReport | null) => void;
  onSendReply: (message: string, report: CoachInsightReport) => Promise<void>;
}

const TAB_OPTIONS: Array<{ label: string; value: CoachPanelTab }> = [
  { label: "Coach", value: "coach" },
  { label: "Semaine", value: "week" },
  { label: "Historique", value: "history" }
];

export function CoachPanel({
  open,
  loading,
  report,
  latestRecommendation,
  historyEntries,
  messages,
  sending,
  error,
  emptyResponse,
  onClose,
  onStartConversation,
  onResetConversation,
  onSendReply
}: CoachPanelProps) {
  const [draft, setDraft] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<CoachPanelTab>("coach");
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const endRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open || !report) {
      return;
    }

    onStartConversation(report);
  }, [open, report, onStartConversation]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    inputRef.current?.focus();
  }, [open, activeTab]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, activeTab]);

  async function submitDraft() {
    if (!report) {
      return;
    }

    const message = draft.trim();

    if (!message || sending) {
      return;
    }

    setDraft("");
    await onSendReply(message, report);
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Coach comportemental"
      description="Une seule question claire à la fois, puis une stratégie concrète et mesurable."
      actions={
        <div className="button-row">
          <SecondaryButton onClick={() => onResetConversation(report)} disabled={sending}>
            Repartir de zéro
          </SecondaryButton>
          <GhostButton onClick={onClose}>Fermer</GhostButton>
        </div>
      }
    >
      <SegmentedControl
        value={activeTab}
        options={TAB_OPTIONS}
        onChange={setActiveTab}
        ariaLabel="Navigation du coach"
      />

      {loading || !report ? (
        <ActionCard
          title="Le coach prépare le point du jour"
          description="Analyse en cours des tâches, projets, finances, prières et revue."
          meta={<StatusBadge tone="accent">Analyse</StatusBadge>}
        />
      ) : null}

      {!loading && report && activeTab === "coach" ? (
        <div className="coach-panel__stack">
          <ActionCard
            title={report.primary_signal?.title ?? "Question du coach"}
            description={report.primary_signal?.evidence ?? "Le coach reste prudent faute de contexte suffisant."}
            meta={<StatusBadge tone="accent">Question du jour</StatusBadge>}
          >
            <p className="coach-card__question">{report.primary_signal?.question}</p>
          </ActionCard>

          {latestRecommendation ? (
            <div className="coach-panel__summary-grid">
              <ActionCard
                title="Pourquoi ça n'a pas avancé"
                description={latestRecommendation.summary}
                meta={<StatusBadge tone="warning">Blocage probable</StatusBadge>}
              >
                <p className="muted-copy">{latestRecommendation.likely_blocker}</p>
              </ActionCard>
              <ActionCard
                title="Ce que je fais maintenant"
                description={latestRecommendation.next_action.title}
                meta={<StatusBadge tone="success">Plan immédiat</StatusBadge>}
              >
                <div className="coach-plan">
                  <span>{latestRecommendation.strategy}</span>
                  <strong>
                    {latestRecommendation.next_action.duration_minutes} min ·{" "}
                    {latestRecommendation.next_action.suggested_time}
                  </strong>
                  <span>
                    difficulté {latestRecommendation.next_action.difficulty}
                    {latestRecommendation.next_action.best_moment
                      ? ` · meilleur moment ${latestRecommendation.next_action.best_moment}`
                      : ""}
                  </span>
                  {latestRecommendation.next_action.reminder_hint ? (
                    <span>Rappel suggéré : {latestRecommendation.next_action.reminder_hint}</span>
                  ) : null}
                </div>
              </ActionCard>
            </div>
          ) : null}

          <section className="assistant-panel__body coach-panel__messages">
            {messages.map((message) => (
              <article key={message.id} className={`assistant-message assistant-message--${message.role}`}>
                <div className="assistant-message__meta">
                  <strong>{message.role === "assistant" ? "Coach" : "Vous"}</strong>
                  <small>{formatDateTime(message.createdAt)}</small>
                </div>
                <p>{message.content}</p>
              </article>
            ))}

            {sending ? (
              <div className="assistant-message assistant-message--assistant assistant-message--loading">
                <p>Le coach reformule le blocage et prépare une prochaine action utile…</p>
              </div>
            ) : null}

            {error ? (
              <p className="assistant-status assistant-status--error" role="alert">
                {error}
              </p>
            ) : null}

            {emptyResponse ? (
              <p className="assistant-status assistant-status--info">
                La réponse structurée du coach est vide. Reformule l'obstacle du jour.
              </p>
            ) : null}

            <div ref={endRef} />
          </section>

          <div className="assistant-panel__composer">
            <ChatComposer
              value={draft}
              maxLength={900}
              sending={sending}
              onChange={setDraft}
              onSubmit={() => void submitDraft()}
              textareaRef={inputRef}
              placeholder="Exemple : j'avais trop peu d'énergie et la tâche était trop grosse pour l'heure prévue."
            />
          </div>
        </div>
      ) : null}

      {!loading && report && activeTab === "week" ? (
        <div className="coach-panel__stack">
          <div className="coach-weekly-grid">
            <MetricCard
              label="Régularité"
              value={`${report.weekly_snapshot.consistency_score} %`}
              hint="Basé sur les tâches terminées, la revue et le suivi des prières."
              tone="accent"
            />
            <MetricCard
              label="Priorités"
              value={String(report.weekly_snapshot.recommended_priorities.length)}
              hint="Jamais plus de trois pour la semaine suivante."
              tone="success"
            />
            <MetricCard
              label="Obstacles"
              value={String(report.weekly_snapshot.main_obstacles.length)}
              hint="Signaux récurrents à traiter en premier."
              tone="alert"
            />
          </div>

          <div className="coach-panel__summary-grid">
            <ActionCard
              title="Objectifs avancés"
              description="Ce qui a réellement bougé cette semaine."
              meta={<StatusBadge tone="success">Avancées</StatusBadge>}
            >
              {report.weekly_snapshot.advanced_objectives.length === 0 ? (
                <p className="muted-copy">Aucune avancée claire détectée sur la période récente.</p>
              ) : (
                <div className="list-stack">
                  {report.weekly_snapshot.advanced_objectives.map((item) => (
                    <p className="coach-list-item" key={item}>
                      {item}
                    </p>
                  ))}
                </div>
              )}
            </ActionCard>

            <ActionCard
              title="Objectifs bloqués"
              description="Là où le système mérite une simplification."
              meta={<StatusBadge tone="warning">Blocages</StatusBadge>}
            >
              {report.weekly_snapshot.blocked_objectives.length === 0 ? (
                <p className="muted-copy">Aucun blocage majeur n'est remonté pour le moment.</p>
              ) : (
                <div className="list-stack">
                  {report.weekly_snapshot.blocked_objectives.map((item) => (
                    <p className="coach-list-item" key={item}>
                      {item}
                    </p>
                  ))}
                </div>
              )}
            </ActionCard>
          </div>

          <div className="coach-panel__summary-grid">
            <ActionCard
              title="Habitudes les plus régulières"
              description="Appuis fiables à conserver."
              meta={<StatusBadge tone="accent">Routines</StatusBadge>}
            >
              {report.weekly_snapshot.regular_habits.length === 0 ? (
                <p className="muted-copy">Aucune habitude forte ne se dégage encore.</p>
              ) : (
                <div className="list-stack">
                  {report.weekly_snapshot.regular_habits.map((item) => (
                    <p className="coach-list-item" key={item}>
                      {item}
                    </p>
                  ))}
                </div>
              )}
            </ActionCard>

            <ActionCard
              title="3 priorités maximum"
              description="Le cap de la semaine suivante."
              meta={<StatusBadge tone="success">Cap</StatusBadge>}
            >
              <div className="list-stack">
                {report.weekly_snapshot.recommended_priorities.map((item) => (
                  <p className="coach-list-item" key={item}>
                    {item}
                  </p>
                ))}
              </div>
            </ActionCard>
          </div>
        </div>
      ) : null}

      {!loading && report && activeTab === "history" ? (
        historyEntries.length === 0 ? (
          <EmptyState
            title="Aucune recommandation enregistrée"
            description="Les recommandations de coaching seront conservées localement sur cet appareil."
          />
        ) : (
          <div className="coach-panel__stack">
            {historyEntries.map((entry) => (
              <ActionCard
                key={entry.id}
                title={entry.summary}
                description={entry.objective_title ?? "Sans objectif explicite"}
                meta={<StatusBadge tone="accent">{formatDateTime(entry.created_at)}</StatusBadge>}
              >
                <div className="coach-plan">
                  <span>{entry.likely_blocker}</span>
                  <strong>{entry.next_action.title}</strong>
                  <span>
                    {entry.next_action.duration_minutes} min · {entry.next_action.suggested_time}
                  </span>
                </div>
              </ActionCard>
            ))}
          </div>
        )
      ) : null}
    </BottomSheet>
  );
}
