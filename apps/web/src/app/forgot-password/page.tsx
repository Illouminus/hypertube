import { AuthLayout, AuthCard, ForgotPasswordForm } from '@/components/auth';

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <AuthCard
        title="Reset Password"
        subtitle="Enter your email and we'll send you a reset link"
        backLink={{ href: '/login', label: '← Back to Sign In' }}
      >
        <ForgotPasswordForm />
      </AuthCard>
    </AuthLayout>
  );
}
