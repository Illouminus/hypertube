'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { MovieDetails as MovieDetailsType } from '@/lib/movies';
import styles from './MovieDetails.module.css';

interface MovieDetailsProps {
  movie: MovieDetailsType;
}

export function MovieDetails({ movie }: MovieDetailsProps) {
  const genres = movie.genre?.split(', ') || [];

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
          <button className={styles.playButton} disabled>
            <span className={styles.playIcon}>▶</span>
            Streaming coming next stage
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

          {/* Sources/Providers */}
          {movie.sources && movie.sources.length > 0 && (
            <div className={styles.sourcesSection}>
              <h3 className={styles.sourcesTitle}>Available Sources</h3>
              <div className={styles.sourcesList}>
                {movie.sources.map((source, index) => (
                  <div key={index} className={styles.sourceItem}>
                    <span className={styles.sourceProvider}>
                      {source.provider.replace('catalog', 'Source ')}
                    </span>
                    <div className={styles.sourceInfo}>
                      {source.size && <span>{source.size}</span>}
                      {source.seeders !== undefined && (
                        <span className={styles.sourceSeeders}>
                          ↑ {source.seeders}
                        </span>
                      )}
                      {source.leechers !== undefined && (
                        <span className={styles.sourceLeechers}>
                          ↓ {source.leechers}
                        </span>
                      )}
                      {source.language && <span>{source.language}</span>}
                    </div>
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
