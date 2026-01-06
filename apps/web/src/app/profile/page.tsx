'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { Header } from '@/components/Header';
import { ProfileForm } from '@/components/profile';
import styles from './page.module.css';

export default function ProfilePage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login?redirect=/profile');
    }
  }, [router]);

  // Don't render if not authenticated
  if (typeof window !== 'undefined' && !isAuthenticated()) {
    return null;
  }

  return (
    <>
      <Header />
      <main className={styles.container}>
        <ProfileForm />
      </main>
    </>
  );
}
