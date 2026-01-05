'use client';

import { useState, FormEvent } from 'react';
import { forgotPassword } from '@/lib/auth';
import { ApiRequestError } from '@/lib/api';
import { Button, Input, FormError, FormField } from '@/components/ui';
import { AuthSuccess } from './AuthCard';
import styles from './AuthForm.module.css';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.messages.join(', '));
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthSuccess
        title="Check Your Email"
        message="If an account with that email exists, we've sent a password reset link."
        note="Don't see it? Check your spam folder or try again."
        linkHref="/login"
        linkLabel="Back to Sign In"
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && <FormError errors={error} />}

      <FormField label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          disabled={isLoading}
        />
      </FormField>

      <Button type="submit" isLoading={isLoading} className={styles.submitButton}>
        {isLoading ? 'Sending...' : 'Send Reset Link'}
      </Button>
    </form>
  );
}
