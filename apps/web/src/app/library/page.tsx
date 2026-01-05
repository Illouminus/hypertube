'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { SearchBar, MovieGrid } from '@/components/library';
import { isAuthenticated } from '@/lib/auth';
import {
  searchMovies,
  getPopularMovies,
  type MovieListItem,
  type PaginatedMovies,
} from '@/lib/movies';
import styles from './page.module.css';

export default function LibraryPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  // Data state
  const [movies, setMovies] = useState<MovieListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth check on mount
  useEffect(() => {
    const authed = isAuthenticated();
    setIsAuthed(authed);
    setAuthChecked(true);

    if (!authed) {
      // Client-side redirect to login
      router.push('/login?redirect=/library');
    }
  }, [router]);

  // Fetch movies function
  const fetchMovies = useCallback(
    async (pageNum: number, query: string, append = false) => {
      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
          setError(null);
        }

        let result: PaginatedMovies;
        if (query) {
          result = await searchMovies(query, pageNum, 20);
        } else {
          result = await getPopularMovies(pageNum, 20);
        }

        if (append) {
          setMovies((prev) => [...prev, ...result.items]);
        } else {
          setMovies(result.items);
        }

        setHasMore(result.hasMore);
        setPage(pageNum);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load movies';
        setError(message);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [],
  );

  // Initial load
  useEffect(() => {
    if (isAuthed) {
      fetchMovies(1, '');
    }
  }, [isAuthed, fetchMovies]);

  // Handlers
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setMovies([]);
      setPage(1);
      setHasMore(true);
      fetchMovies(1, query);
    },
    [fetchMovies],
  );

  const handleClear = useCallback(() => {
    setSearchQuery('');
    setMovies([]);
    setPage(1);
    setHasMore(true);
    fetchMovies(1, '');
  }, [fetchMovies]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchMovies(page + 1, searchQuery, true);
    }
  }, [fetchMovies, isLoadingMore, hasMore, page, searchQuery]);

  const handleRetry = useCallback(() => {
    fetchMovies(page, searchQuery, movies.length > 0);
  }, [fetchMovies, page, searchQuery, movies.length]);

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
          <div className={styles.redirectMessage}>
            <p className={styles.redirectText}>
              Please sign in to access the library
            </p>
            <Link href="/login?redirect=/library" className={styles.redirectLink}>
              Go to Sign In
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
          <header className={styles.header}>
            <h1 className={styles.title}>Movie Library</h1>
            <p className={styles.subtitle}>
              Browse and search our collection of classic films
            </p>
          </header>

          <SearchBar
            onSearch={handleSearch}
            onClear={handleClear}
            isSearching={isLoading}
            initialQuery={searchQuery}
          />

          {searchQuery && (
            <div className={styles.searchInfo}>
              Showing results for:{' '}
              <span className={styles.searchQuery}>{searchQuery}</span>
            </div>
          )}

          <MovieGrid
            movies={movies}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            error={error}
            onLoadMore={handleLoadMore}
            onRetry={handleRetry}
          />
        </div>
      </main>
    </>
  );
}
