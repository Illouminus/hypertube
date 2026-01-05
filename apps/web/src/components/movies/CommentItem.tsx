'use client';

import type { CommentItem as CommentItemType } from '@/lib/comments';
import styles from './CommentItem.module.css';

interface CommentItemProps {
  comment: CommentItemType;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

export function CommentItem({ comment, onDelete, isDeleting }: CommentItemProps) {
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      onDelete(comment.id);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitial = (username: string) => {
    return username.charAt(0).toUpperCase();
  };

  return (
    <div className={styles.item}>
      <div className={styles.avatar}>{getInitial(comment.user.username)}</div>
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.username}>{comment.user.username}</span>
            {comment.isOwner && (
              <span className={styles.ownerBadge}>You</span>
            )}
            <span className={styles.date}>{formatDate(comment.createdAt)}</span>
          </div>
          {comment.isOwner && (
            <button
              className={styles.deleteButton}
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
        <p className={styles.body}>{comment.body}</p>
      </div>
    </div>
  );
}
