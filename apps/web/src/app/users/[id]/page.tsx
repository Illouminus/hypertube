'use client';

import { useState, useEffect, use } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getPublicProfile, PublicUser, LANGUAGE_LABELS, SupportedLanguage } from '@/lib/auth';
import { ApiRequestError } from '@/lib/api';
import { Spinner, Button } from '@/components/ui';
import styles from './page.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function UserProfilePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const profile = await getPublicProfile(id);
        setUser(profile);
      } catch (err) {
        if (err instanceof ApiRequestError) {
          if (err.statusCode === 404) {
            setError('User not found');
          } else {
            setError(err.messages[0] || 'Failed to load user profile');
          }
        } else {
          setError('An error occurred');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, [id]);

  const getInitial = (): string => {
    if (user?.firstName) return user.firstName.charAt(0).toUpperCase();
    if (user?.username) return user.username.charAt(0).toUpperCase();
    return '?';
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
  };

  const getLanguageLabel = (lang: string): string => {
    return LANGUAGE_LABELS[lang as SupportedLanguage] || lang;
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <Spinner />
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <h1 className={styles.errorTitle}>{error || 'User Not Found'}</h1>
          <p className={styles.errorMessage}>
            The user you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <button onClick={() => router.back()} className={styles.backLink}>
        ← Back
      </button>

      <div className={styles.profile}>
        <div className={styles.avatar}>
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={`${user.username}'s avatar`}
              className={styles.avatarImage}
              width={120}
              height={120}
              unoptimized
            />
          ) : (
            getInitial()
          )}
        </div>

        <h1 className={styles.name}>
          {user.firstName} {user.lastName}
        </h1>
        <p className={styles.username}>@{user.username}</p>

        <div className={styles.info}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Language</span>
            <span className={styles.languageBadge}>
              {getLanguageLabel(user.language)}
            </span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Member since</span>
            <span className={styles.infoValue}>{formatDate(user.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
