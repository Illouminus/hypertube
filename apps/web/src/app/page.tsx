import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Hypertube</h1>
        <p className={styles.description}>
          Your personal movie streaming platform
        </p>
        <div className={styles.actions}>
          <Link href="/login" className={styles.button}>
            Sign In
          </Link>
        </div>
        <p className={styles.note}>
          Authentication will be implemented in a future stage.
        </p>
      </div>
    </main>
  );
}
