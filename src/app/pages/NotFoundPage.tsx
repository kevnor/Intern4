import { Link } from 'react-router-dom';
import { APP_ROUTES } from '../constants/appRoutes';

const NotFoundPage = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-muted">
      <div className="bg-surface p-8 rounded-md shadow-md w-full max-w-md text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <h2 className="text-xl font-semibold mb-2">Siden ble ikke funnet</h2>
        <p className="text-muted mb-6">Beklager, siden du leter etter eksisterer ikke.</p>
        <Link to={APP_ROUTES.HOME} className="text-primary hover:underline">
          Tilbake til forsiden
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
