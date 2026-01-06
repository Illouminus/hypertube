'use client';

import { useState, useCallback, useEffect } from 'react';
import styles from './FiltersBar.module.css';

export type SortOption = 'name-asc' | 'name-desc' | 'year-asc' | 'year-desc' | 'rating-desc' | 'rating-asc';

export interface FilterState {
    sort: SortOption;
    yearMin?: number;
    yearMax?: number;
}

interface FiltersBarProps {
    filters: FilterState;
    onFiltersChange: (filters: FilterState) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'name-asc', label: 'Name A–Z' },
    { value: 'name-desc', label: 'Name Z–A' },
    { value: 'year-desc', label: 'Year (Newest)' },
    { value: 'year-asc', label: 'Year (Oldest)' },
    { value: 'rating-desc', label: 'Rating (High)' },
    { value: 'rating-asc', label: 'Rating (Low)' },
];

export function FiltersBar({ filters, onFiltersChange }: FiltersBarProps) {
    const [yearMinInput, setYearMinInput] = useState(filters.yearMin?.toString() ?? '');
    const [yearMaxInput, setYearMaxInput] = useState(filters.yearMax?.toString() ?? '');

    // Sync inputs when filters change externally
    useEffect(() => {
        setYearMinInput(filters.yearMin?.toString() ?? '');
        setYearMaxInput(filters.yearMax?.toString() ?? '');
    }, [filters.yearMin, filters.yearMax]);

    const handleSortChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            onFiltersChange({
                ...filters,
                sort: e.target.value as SortOption,
            });
        },
        [filters, onFiltersChange],
    );

    const handleYearMinBlur = useCallback(() => {
        const value = yearMinInput ? parseInt(yearMinInput, 10) : undefined;
        if (value !== filters.yearMin) {
            onFiltersChange({
                ...filters,
                yearMin: value && !isNaN(value) ? value : undefined,
            });
        }
    }, [yearMinInput, filters, onFiltersChange]);

    const handleYearMaxBlur = useCallback(() => {
        const value = yearMaxInput ? parseInt(yearMaxInput, 10) : undefined;
        if (value !== filters.yearMax) {
            onFiltersChange({
                ...filters,
                yearMax: value && !isNaN(value) ? value : undefined,
            });
        }
    }, [yearMaxInput, filters, onFiltersChange]);

    const handleYearKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
            }
        },
        [],
    );

    const handleClearFilters = useCallback(() => {
        onFiltersChange({
            sort: 'name-asc',
            yearMin: undefined,
            yearMax: undefined,
        });
    }, [onFiltersChange]);

    const hasActiveFilters =
        filters.sort !== 'name-asc' ||
        filters.yearMin !== undefined ||
        filters.yearMax !== undefined;

    return (
        <div className={styles.filtersBar}>
            <div className={styles.filterGroup}>
                <label className={styles.filterLabel} htmlFor="sort-select">
                    Sort by
                </label>
                <select
                    id="sort-select"
                    className={styles.select}
                    value={filters.sort}
                    onChange={handleSortChange}
                >
                    {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Year</label>
                <input
                    type="number"
                    className={styles.input}
                    placeholder="From"
                    min={1880}
                    max={2030}
                    value={yearMinInput}
                    onChange={(e) => setYearMinInput(e.target.value)}
                    onBlur={handleYearMinBlur}
                    onKeyDown={handleYearKeyDown}
                />
                <span className={styles.yearSeparator}>–</span>
                <input
                    type="number"
                    className={styles.input}
                    placeholder="To"
                    min={1880}
                    max={2030}
                    value={yearMaxInput}
                    onChange={(e) => setYearMaxInput(e.target.value)}
                    onBlur={handleYearMaxBlur}
                    onKeyDown={handleYearKeyDown}
                />
            </div>

            {hasActiveFilters && (
                <button
                    type="button"
                    className={styles.clearButton}
                    onClick={handleClearFilters}
                >
                    Clear filters
                </button>
            )}
        </div>
    );
}
