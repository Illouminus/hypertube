'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { register } from '@/lib/auth';
import { ApiRequestError } from '@/lib/api';
import { Button, Input, FormError, FormField } from '@/components/ui';
import styles from './AuthForm.module.css';

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors([]);

    // Client-side validation
    const validationErrors: string[] = [];

    if (password !== confirmPassword) {
      validationErrors.push('Passwords do not match');
    }

    if (password.length < 8) {
      validationErrors.push('Password must be at least 8 characters long');
    }

    if (username.length < 3) {
      validationErrors.push('Username must be at least 3 characters long');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);

    try {
      await register(email, username, password);
      router.push('/');
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

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {errors.length > 0 && <FormError errors={errors} />}

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

      <FormField
        label="Username"
        htmlFor="username"
        hint="3-30 characters, letters, numbers, underscores, hyphens only"
      >
        <Input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Choose a username"
          required
          disabled={isLoading}
          minLength={3}
          maxLength={30}
        />
      </FormField>

      <FormField
        label="Password"
        htmlFor="password"
        hint="At least 8 characters with uppercase, lowercase, and number"
      >
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a password"
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
          placeholder="Confirm your password"
          required
          disabled={isLoading}
        />
      </FormField>

      <Button type="submit" isLoading={isLoading} className={styles.submitButton}>
        {isLoading ? 'Creating account...' : 'Create Account'}
      </Button>
    </form>
  );
}
