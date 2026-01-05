import { AuthLayout, AuthCard, LoginForm } from '@/components/auth';

export default function LoginPage() {
  return (
    <AuthLayout>
      <AuthCard
        title="Sign In"
        subtitle="Welcome back to Hypertube"
        footer={
          <>
            <AuthCard.FooterLink href="/forgot-password">
              Forgot your password?
            </AuthCard.FooterLink>
            <AuthCard.Separator />
            <AuthCard.FooterLink href="/register">
              Create an account
            </AuthCard.FooterLink>
          </>
        }
        backLink={{ href: '/', label: '← Back to Home' }}
      >
        <LoginForm />
      </AuthCard>
    </AuthLayout>
  );
}
