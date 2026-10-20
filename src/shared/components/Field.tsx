import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '../utils/cn';

export const controlClasses = (invalid?: boolean, className?: string) =>
  cn(
    'block w-full rounded-lg border bg-surface px-3 text-base text-fg shadow-sm sm:text-sm',
    'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30',
    'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-subtle',
    invalid ? 'border-danger' : 'border-input',
    className
  );

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  // Receives the generated id so the control can be linked to its label, hint and error.
  children: (controlProps: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  }) => ReactNode;
};

export const Field = ({ label, hint, error, required, className, children }: FieldProps) => {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
};

type ControlProps = { invalid?: boolean };

export const Input = ({ invalid, className, ...props }: ComponentProps<'input'> & ControlProps) => (
  <input className={controlClasses(invalid, cn('min-h-10 py-2', className))} {...props} />
);

export const Select = ({
  invalid,
  className,
  ...props
}: ComponentProps<'select'> & ControlProps) => (
  <select className={controlClasses(invalid, cn('min-h-10 py-2 pr-8', className))} {...props} />
);

export const Textarea = ({
  invalid,
  className,
  ...props
}: ComponentProps<'textarea'> & ControlProps) => (
  <textarea className={controlClasses(invalid, cn('py-2', className))} {...props} />
);

export const Checkbox = ({
  label,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { label: ReactNode }) => (
  <label
    className={cn('inline-flex min-h-10 cursor-pointer items-center gap-2.5 text-sm', className)}
  >
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-input accent-[var(--primary)]"
      {...props}
    />
    {label}
  </label>
);
