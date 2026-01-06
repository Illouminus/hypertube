'use client';

import { useState, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  User,
  UpdateProfileData,
  getProfile,
  updateProfile,
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  SupportedLanguage,
  clearTokens,
} from '@/lib/auth';
import { ApiRequestError, AuthExpiredError } from '@/lib/api';
import { Button, Input, FormError, FormField, Spinner } from '@/components/ui';
import styles from './ProfileForm.module.css';

interface ProfileFormProps {
  onProfileUpdate?: (user: User) => void;
}

export function ProfileForm({ onProfileUpdate }: ProfileFormProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');

  // Form fields
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await getProfile();
        setUser(profile);
        setEmail(profile.email);
        setUsername(profile.username);
        setFirstName(profile.firstName);
        setLastName(profile.lastName);
        setLanguage(profile.language);
        setAvatarUrl(profile.avatarUrl || '');
      } catch (err) {
        if (err instanceof AuthExpiredError) {
          clearTokens();
          router.push('/login?redirect=/profile');
          return;
        }
        setErrors(['Failed to load profile']);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setSuccessMessage('');

    // Client-side validation
    const validationErrors: string[] = [];

    if (!firstName.trim()) {
      validationErrors.push('First name is required');
    }

    if (!lastName.trim()) {
      validationErrors.push('Last name is required');
    }

    if (username.length < 3) {
      validationErrors.push('Username must be at least 3 characters');
    }

    if (!email.includes('@')) {
      validationErrors.push('Please enter a valid email address');
    }

    if (avatarUrl && !isValidUrl(avatarUrl)) {
      validationErrors.push('Please enter a valid URL for avatar');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);

    try {
      const updateData: UpdateProfileData = {};

      // Only include fields that changed
      if (email !== user?.email) updateData.email = email;
      if (username !== user?.username) updateData.username = username;
      if (firstName !== user?.firstName) updateData.firstName = firstName.trim();
      if (lastName !== user?.lastName) updateData.lastName = lastName.trim();
      if (language !== user?.language) updateData.language = language;
      if (avatarUrl !== (user?.avatarUrl || '')) {
        updateData.avatarUrl = avatarUrl || null;
      }

      // Only make API call if something changed
      if (Object.keys(updateData).length === 0) {
        setSuccessMessage('No changes to save');
        return;
      }

      const updatedUser = await updateProfile(updateData);
      setUser(updatedUser);
      setSuccessMessage('Profile updated successfully!');
      
      // Notify parent component (e.g., to update header)
      if (onProfileUpdate) {
        onProfileUpdate(updatedUser);
      }

      // Dispatch custom event for header update
      window.dispatchEvent(new CustomEvent('profileUpdated', { detail: updatedUser }));
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        clearTokens();
        router.push('/login?redirect=/profile');
        return;
      }
      if (err instanceof ApiRequestError) {
        setErrors(err.messages);
      } else {
        setErrors(['Failed to update profile. Please try again.']);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const getInitial = (): string => {
    if (firstName) return firstName.charAt(0).toUpperCase();
    if (username) return username.charAt(0).toUpperCase();
    return '?';
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Profile Settings</h1>
        <p className={styles.subtitle}>Manage your account information</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {errors.length > 0 && <FormError errors={errors} />}
        {successMessage && (
          <div className={styles.successMessage}>{successMessage}</div>
        )}

        {/* Avatar Section */}
        <div className={styles.avatarSection}>
          <div className={styles.avatarPreview}>
            {avatarUrl && isValidUrl(avatarUrl) ? (
              <Image
                src={avatarUrl}
                alt="Avatar"
                className={styles.avatarImage}
                width={80}
                height={80}
                unoptimized
              />
            ) : (
              getInitial()
            )}
          </div>
          <div className={styles.avatarInput}>
            <FormField
              label="Avatar URL"
              htmlFor="avatarUrl"
              hint="Enter a URL to an image"
            >
              <Input
                id="avatarUrl"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                disabled={isSaving}
              />
            </FormField>
          </div>
        </div>

        {/* Name Row */}
        <div className={styles.row}>
          <FormField label="First Name" htmlFor="firstName">
            <Input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
              required
              disabled={isSaving}
              maxLength={50}
            />
          </FormField>

          <FormField label="Last Name" htmlFor="lastName">
            <Input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
              required
              disabled={isSaving}
              maxLength={50}
            />
          </FormField>
        </div>

        {/* Email */}
        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={isSaving}
          />
        </FormField>

        {/* Username */}
        <FormField
          label="Username"
          htmlFor="username"
          hint="3-30 characters, letters, numbers, underscores, hyphens"
        >
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            required
            disabled={isSaving}
            minLength={3}
            maxLength={30}
          />
        </FormField>

        {/* Language */}
        <FormField label="Preferred Language" htmlFor="language">
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
            className={styles.languageSelect}
            disabled={isSaving}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]}
              </option>
            ))}
          </select>
        </FormField>

        <Button type="submit" isLoading={isSaving} className={styles.submitButton}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    </div>
  );
}
