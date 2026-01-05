'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthLayout, AuthCard, LoginForm } from '@/components/auth';
import { isAuthenticated } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/library');
    }
  }, [router]);

  // Don't render form if authenticated (will redirect)
  if (typeof window !== 'undefined' && isAuthenticated()) {
    return null;
  }

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
