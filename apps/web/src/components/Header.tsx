'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getCurrentUser, logout, User } from '@/lib/auth';
import styles from './Header.module.css';

export function Header() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated()) {
        try {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
        } catch {
          // Token invalid or expired
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    router.refresh();
  };

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>
        Hypertube
      </Link>

      <nav className={styles.nav}>
        {loading ? (
          <span className={styles.loading}>...</span>
        ) : user ? (
          <div className={styles.userSection}>
            <span className={styles.username}>Hello, {user.username}</span>
            <button onClick={handleLogout} className={styles.logoutButton}>
              Logout
            </button>
          </div>
        ) : (
          <div className={styles.authLinks}>
            <Link href="/login" className={styles.link}>
              Sign In
            </Link>
            <Link href="/register" className={styles.registerButton}>
              Register
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
