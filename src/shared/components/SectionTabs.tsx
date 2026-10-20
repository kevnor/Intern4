import { cn } from '../utils/cn';

type SectionTab = {
  key: string;
  label: string;
  count?: number;
  // Draws a divider before the tab, e.g. between resident and manager tabs.
  separated?: boolean;
};

type SectionTabsProps = {
  tabs: SectionTab[];
  activeKey: string;
  onChange: (key: string) => void;
  label?: string;
};

// Scrolls horizontally on narrow screens instead of wrapping.
export const SectionTabs = ({ tabs, activeKey, onChange, label }: SectionTabsProps) => (
  <div
    role="tablist"
    aria-label={label}
    className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
  >
    {tabs.map((tab) => {
      const active = tab.key === activeKey;
      return [
        tab.separated && (
          <span
            key={`${tab.key}-separator`}
            aria-hidden="true"
            className="mx-1 my-2.5 w-px shrink-0 bg-border-strong"
          />
        ),
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(tab.key)}
          className={cn(
            '-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors',
            active
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:border-border-strong hover:text-fg'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs tabular-nums',
                active ? 'bg-primary-subtle text-primary-subtle-fg' : 'bg-surface-muted text-muted'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>,
      ];
    })}
  </div>
);
