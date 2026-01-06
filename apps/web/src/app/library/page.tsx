'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { SearchBar, MovieGrid, FiltersBar, type FilterState, type SortOption } from '@/components/library';
import { Spinner } from '@/components/ui';
import { isAuthenticated, clearTokens } from '@/lib/auth';
import { AuthExpiredError } from '@/lib/api';
import {
  searchMovies,
  getPopularMovies,
  type MovieListItem,
  type PaginatedMovies,
} from '@/lib/movies';
import styles from './page.module.css';

// Parse filters from URL search params
function parseFiltersFromParams(params: URLSearchParams): FilterState {
  const sort = (params.get('sort') as SortOption) || 'name-asc';
  const yearMin = params.get('yearMin') ? parseInt(params.get('yearMin')!, 10) : undefined;
  const yearMax = params.get('yearMax') ? parseInt(params.get('yearMax')!, 10) : undefined;
  return { sort, yearMin, yearMax };
}

// Convert filters to URL search params
function filtersToParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.sort !== 'name-asc') {
    params.set('sort', filters.sort);
  }
  if (filters.yearMin !== undefined) {
    params.set('yearMin', filters.yearMin.toString());
  }
  if (filters.yearMax !== undefined) {
    params.set('yearMax', filters.yearMax.toString());
  }
  return params;
}

// Apply client-side sorting and filtering
function applyFilters(movies: MovieListItem[], filters: FilterState): MovieListItem[] {
  let filtered = [...movies];

  // Apply year filter
  if (filters.yearMin !== undefined) {
    filtered = filtered.filter((m) => (m.year ?? 0) >= filters.yearMin!);
  }
  if (filters.yearMax !== undefined) {
    filtered = filtered.filter((m) => (m.year ?? 9999) <= filters.yearMax!);
  }

  // Apply sorting
  const [sortField, sortOrder] = filters.sort.split('-') as [string, 'asc' | 'desc'];
  filtered.sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'name':
        cmp = a.title.localeCompare(b.title);
        break;
      case 'year':
        cmp = (a.year ?? 0) - (b.year ?? 0);
        break;
      case 'rating':
        cmp = parseFloat(a.imdbRating ?? '0') - parseFloat(b.imdbRating ?? '0');
        break;
    }
    return sortOrder === 'desc' ? -cmp : cmp;
  });

  return filtered;
}

// Main library content that uses useSearchParams
function LibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  // Filter state from URL
  const initialFilters = useMemo(
    () => parseFiltersFromParams(searchParams),
    [searchParams],
  );
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  // Data state
  const [rawMovies, setRawMovies] = useState<MovieListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived: filtered and sorted movies
  const movies = useMemo(() => applyFilters(rawMovies, filters), [rawMovies, filters]);

  // Auth check on mount
  useEffect(() => {
    const authed = isAuthenticated();
    setIsAuthed(authed);
    setAuthChecked(true);

    if (!authed) {
      router.push('/login?redirect=/library');
    }
  }, [router]);

  // Sync filters from URL on mount and when params change
  useEffect(() => {
    setFilters(parseFiltersFromParams(searchParams));
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

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
          setRawMovies((prev) => [...prev, ...result.items]);
        } else {
          setRawMovies(result.items);
        }

        setHasMore(result.hasMore);
        setPage(pageNum);
      } catch (err) {
        // Handle auth expiry - redirect to login
        if (err instanceof AuthExpiredError) {
          clearTokens();
          router.push('/login?redirect=/library');
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Failed to load movies';
        setError(message);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [router],
  );

  // Initial load
  useEffect(() => {
    if (isAuthed) {
      const q = searchParams.get('q') || '';
      fetchMovies(1, q);
    }
  }, [isAuthed, searchParams, fetchMovies]);

  // Update URL when filters change
  const handleFiltersChange = useCallback(
    (newFilters: FilterState) => {
      setFilters(newFilters);

      // Update URL with filters
      const params = filtersToParams(newFilters);
      if (searchQuery) {
        params.set('q', searchQuery);
      }
      const search = params.toString();
      router.replace(`/library${search ? `?${search}` : ''}`, { scroll: false });
    },
    [router, searchQuery],
  );

  // Handlers
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setRawMovies([]);
      setPage(1);
      setHasMore(true);

      // Update URL with search query
      const params = filtersToParams(filters);
      if (query) {
        params.set('q', query);
      }
      const search = params.toString();
      router.replace(`/library${search ? `?${search}` : ''}`, { scroll: false });

      fetchMovies(1, query);
    },
    [fetchMovies, filters, router],
  );

  const handleClear = useCallback(() => {
    setSearchQuery('');
    setRawMovies([]);
    setPage(1);
    setHasMore(true);

    // Clear search from URL but keep filters
    const params = filtersToParams(filters);
    const search = params.toString();
    router.replace(`/library${search ? `?${search}` : ''}`, { scroll: false });

    fetchMovies(1, '');
  }, [fetchMovies, filters, router]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchMovies(page + 1, searchQuery, true);
    }
  }, [fetchMovies, isLoadingMore, hasMore, page, searchQuery]);

  const handleRetry = useCallback(() => {
    fetchMovies(page, searchQuery, rawMovies.length > 0);
  }, [fetchMovies, page, searchQuery, rawMovies.length]);

  // Show nothing while checking auth
  if (!authChecked) {
    return null;
  }

  // Show redirect message if not authenticated
  if (!isAuthed) {
    return (
      <div className={styles.redirectMessage}>
        <p className={styles.redirectText}>
          Please sign in to access the library
        </p>
        <Link href="/login?redirect=/library" className={styles.redirectLink}>
          Go to Sign In
        </Link>
      </div>
    );
  }

  return (
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

      <FiltersBar filters={filters} onFiltersChange={handleFiltersChange} />

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
  );
}

// Loading fallback for Suspense
function LibraryLoading() {
  return (
    <div className={styles.loadingContainer}>
      <Spinner size="large" />
      <p className={styles.loadingText}>Loading library...</p>
    </div>
  );
}

// Main page export with Suspense boundary
export default function LibraryPage() {
  return (
    <>
      <Header />
      <main className={styles.container}>
        <Suspense fallback={<LibraryLoading />}>
          <LibraryContent />
        </Suspense>
      </main>
    </>
  );
}
