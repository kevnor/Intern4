import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../shared/utils/cn';

type DropdownItem = {
  label: string;
  to: string;
};

type DropdownMenuProps = {
  label: string;
  items: DropdownItem[];
};

const DropdownMenu = ({ label, items }: DropdownMenuProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();
  const { pathname } = useLocation();
  const active = items.some((item) => item.to === pathname);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;

      if (ref.current && target instanceof Node && !ref.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const focusItem = (index: number) => {
    const links = ref.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]');
    if (!links || links.length === 0) return;
    links[(index + links.length) % links.length].focus();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const links = Array.from(
      ref.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]') ?? []
    );
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        requestAnimationFrame(() => focusItem(0));
      } else {
        focusItem(current + 1);
      }
    } else if (event.key === 'ArrowUp' && open) {
      event.preventDefault();
      focusItem(current - 1);
    }
  };

  return (
    <div className="relative" ref={ref} onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((open) => !open)}
        className={cn(
          'flex h-10 items-center gap-1 rounded-lg px-3 text-sm font-medium hover:bg-header-hover',
          active && 'bg-header-hover'
        )}
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <ul
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-surface-raised py-1 text-fg shadow-lg"
        >
          {items.map(({ label, to }) => (
            <li key={to} role="none">
              <Link
                to={to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(
                  'block px-4 py-2 text-sm hover:bg-surface-muted focus:bg-surface-muted focus:outline-none',
                  to === pathname && 'font-semibold text-primary'
                )}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DropdownMenu;
