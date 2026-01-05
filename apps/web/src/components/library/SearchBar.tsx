'use client';

import { useState, FormEvent } from 'react';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onClear: () => void;
  isSearching: boolean;
  initialQuery?: string;
}

export function SearchBar({
  onSearch,
  onClear,
  isSearching,
  initialQuery = '',
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      onSearch(trimmed);
    }
  };

  const handleClear = () => {
    setQuery('');
    onClear();
  };

  return (
    <form className={styles.searchBar} onSubmit={handleSubmit}>
      <input
        type="text"
        className={styles.searchInput}
        placeholder="Search movies..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={isSearching}
      />
      <button
        type="submit"
        className={styles.searchButton}
        disabled={isSearching || !query.trim()}
      >
        {isSearching ? 'Searching...' : 'Search'}
      </button>
      {initialQuery && (
        <button
          type="button"
          className={styles.clearButton}
          onClick={handleClear}
          disabled={isSearching}
        >
          Clear
        </button>
      )}
    </form>
  );
}
