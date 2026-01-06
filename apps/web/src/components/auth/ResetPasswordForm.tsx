'use client';

import { useState, FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { resetPassword } from '@/lib/auth';
import { ApiRequestError } from '@/lib/api';
import { Button, Input, FormError, FormField } from '@/components/ui';
import { AuthCard, AuthSuccess } from './AuthCard';
import styles from './AuthForm.module.css';
import cardStyles from './AuthCard.module.css';

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // No token provided
  if (!token) {
    return (
      <AuthCard
        title="Invalid Link"
        subtitle="This password reset link is invalid or has expired."
      >
        <div className={cardStyles.invalidLinkContainer}>
          <Link href="/forgot-password" className={cardStyles.primaryButton}>
            Request New Link
          </Link>
        </div>
      </AuthCard>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors([]);

    // Validation
    const validationErrors: string[] = [];

    if (newPassword !== confirmPassword) {
      validationErrors.push('Passwords do not match');
    }

    if (newPassword.length < 8) {
      validationErrors.push('Password must be at least 8 characters long');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(token, newPassword);
      setSuccess(true);
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login?reset=success');
      }, 2000);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrors(err.messages);
      } else {
        setErrors(['An unexpected error occurred. Please try again.']);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthSuccess
        title="Password Reset!"
        message="Your password has been successfully reset."
        linkHref="/login"
        linkLabel="Sign In"
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {errors.length > 0 && <FormError errors={errors} />}

      <FormField
        label="New Password"
        htmlFor="newPassword"
        hint="At least 8 characters with uppercase, lowercase, and number"
      >
        <Input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter new password"
          required
          disabled={isLoading}
          minLength={8}
        />
      </FormField>

      <FormField label="Confirm Password" htmlFor="confirmPassword">
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          required
          disabled={isLoading}
        />
      </FormField>

      <Button type="submit" isLoading={isLoading} className={styles.submitButton}>
        {isLoading ? 'Resetting...' : 'Reset Password'}
      </Button>
    </form>
  );
}
