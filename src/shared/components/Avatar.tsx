import { cn } from '../utils/cn';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
};

export const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

type AvatarProps = {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
};

// Profile picture with initials as fallback.
export const Avatar = ({ name, src, size = 'md', className }: AvatarProps) => (
  <span
    className={cn(
      'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-subtle font-semibold text-primary-subtle-fg',
      sizeClasses[size],
      className
    )}
  >
    {src ? (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    ) : (
      <span aria-hidden="true">{getInitials(name)}</span>
    )}
  </span>
);
