import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

type CardProps = {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export const Card = ({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: CardProps) => (
  <section
    className={cn('rounded-2xl border border-border bg-surface text-fg shadow-sm', className)}
  >
    {(title || actions) && (
      <header className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0 space-y-1">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
    )}
    <div className={cn('px-4 py-4 sm:px-5', bodyClassName)}>{children}</div>
  </section>
);
