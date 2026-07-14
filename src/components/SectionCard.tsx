import type { PropsWithChildren, ReactNode } from "react";
import { Card, SectionHeader } from "./ui";

interface SectionCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children
}: SectionCardProps) {
  return (
    <Card className="section-card fade-up">
      <SectionHeader title={title} description={subtitle} actions={actions} />
      <div className="section-card__body">{children}</div>
    </Card>
  );
}
