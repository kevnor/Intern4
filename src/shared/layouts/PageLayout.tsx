import type { ReactNode } from 'react';
import { PageHeader } from './PageHeader';

type PageLayoutProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  headerContent?: ReactNode;
  className?: string;
};

export const PageLayout = ({
  title,
  description,
  actions,
  children,
  headerContent,
  className = '',
}: PageLayoutProps) => (
  <div className="min-h-[calc(100dvh-3.5rem)] bg-canvas py-5 sm:py-8">
    <div className={`mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8 ${className}`}>
      <PageHeader title={title} actions={actions}>
        {description && <p className="max-w-3xl text-muted">{description}</p>}
        {headerContent}
      </PageHeader>
      {children}
    </div>
  </div>
);
