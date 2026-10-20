import type { ComponentProps, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-fg shadow-sm hover:bg-primary-hover',
  secondary: 'border border-border-strong bg-surface text-fg shadow-sm hover:bg-surface-muted',
  danger: 'bg-danger text-danger-fg shadow-sm hover:bg-danger-hover',
  success: 'bg-success text-success-fg shadow-sm hover:opacity-90',
  ghost: 'text-muted hover:bg-surface-muted hover:text-fg',
};

// Touch devices get at least a 44px tap target regardless of size.
const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-sm pointer-coarse:min-h-11',
  md: 'min-h-10 px-4 text-sm pointer-coarse:min-h-11',
  lg: 'min-h-12 px-5 text-base',
};

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

// Exported so links (<Link className={buttonClasses()} />) can look like buttons.
export const buttonClasses = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}) =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && 'w-full',
    className
  );

type ButtonProps = ComponentProps<'button'> &
  ButtonStyleOptions & {
    loading?: boolean;
    icon?: ReactNode;
  };

export const Button = ({
  variant,
  size,
  fullWidth,
  loading = false,
  icon,
  className,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) => (
  <button
    type={type}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={buttonClasses({ variant, size, fullWidth, className })}
    {...props}
  >
    {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : icon}
    {children}
  </button>
);
