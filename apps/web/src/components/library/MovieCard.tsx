'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { MovieListItem } from '@/lib/movies';
import styles from './MovieCard.module.css';

interface MovieCardProps {
  movie: MovieListItem;
}

export function MovieCard({ movie }: MovieCardProps) {
  return (
    <Link href={`/movies/${movie.id}`} className={styles.cardLink}>
      <article className={styles.card}>
        <div className={styles.posterContainer}>
          {movie.posterUrl ? (
            <Image
              src={movie.posterUrl}
              alt={movie.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className={styles.poster}
            />
          ) : (
            <div className={styles.posterPlaceholder}>🎬</div>
          )}
          {movie.imdbRating && (
            <div className={styles.rating}>
              <span className={styles.ratingStar}>⭐</span>
              {movie.imdbRating}
            </div>
          )}
        </div>
        <div className={styles.info}>
          <h3 className={styles.title}>{movie.title}</h3>
          <div className={styles.meta}>
            {movie.year && <span className={styles.year}>{movie.year}</span>}
            <div className={styles.providers}>
              {movie.providers.slice(0, 2).map((provider) => (
                <span key={provider} className={styles.providerBadge}>
                  {provider.replace('catalog', '')}
                </span>
              ))}
            </div>
          </div>
          {movie.genre && <span className={styles.genre}>{movie.genre}</span>}
        </div>
      </article>
    </Link>
  );
}
