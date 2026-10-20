import { BrowserRouter, useLocation } from 'react-router-dom';
import { AuthProvider } from './app/providers/AuthContext';
import { ThemeProvider } from './app/providers/ThemeProvider';
import AppRouter from './app/routes/AppRouter';
import Navbar from './app/layout/Navbar';
import MobileTabBar from './app/layout/MobileTabBar';
import { AUTH_PATHS } from './features/auth/paths';

const HIDE_NAVBAR_ROUTES = [
  AUTH_PATHS.LOGIN,
  AUTH_PATHS.FORGOT_PASSWORD,
  AUTH_PATHS.RESET_PASSWORD,
];

const AppContent = () => {
  const { pathname } = useLocation();
  const hideNavbar = HIDE_NAVBAR_ROUTES.includes(pathname);

  return (
    <>
      {!hideNavbar && <Navbar />}
      {/* Leaves room for the mobile tab bar. */}
      <div
        className={
          hideNavbar
            ? undefined
            : 'overflow-x-clip pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0'
        }
      >
        <AppRouter />
      </div>
      {!hideNavbar && <MobileTabBar />}
    </>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
