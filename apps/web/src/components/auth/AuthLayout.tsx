import { ReactNode, Suspense } from 'react';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return <main className={styles.main}>{children}</main>;
}

export function AuthLayoutWithSuspense({ children }: AuthLayoutProps) {
  return (
    <main className={styles.main}>
      <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
        {children}
      </Suspense>
    </main>
  );
}
