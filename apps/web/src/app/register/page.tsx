import { AuthLayout, AuthCard, RegisterForm } from '@/components/auth';

export default function RegisterPage() {
  return (
    <AuthLayout>
      <AuthCard
        title="Create Account"
        subtitle="Join Hypertube today"
        footer={
          <>
            <AuthCard.FooterText>Already have an account?</AuthCard.FooterText>
            <AuthCard.FooterLink href="/login" primary>
              Sign in
            </AuthCard.FooterLink>
          </>
        }
        backLink={{ href: '/', label: '← Back to Home' }}
      >
        <RegisterForm />
      </AuthCard>
    </AuthLayout>
  );
}
