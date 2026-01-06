'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { login } from '@/lib/auth';
import { ApiRequestError } from '@/lib/api';
import { Button, Input, FormError, FormField } from '@/components/ui';
import styles from './AuthForm.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check for success/error messages from redirects
  useEffect(() => {
    const resetSuccess = searchParams.get('reset');
    const oauthError = searchParams.get('error');

    if (resetSuccess === 'success') {
      setSuccessMessage('Password reset successfully! Please sign in with your new password.');
      window.history.replaceState({}, '', '/login');
    }

    if (oauthError) {
      setError(decodeURIComponent(oauthError));
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      await login(emailOrUsername, password);
      router.push('/');
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

  const handleFortyTwoLogin = () => {
    window.location.href = `${API_URL}/auth/42`;
  };

  return (
    <div className={styles.form}>
      {successMessage && (
        <div className={styles.successMessage}>{successMessage}</div>
      )}
      {error && <FormError errors={error} />}

      {/* OAuth Button */}
      <button
        type="button"
        onClick={handleFortyTwoLogin}
        className={styles.oauthButton}
        disabled={isLoading}
      >
        <span className={styles.oauthLogo}>42</span>
        Continue with 42
      </button>

      {/* Divider */}
      <div className={styles.divider}>
        <div className={styles.dividerLine} />
        <span className={styles.dividerText}>or</span>
        <div className={styles.dividerLine} />
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <FormField label="Email or Username" htmlFor="emailOrUsername">
            <Input
              id="emailOrUsername"
              type="text"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              placeholder="Enter your email or username"
              required
              disabled={isLoading}
            />
          </FormField>

          <FormField label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={isLoading}
            />
          </FormField>

          <Button type="submit" isLoading={isLoading} className={styles.submitButton}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </div>
      </form>
    </div>
  );
}
