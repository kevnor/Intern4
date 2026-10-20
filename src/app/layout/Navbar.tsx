import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronDown, LogOut, UserCircle } from 'lucide-react';
import { useAuth } from '../providers/AuthContext';
import DropdownMenu from './DropdownMenu';
import { ThemeSelector, ThemeToggleButton } from './ThemeSelector';
import { useVisibleNavigation } from './useVisibleNavigation';
import { logOut } from '../../server/dao/authentication';
import { APP_ROUTES } from '../constants/appRoutes';
import { AUTH_PATHS } from '../../features/auth/paths';
import { USER_PATHS } from '../../features/users/paths';
import { cn } from '../../shared/utils/cn';

export const BrandMark = ({ className }: { className?: string }) => (
  <span className={cn('flex items-center gap-2.5', className)}>
    <span
      aria-hidden="true"
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 font-serif text-lg font-bold ring-1 ring-white/25"
    >
      S
    </span>
    <span className="text-lg font-semibold tracking-tight">Internsiden</span>
  </span>
);

const Navbar = () => {
  const { user } = useAuth();
  const visibleItems = useVisibleNavigation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = async () => {
    await logOut();
    setUserMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;

      if (userMenuRef.current && target instanceof Node && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <nav className="sticky top-0 z-40 bg-header pt-[env(safe-area-inset-top)] text-header-fg shadow-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to={APP_ROUTES.HOME} className="rounded-lg">
          <BrandMark />
        </Link>

        {user ? (
          <>
            {/* On phones the bottom tab bar handles navigation. */}
            <ThemeToggleButton className="md:hidden" />

            <div className="hidden items-center gap-1 md:flex">
              {visibleItems.map((item) =>
                item.children ? (
                  <DropdownMenu key={item.key} label={item.label} items={item.children} />
                ) : (
                  <NavLink
                    key={item.key}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex h-10 items-center rounded-lg px-3 text-sm font-medium hover:bg-header-hover',
                        isActive && 'bg-header-hover'
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                )
              )}

              <div className="relative ml-2" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((open) => !open)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                  className="flex h-10 items-center gap-2 rounded-lg px-2 hover:bg-header-hover"
                >
                  <UserCircle aria-hidden="true" className="h-6 w-6" />
                  <span className="max-w-[140px] truncate text-sm font-semibold">
                    {user.name || 'Bruker'}
                  </span>
                  <ChevronDown aria-hidden="true" className="h-4 w-4" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface-raised text-fg shadow-lg">
                    <div className="border-b border-border px-4 py-3">
                      <div className="truncate text-sm font-semibold">{user.name || 'Bruker'}</div>
                      <div className="truncate text-xs text-muted">{user.email || ''}</div>
                    </div>
                    <div className="p-1">
                      <Link
                        to={USER_PATHS.PROFILE}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-muted"
                      >
                        <UserCircle aria-hidden="true" className="h-4 w-4 text-muted" />
                        Profil
                      </Link>
                    </div>
                    <div className="border-t border-border px-3 py-3">
                      <p className="mb-2 text-xs font-medium text-muted">Utseende</p>
                      <ThemeSelector />
                    </div>
                    <div className="border-t border-border p-1">
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-subtle"
                      >
                        <LogOut aria-hidden="true" className="h-4 w-4" />
                        Logg ut
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <Link
            to={AUTH_PATHS.LOGIN}
            className="flex h-10 items-center rounded-lg px-3 text-sm font-medium hover:bg-header-hover"
          >
            Logg inn
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
