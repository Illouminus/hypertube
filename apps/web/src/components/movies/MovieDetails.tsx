'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { MovieDetails as MovieDetailsType, MovieSource } from '@/lib/movies';
import { markMovieWatched, markMovieUnwatched } from '@/lib/movies';
import styles from './MovieDetails.module.css';

interface MovieDetailsProps {
  movie: MovieDetailsType;
}

export function MovieDetails({ movie }: MovieDetailsProps) {
  const genres = movie.genre?.split(', ') || [];
  const [isWatched, setIsWatched] = useState(movie.isWatched ?? false);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggleWatched = useCallback(async () => {
    try {
      setIsToggling(true);
      if (isWatched) {
        await markMovieUnwatched(movie.id);
        setIsWatched(false);
      } else {
        await markMovieWatched(movie.id);
        setIsWatched(true);
      }
    } catch (error) {
      console.error('Failed to toggle watched status:', error);
    } finally {
      setIsToggling(false);
    }
  }, [movie.id, isWatched]);

  const handleDownload = useCallback((source: MovieSource) => {
    const url = source.magnet || source.torrentUrl;
    if (url) {
      window.open(url, '_blank');
    }
  }, []);

  const watchedButtonClass = isWatched
    ? `${styles.watchedButton} ${styles.watchedButtonActive}`
    : styles.watchedButton;

  // Format provider name for display
  const formatProvider = (provider: string) => {
    if (provider === 'yts') return 'YTS';
    if (provider === 'archive') return 'Archive.org';
    return provider;
  };

  return (
    <div className={styles.container}>
      <Link href="/library" className={styles.backLink}>
        <span className={styles.backArrow}>←</span>
        Back to Library
      </Link>

      <div className={styles.content}>
        {/* Poster section */}
        <div className={styles.posterSection}>
          <div className={styles.posterContainer}>
            {movie.posterUrl ? (
              <Image
                src={movie.posterUrl}
                alt={movie.title}
                fill
                sizes="280px"
                className={styles.poster}
                priority
              />
            ) : (
              <div className={styles.posterPlaceholder}>🎬</div>
            )}
          </div>

          <button
            className={watchedButtonClass}
            onClick={handleToggleWatched}
            disabled={isToggling}
          >
            <span className={styles.watchedIcon}>
              {isWatched ? '✓' : '○'}
            </span>
            {isToggling
              ? 'Updating...'
              : isWatched
                ? 'Marked as Watched'
                : 'Mark as Watched'}
          </button>
        </div>

        {/* Info section */}
        <div className={styles.infoSection}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{movie.title}</h1>
            {movie.year && <span className={styles.year}>({movie.year})</span>}
          </div>

          <div className={styles.metaRow}>
            {movie.imdbRating && (
              <div className={styles.rating}>
                <span className={styles.ratingStar}>⭐</span>
                {movie.imdbRating}/10
              </div>
            )}
            {movie.runtime && (
              <span className={styles.runtime}>{movie.runtime}</span>
            )}
          </div>

          {genres.length > 0 && (
            <div className={styles.genres}>
              {genres.map((genre) => (
                <span key={genre} className={styles.genre}>
                  {genre}
                </span>
              ))}
            </div>
          )}

          {movie.plot && <p className={styles.plot}>{movie.plot}</p>}

          <div className={styles.credits}>
            {movie.director && (
              <div className={styles.creditRow}>
                <span className={styles.creditLabel}>Director</span>
                <span className={styles.creditValue}>{movie.director}</span>
              </div>
            )}
            {movie.actors && (
              <div className={styles.creditRow}>
                <span className={styles.creditLabel}>Cast</span>
                <span className={styles.creditValue}>{movie.actors}</span>
              </div>
            )}
          </div>

          {/* Download Sources */}
          {movie.sources && movie.sources.length > 0 && (
            <div className={styles.sourcesSection}>
              <h3 className={styles.sourcesTitle}>Download Options</h3>
              <div className={styles.sourcesList}>
                {movie.sources.map((source, index) => (
                  <div key={index} className={styles.sourceItem}>
                    <div className={styles.sourceMain}>
                      <span className={styles.sourceProvider}>
                        {formatProvider(source.provider)}
                      </span>
                      {source.quality && (
                        <span className={styles.sourceQuality}>{source.quality}</span>
                      )}
                      {source.size && (
                        <span className={styles.sourceSize}>{source.size}</span>
                      )}
                    </div>
                    <div className={styles.sourceStats}>
                      {source.seeders !== undefined && source.seeders > 0 && (
                        <span className={styles.sourceSeeders}>
                          ↑ {source.seeders}
                        </span>
                      )}
                      {source.leechers !== undefined && source.leechers > 0 && (
                        <span className={styles.sourceLeechers}>
                          ↓ {source.leechers}
                        </span>
                      )}
                    </div>
                    <button
                      className={styles.downloadButton}
                      onClick={() => handleDownload(source)}
                      disabled={!source.magnet && !source.torrentUrl}
                    >
                      {source.magnet ? '📥 Magnet' : '📦 Torrent'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
