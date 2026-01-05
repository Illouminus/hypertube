/**
 * Comment types for API responses
 */

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
