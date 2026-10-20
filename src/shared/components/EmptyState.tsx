import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

type EmptyStateProps = {
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
};

export const EmptyState = ({ title, children, icon, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-surface px-4 py-10 text-center">
    <div
      aria-hidden="true"
      className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-subtle text-primary-subtle-fg"
    >
      {icon ?? <Inbox className="h-6 w-6" />}
    </div>
    <p className="font-medium text-fg">{title}</p>
    {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
