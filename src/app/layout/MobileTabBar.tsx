import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ClipboardList, Home, LogOut, Menu, UserCircle, Users } from 'lucide-react';
import { useAuth } from '../providers/AuthContext';
import { ThemeSelector } from './ThemeSelector';
import { useVisibleNavigation } from './useVisibleNavigation';
import { logOut } from '../../server/dao/authentication';
import { Modal } from '../../shared/components/Modal';
import { cn } from '../../shared/utils/cn';
import { REGI_PATHS } from '../../features/regi/paths';
import { USER_PATHS } from '../../features/users/paths';
import { RESIDENT_PATHS } from '../../features/residents/paths';
import { APP_ROUTES } from '../constants/appRoutes';

const tabClasses = (active: boolean) =>
  cn(
    'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
    active ? 'text-primary' : 'text-subtle hover:text-fg'
  );

const MobileTabBar = () => {
  const { user } = useAuth();
  const visibleItems = useVisibleNavigation();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    setMenuOpen(false);
    await logOut();
  };

  const linkClasses = (to: string) =>
    cn(
      'flex min-h-12 items-center rounded-xl px-3 text-base',
      to === pathname
        ? 'bg-primary-subtle font-semibold text-primary-subtle-fg'
        : 'hover:bg-surface-muted'
    );

  return (
    <>
      <nav
        aria-label="Hovedmeny"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="flex">
          <NavLink to={APP_ROUTES.HOME} end className={({ isActive }) => tabClasses(isActive)}>
            <Home aria-hidden="true" className="h-6 w-6" />
            Hjem
          </NavLink>
          <NavLink to={REGI_PATHS.REGI} className={({ isActive }) => tabClasses(isActive)}>
            <ClipboardList aria-hidden="true" className="h-6 w-6" />
            Regi
          </NavLink>
          <NavLink to={RESIDENT_PATHS.BEBOERE} className={({ isActive }) => tabClasses(isActive)}>
            <Users aria-hidden="true" className="h-6 w-6" />
            Beboere
          </NavLink>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            className={tabClasses(menuOpen)}
          >
            <Menu aria-hidden="true" className="h-6 w-6" />
            Meny
          </button>
        </div>
      </nav>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Meny" fullScreenOnMobile>
        <div
          className="space-y-6"
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest('a')) setMenuOpen(false);
          }}
        >
          <div className="flex items-center gap-3 rounded-2xl bg-surface-muted p-3">
            <UserCircle aria-hidden="true" className="h-10 w-10 text-subtle" />
            <div className="min-w-0">
              <div className="truncate font-semibold">{user.name || 'Bruker'}</div>
              <div className="truncate text-sm text-muted">{user.email || ''}</div>
            </div>
          </div>

          <ul className="space-y-1">
            {visibleItems.map((item) =>
              item.children ? (
                <li key={item.key} className="pt-3">
                  <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-subtle">
                    {item.label}
                  </p>
                  <ul className="space-y-1">
                    {item.children.map((child) => (
                      <li key={child.to}>
                        <Link to={child.to} className={linkClasses(child.to)}>
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                <li key={item.key}>
                  <Link to={item.to} className={linkClasses(item.to)}>
                    {item.label}
                  </Link>
                </li>
              )
            )}
            <li className="pt-3">
              <Link to={USER_PATHS.PROFILE} className={linkClasses(USER_PATHS.PROFILE)}>
                Profil
              </Link>
            </li>
          </ul>

          <div>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-subtle">
              Utseende
            </p>
            <ThemeSelector />
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-danger-border text-danger hover:bg-danger-subtle"
          >
            <LogOut aria-hidden="true" className="h-5 w-5" />
            Logg ut
          </button>
        </div>
      </Modal>
    </>
  );
};

export default MobileTabBar;
