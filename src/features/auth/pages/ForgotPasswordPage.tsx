import ForgotPasswordForm from '../components/ForgotPasswordForm';
import AuthLayout from '../components/AuthLayout';

const ForgotPasswordPage = () => (
  <AuthLayout
    title="Glemt passord"
    description="Skriv inn e-postadressen din for å motta en tilbakestillingslenke."
  >
    <ForgotPasswordForm />
  </AuthLayout>
);

export default ForgotPasswordPage;
