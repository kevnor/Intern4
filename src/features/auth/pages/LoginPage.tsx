import LoginForm from '../components/LoginForm';
import AuthLayout from '../components/AuthLayout';

const LoginPage = () => (
  <AuthLayout title="Logg inn" description="Velkommen tilbake til internsiden.">
    <LoginForm />
  </AuthLayout>
);

export default LoginPage;
