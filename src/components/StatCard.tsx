import type { ReactNode } from "react";
import { MetricCard } from "./ui";

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
  return <MetricCard label={label} value={value} tone={tone} hint={hint} icon={icon} />;
}
