import { AuthLayoutWithSuspense, AuthCard, ResetPasswordForm } from '@/components/auth';

export default function ResetPasswordPage() {
  return (
    <AuthLayoutWithSuspense>
      <AuthCard
        title="Set New Password"
        subtitle="Enter your new password below"
        backLink={{ href: '/login', label: '← Back to Sign In' }}
      >
        <ResetPasswordForm />
      </AuthCard>
    </AuthLayoutWithSuspense>
  );
}
