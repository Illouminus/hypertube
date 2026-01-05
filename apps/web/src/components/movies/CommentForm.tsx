'use client';

import { useState, FormEvent } from 'react';
import styles from './CommentForm.module.css';

interface CommentFormProps {
  onSubmit: (body: string) => Promise<void>;
  isSubmitting: boolean;
}

const MAX_LENGTH = 2000;

export function CommentForm({ onSubmit, isSubmitting }: CommentFormProps) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const charCount = body.length;
  const isOverLimit = charCount > MAX_LENGTH;
  const isNearLimit = charCount > MAX_LENGTH * 0.9;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const trimmed = body.trim();
    if (!trimmed) {
      setError('Please enter a comment');
      return;
    }

    if (trimmed.length > MAX_LENGTH) {
      setError(`Comment must be at most ${MAX_LENGTH} characters`);
      return;
    }

    setError(null);
    try {
      await onSubmit(trimmed);
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    }
  };

  const charCountClass = isOverLimit
    ? styles.charCountError
    : isNearLimit
      ? styles.charCountWarning
      : '';

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <textarea
        className={styles.textarea}
        placeholder="Write a comment..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={isSubmitting}
      />
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.footer}>
        <span className={`${styles.charCount} ${charCountClass}`}>
          {charCount}/{MAX_LENGTH}
        </span>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={isSubmitting || !body.trim() || isOverLimit}
        >
          {isSubmitting ? 'Posting...' : 'Post Comment'}
        </button>
      </div>
    </form>
  );
}
