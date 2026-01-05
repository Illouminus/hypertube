'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/auth';
import { ApiRequestError } from '@/lib/api';
import { Button, Input, FormError, FormField } from '@/components/ui';
import styles from './AuthForm.module.css';

export function LoginForm() {
  const router = useRouter();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
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

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && <FormError errors={error} />}

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
    </form>
  );
}
