import { cn } from '../utils/cn';

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export const SegmentedControl = <T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) => (
  <div
    role="radiogroup"
    aria-label={label}
    className={cn('inline-flex rounded-xl bg-surface-muted p-1', className)}
  >
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors pointer-coarse:min-h-10',
            selected ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);
