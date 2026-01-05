import Link from 'next/link';
import styles from './page.module.css';
import { Header } from '@/components/Header';

export default function Home() {
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
            <Link href="/register" className={styles.button}>
              Get Started
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
