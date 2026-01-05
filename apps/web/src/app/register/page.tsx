'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthLayout, AuthCard, RegisterForm } from '@/components/auth';
import { isAuthenticated } from '@/lib/auth';

export default function RegisterPage() {
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
