import ResetPasswordForm from '../components/ResetPasswordForm';
import AuthLayout from '../components/AuthLayout';

const ResetPasswordPage = () => (
  <AuthLayout title="Nytt passord" description="Velg et nytt passord for kontoen din.">
    <ResetPasswordForm />
  </AuthLayout>
);

export default ResetPasswordPage;
