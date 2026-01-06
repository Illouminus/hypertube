'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated, getCurrentUser, logout, User } from '@/lib/auth';
import styles from './Header.module.css';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (isAuthenticated()) {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch {
        // Token invalid or expired
        setUser(null);
      }
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      await loadUser();
      setLoading(false);
    };

    checkAuth();
  }, [loadUser]);

  // Listen for profile updates
  useEffect(() => {
    const handleProfileUpdate = (event: CustomEvent<User>) => {
      setUser(event.detail);
    };

    window.addEventListener('profileUpdated', handleProfileUpdate as EventListener);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate as EventListener);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    router.push('/login');
  };

  const isActive = (path: string) => pathname === path;

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
            <Link
              href="/library"
              className={`${styles.navLink} ${isActive('/library') ? styles.navLinkActive : ''}`}
            >
              Library
            </Link>
            <Link
              href="/profile"
              className={`${styles.navLink} ${isActive('/profile') ? styles.navLinkActive : ''}`}
            >
              {user.username}
            </Link>
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
