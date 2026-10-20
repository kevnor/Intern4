import type { ReactNode } from 'react';
import { BrandMark } from '../../../app/layout/Navbar';
import { ThemeToggleButton } from '../../../app/layout/ThemeSelector';

type AuthLayoutProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

// Brand panel above the form on phones, beside it on large screens.
const AuthLayout = ({ title, description, children }: AuthLayoutProps) => (
  <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
    <aside className="relative overflow-hidden bg-header px-6 pb-14 pt-[max(1.25rem,env(safe-area-inset-top))] text-header-fg lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:p-12">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-10 select-none font-serif text-[18rem] font-bold leading-none opacity-[0.07] lg:text-[28rem]"
      >
        S
      </span>
      <div className="relative flex items-center justify-between">
        <BrandMark />
        <ThemeToggleButton />
      </div>
      <div className="relative mt-8 lg:mt-0">
        <p className="text-2xl font-bold leading-tight tracking-tight lg:text-4xl">
          Singsaker Studenterhjem
        </p>
        <p className="mt-2 max-w-sm text-sm opacity-80 lg:text-base">
          Regi, oppgaver og beboere – samlet på ett sted.
        </p>
      </div>
      <span className="hidden lg:block" />
    </aside>

    <main className="-mt-8 flex flex-1 items-start justify-center px-4 pb-10 lg:mt-0 lg:items-center lg:p-12">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-lg sm:p-8 lg:border-0 lg:bg-transparent lg:shadow-none">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mb-6 mt-1 text-muted">{description}</p>}
        {children}
      </div>
    </main>
  </div>
);

export default AuthLayout;
