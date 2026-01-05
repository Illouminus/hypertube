'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  listComments,
  createComment,
  deleteComment,
  type CommentItem as CommentItemType,
} from '@/lib/comments';
import { AuthExpiredError } from '@/lib/api';
import { clearTokens } from '@/lib/auth';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import { Spinner } from '@/components/ui';
import styles from './CommentsSection.module.css';

interface CommentsSectionProps {
  movieId: string;
}

export function CommentsSection({ movieId }: CommentsSectionProps) {
  const router = useRouter();
  const [comments, setComments] = useState<CommentItemType[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Handle auth expired error
  const handleAuthExpired = useCallback(() => {
    clearTokens();
    router.push(`/login?redirect=/movies/${movieId}`);
  }, [router, movieId]);

  // Fetch comments
  const fetchComments = useCallback(
    async (pageNum: number, append = false) => {
      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
          setError(null);
        }

        const result = await listComments(movieId, pageNum, 20);

        if (append) {
          setComments((prev) => [...prev, ...result.items]);
        } else {
          setComments(result.items);
        }

        setHasMore(result.hasMore);
        setPage(pageNum);
      } catch (err) {
        if (err instanceof AuthExpiredError) {
          handleAuthExpired();
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load comments');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [movieId, handleAuthExpired],
  );

  // Initial load
  useEffect(() => {
    fetchComments(1);
  }, [fetchComments]);

  // Infinite scroll
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
        fetchComments(page + 1, true);
      }
    },
    [hasMore, isLoadingMore, isLoading, fetchComments, page],
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

  // Create comment
  const handleCreate = async (body: string) => {
    setIsSubmitting(true);
    try {
      const newComment = await createComment(movieId, body);
      // Prepend the new comment to the list
      setComments((prev) => [newComment, ...prev]);
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        handleAuthExpired();
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete comment
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        handleAuthExpired();
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRetry = () => {
    fetchComments(1);
  };

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>Comments</h2>
        {comments.length > 0 && (
          <span className={styles.count}>{comments.length}</span>
        )}
      </div>

      <CommentForm onSubmit={handleCreate} isSubmitting={isSubmitting} />

      {/* Loading state */}
      {isLoading && comments.length === 0 && (
        <div className={styles.loadMoreTrigger}>
          <Spinner size="medium" />
        </div>
      )}

      {/* Error state */}
      {error && comments.length === 0 && !isLoading && (
        <div className={styles.errorState}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.retryButton} onClick={handleRetry}>
            Try Again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && comments.length === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>💬</span>
          <p className={styles.emptyText}>
            No comments yet. Be the first to share your thoughts!
          </p>
        </div>
      )}

      {/* Comments list */}
      {comments.length > 0 && (
        <div className={styles.list}>
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onDelete={handleDelete}
              isDeleting={deletingId === comment.id}
            />
          ))}
        </div>
      )}

      {/* Infinite scroll trigger */}
      <div ref={loadMoreRef} className={styles.loadMoreTrigger}>
        {isLoadingMore && <Spinner size="small" />}
      </div>

      {/* Inline error if we have comments */}
      {error && comments.length > 0 && (
        <div className={styles.errorState}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.retryButton} onClick={handleRetry}>
            Try Again
          </button>
        </div>
      )}
    </section>
  );
}
