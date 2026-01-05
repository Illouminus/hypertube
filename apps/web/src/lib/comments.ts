import { api } from './api';

// Types matching API responses
export interface CommentUser {
  id: string;
  username: string;
}

export interface CommentItem {
  id: string;
  body: string;
  createdAt: string;
  user: CommentUser;
  isOwner: boolean;
}

export interface PaginatedComments {
  items: CommentItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * List comments for a movie with pagination
 */
export async function listComments(
  movieId: string,
  page = 1,
  pageSize = 20,
): Promise<PaginatedComments> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });
  return api.get<PaginatedComments>(
    `/movies/${movieId}/comments?${params.toString()}`,
  );
}

/**
 * Create a new comment on a movie
 */
export async function createComment(
  movieId: string,
  body: string,
): Promise<CommentItem> {
  return api.post<CommentItem>(`/movies/${movieId}/comments`, { body });
}

/**
 * Delete a comment (owner only)
 */
export async function deleteComment(commentId: string): Promise<void> {
  await api.delete(`/comments/${commentId}`);
}
