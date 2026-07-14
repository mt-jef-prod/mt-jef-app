import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  KeyboardEventHandler,
  PropsWithChildren,
  ReactNode,
  RefObject
} from "react";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost" | "icon";

interface BaseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  leading?: ReactNode;
  trailing?: ReactNode;
}

function Button({
  className,
  children,
  leading,
  trailing,
  variant,
  type = "button",
  ...props
}: BaseButtonProps & { variant: ButtonVariant }) {
  return (
    <button
      type={type}
      className={cx(`ui-button ui-button--${variant}`, className)}
      {...props}
    >
      {leading ? <span className="ui-button__icon">{leading}</span> : null}
      <span>{children}</span>
      {trailing ? <span className="ui-button__icon">{trailing}</span> : null}
    </button>
  );
}

export function PrimaryButton(props: BaseButtonProps) {
  return <Button {...props} variant="primary" className={cx("primary-button", props.className)} />;
}

export function SecondaryButton(props: BaseButtonProps) {
  return (
    <Button {...props} variant="secondary" className={cx("secondary-button", props.className)} />
  );
}

export function TertiaryButton(props: BaseButtonProps) {
  return <Button {...props} variant="tertiary" className={cx("tertiary-button", props.className)} />;
}

export function GhostButton(props: BaseButtonProps) {
  return <Button {...props} variant="ghost" className={cx("ghost-button", props.className)} />;
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
}

export function IconButton({ label, icon, className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx("ui-button ui-button--icon icon-button", className)}
      {...props}
    >
      {icon}
    </button>
  );
}

interface CardProps extends PropsWithChildren {
  className?: string;
  tone?: "default" | "accent" | "muted";
}

export function Card({ className, tone = "default", children }: CardProps) {
  return <section className={cx("card", `card--${tone}`, className)}>{children}</section>;
}

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function SectionHeader({ eyebrow, title, description, actions }: SectionHeaderProps) {
  return (
    <header className="section-header">
      <div>
        {eyebrow ? <p className="section-header__eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="section-header__actions">{actions}</div> : null}
    </header>
  );
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, meta, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__copy">
        {eyebrow ? <p className="page-header__eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {meta ? <div className="page-header__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "accent" | "alert" | "success";
  icon?: ReactNode;
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  icon
}: MetricCardProps) {
  return (
    <article className={cx("metric-card", `metric-card--${tone}`)}>
      <div className="metric-card__top">
        <span>{label}</span>
        {icon ? <span className="metric-card__icon">{icon}</span> : null}
      </div>
      <strong className="metric-card__value">{value}</strong>
      {hint ? <p className="metric-card__hint">{hint}</p> : null}
    </article>
  );
}

interface ActionCardProps extends PropsWithChildren {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function ActionCard({
  title,
  description,
  meta,
  actions,
  children
}: ActionCardProps) {
  return (
    <article className="action-card">
      <div className="action-card__header">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {meta ? <div className="action-card__meta">{meta}</div> : null}
      </div>
      {children ? <div className="action-card__body">{children}</div> : null}
      {actions ? <div className="action-card__actions">{actions}</div> : null}
    </article>
  );
}

interface ListRowProps {
  title: string;
  description?: string;
  meta?: ReactNode;
  aside?: ReactNode;
}

export function ListRow({ title, description, meta, aside }: ListRowProps) {
  return (
    <article className="list-row">
      <div className="list-row__main">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
        {meta ? <div className="list-row__meta">{meta}</div> : null}
      </div>
      {aside ? <div className="list-row__aside">{aside}</div> : null}
    </article>
  );
}

interface StatusBadgeProps {
  tone?: "default" | "accent" | "success" | "warning" | "danger";
  children: ReactNode;
}

export function StatusBadge({ tone = "default", children }: StatusBadgeProps) {
  return <span className={cx("status-badge", `status-badge--${tone}`)}>{children}</span>;
}

interface ProgressBarProps {
  value: number;
  max?: number;
}

export function ProgressBar({ value, max = 100 }: ProgressBarProps) {
  const safeValue = Math.max(0, Math.min(value, max));
  const width = `${(safeValue / max) * 100}%`;

  return (
    <div className="progress-bar" aria-hidden="true">
      <span className="progress-bar__fill" style={{ width }} />
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </section>
  );
}

interface SurfaceDialogProps extends PropsWithChildren {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  actions?: ReactNode;
}

export function BottomSheet({
  open,
  title,
  description,
  onClose,
  actions,
  children
}: SurfaceDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button type="button" className="surface-dialog__overlay" aria-label="Fermer" onClick={onClose} />
      <section className="surface-dialog surface-dialog--sheet" role="dialog" aria-modal="true">
        <SectionHeader title={title} description={description} actions={actions} />
        <div className="surface-dialog__body">{children}</div>
      </section>
    </>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  actions,
  children
}: SurfaceDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button type="button" className="surface-dialog__overlay" aria-label="Fermer" onClick={onClose} />
      <section className="surface-dialog surface-dialog--modal" role="dialog" aria-modal="true">
        <SectionHeader title={title} description={description} actions={actions} />
        <div className="surface-dialog__body">{children}</div>
      </section>
    </>
  );
}

interface SegmentedOption<T extends string> {
  label: string;
  value: T;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel
}: SegmentedControlProps<T>) {
  return (
    <div className="segmented-control" role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={option.value === value ? "is-active" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function TabBar<T extends string>(props: SegmentedControlProps<T>) {
  return <SegmentedControl {...props} />;
}

export interface BottomNavigationItem {
  id: string;
  label: string;
  icon: ReactNode;
}

interface BottomNavigationProps {
  items: BottomNavigationItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function BottomNavigation({ items, activeId, onSelect }: BottomNavigationProps) {
  return (
    <nav className="bottom-navigation" aria-label="Navigation principale">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cx("bottom-navigation__item", item.id === activeId && "is-active")}
          onClick={() => onSelect(item.id)}
        >
          <span className="bottom-navigation__icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

interface ToastProps {
  notice: {
    kind: "success" | "error" | "info";
    message: string;
  } | null;
}

export function Toast({ notice }: ToastProps) {
  if (!notice) {
    return null;
  }

  return (
    <div className={cx("toast", `toast--${notice.kind}`)} role="status" aria-live="polite">
      {notice.message}
    </div>
  );
}

interface LoadingSkeletonProps {
  lines?: number;
}

export function LoadingSkeleton({ lines = 3 }: LoadingSkeletonProps) {
  return (
    <div className="loading-skeleton" aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <span key={index} className="loading-skeleton__line" />
      ))}
    </div>
  );
}

interface FormFieldProps extends PropsWithChildren {
  label: string;
  hint?: string;
}

export function FormField({ label, hint, children }: FormFieldProps) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function SearchField({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="search" className={cx("search-field", className)} {...props} />;
}

interface AvatarProps {
  name: string;
  detail?: string | null;
}

export function Avatar({ name, detail }: AvatarProps) {
  const normalized = name.trim() || "MT";
  const initials = normalized
    .split(/\s+/)
    .slice(0, 2)
    .map((value) => value.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="avatar">
      <div className="avatar__badge" aria-hidden="true">
        {initials || "MT"}
      </div>
      <div className="avatar__copy">
        <strong>{normalized}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
    </div>
  );
}

interface FloatingAssistantButtonProps {
  open: boolean;
  onClick: () => void;
}

export function FloatingAssistantButton({ open, onClick }: FloatingAssistantButtonProps) {
  return (
    <button
      type="button"
      className={cx("floating-assistant-button", open && "is-open")}
      aria-expanded={open}
      onClick={onClick}
    >
      <span className="floating-assistant-button__dot" aria-hidden="true" />
      <span>Assistant IA</span>
    </button>
  );
}

interface ChatComposerProps {
  value: string;
  maxLength: number;
  sending: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
}

export function ChatComposer({
  value,
  maxLength,
  sending,
  onChange,
  onSubmit,
  placeholder,
  textareaRef,
  onKeyDown
}: ChatComposerProps) {
  const remainingCharacters = maxLength - value.length;

  return (
    <div className="chat-composer">
      <label className="chat-composer__field">
        <span>Votre message</span>
        <textarea
          ref={textareaRef}
          rows={4}
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
        />
      </label>
      <div className="chat-composer__footer">
        <small>{remainingCharacters} caractères restants</small>
        <PrimaryButton type="button" onClick={onSubmit} disabled={sending || value.trim() === ""}>
          {sending ? "Réponse en cours..." : "Envoyer"}
        </PrimaryButton>
      </div>
    </div>
  );
}

interface DiagnosticPanelProps extends PropsWithChildren {
  id?: string;
  open: boolean;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  actions?: ReactNode;
}

export function DiagnosticPanel({
  id,
  open,
  title,
  eyebrow,
  onClose,
  actions,
  children
}: DiagnosticPanelProps) {
  return (
    <aside id={id} className={cx("diagnostic-panel", open && "is-open")} aria-label={title}>
      <SectionHeader eyebrow={eyebrow} title={title} actions={actions ?? <GhostButton onClick={onClose}>Réduire</GhostButton>} />
      <div className="diagnostic-panel__body">{children}</div>
    </aside>
  );
}
