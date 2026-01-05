'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { MovieListItem } from '@/lib/movies';
import { MovieCard } from './MovieCard';
import { Spinner } from '@/components/ui';
import styles from './MovieGrid.module.css';

interface MovieGridProps {
  movies: MovieListItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onLoadMore: () => void;
  onRetry: () => void;
}

export function MovieGrid({
  movies,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onLoadMore,
  onRetry,
}: MovieGridProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Infinite scroll with IntersectionObserver
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
        onLoadMore();
      }
    },
    [hasMore, isLoadingMore, isLoading, onLoadMore],
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '100px',
      threshold: 0,
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [handleObserver]);

  // Initial loading skeleton
  if (isLoading && movies.length === 0) {
    return <MovieGridSkeleton />;
  }

  // Error state
  if (error && movies.length === 0) {
    return (
      <div className={styles.errorState}>
        <span className={styles.errorIcon}>⚠️</span>
        <p className={styles.errorText}>{error}</p>
        <button className={styles.retryButton} onClick={onRetry}>
          Try Again
        </button>
      </div>
    );
  }

  // Empty state
  if (!isLoading && movies.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>🎬</span>
        <h3 className={styles.emptyTitle}>No movies found</h3>
        <p className={styles.emptyText}>
          Try a different search or browse popular movies
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>

      {/* Infinite scroll trigger */}
      <div ref={loadMoreRef} className={styles.loadMoreTrigger}>
        {isLoadingMore && <Spinner size="medium" />}
      </div>

      {/* Show error inline if we have some movies */}
      {error && movies.length > 0 && (
        <div className={styles.errorState}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.retryButton} onClick={onRetry}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

function MovieGridSkeleton() {
  return (
    <div className={styles.skeletonGrid}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <div className={styles.skeletonPoster} />
          <div className={styles.skeletonInfo}>
            <div className={styles.skeletonTitle} />
            <div className={styles.skeletonMeta} />
          </div>
        </div>
      ))}
    </div>
  );
}
