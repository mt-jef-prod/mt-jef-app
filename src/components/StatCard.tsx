import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  tone?: "default" | "accent" | "alert";
  hint?: string;
  icon?: ReactNode;
}

export function StatCard({
  label,
  value,
  tone = "default",
  hint,
  icon
}: StatCardProps) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__eyebrow">
        <span>{label}</span>
        {icon ? <span className="stat-card__icon">{icon}</span> : null}
      </div>
      <strong>{value}</strong>
      {hint ? <p>{hint}</p> : null}
    </article>
  );
}
