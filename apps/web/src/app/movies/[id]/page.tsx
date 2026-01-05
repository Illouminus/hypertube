'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { MovieDetails, CommentsSection } from '@/components/movies';
import { Spinner } from '@/components/ui';
import { isAuthenticated, clearTokens } from '@/lib/auth';
import { AuthExpiredError } from '@/lib/api';
import { getMovieById, type MovieDetails as MovieDetailsType } from '@/lib/movies';
import styles from './page.module.css';

interface MoviePageProps {
  params: Promise<{ id: string }>;
}

export default function MoviePage({ params }: MoviePageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [movie, setMovie] = useState<MovieDetailsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    const authed = isAuthenticated();
    setIsAuthed(authed);
    setAuthChecked(true);

    if (!authed) {
      router.push(`/login?redirect=/movies/${id}`);
    }
  }, [router, id]);

  // Fetch movie details
  useEffect(() => {
    if (!isAuthed) return;

    const fetchMovie = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getMovieById(id);
        setMovie(data);
      } catch (err) {
        // Handle auth expiry - redirect to login
        if (err instanceof AuthExpiredError) {
          clearTokens();
          router.push(`/login?redirect=/movies/${id}`);
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load movie');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMovie();
  }, [id, isAuthed, router]);

  // Show nothing while checking auth
  if (!authChecked) {
    return null;
  }

  // Show redirect message if not authenticated
  if (!isAuthed) {
    return (
      <>
        <Header />
        <main className={styles.container}>
          <div className={styles.redirectContainer}>
            <p className={styles.redirectText}>
              Please sign in to view movie details
            </p>
            <Link
              href={`/login?redirect=/movies/${id}`}
              className={styles.redirectLink}
            >
              Go to Sign In
            </Link>
          </div>
        </main>
      </>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <>
        <Header />
        <main className={styles.container}>
          <div className={styles.loadingContainer}>
            <Spinner size="large" />
            <p className={styles.loadingText}>Loading movie...</p>
          </div>
        </main>
      </>
    );
  }

  // Error state
  if (error || !movie) {
    return (
      <>
        <Header />
        <main className={styles.container}>
          <div className={styles.errorContainer}>
            <span className={styles.errorIcon}>🎬</span>
            <h1 className={styles.errorTitle}>Movie not found</h1>
            <p className={styles.errorText}>{error || 'The requested movie could not be found'}</p>
            <Link href="/library" className={styles.backButton}>
              Back to Library
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className={styles.container}>
        <div className={styles.content}>
          <MovieDetails movie={movie} />
          <CommentsSection movieId={id} />
        </div>
      </main>
    </>
  );
}
