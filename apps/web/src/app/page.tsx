'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { Header } from '@/components/Header';
import { isAuthenticated } from '@/lib/auth';

export default function Home() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    setIsAuthed(isAuthenticated());
    setAuthChecked(true);
  }, []);

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Hypertube</h1>
          <p className={styles.description}>
            Your personal movie streaming platform
          </p>
          <div className={styles.actions}>
            {authChecked && (
              <Link
                href={isAuthed ? '/library' : '/register'}
                className={styles.button}
              >
                {isAuthed ? 'Go to Library' : 'Get Started'}
              </Link>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
