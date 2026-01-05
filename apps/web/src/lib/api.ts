import { config } from '@/config/env';

// API error response type
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// Check if response is an API error
export function isApiError(data: unknown): data is ApiError {
  return (
    typeof data === 'object' &&
    data !== null &&
    'statusCode' in data &&
    'message' in data
  );
}

// Custom error class for API errors
export class ApiRequestError extends Error {
  public statusCode: number;
  public messages: string[];

  constructor(error: ApiError) {
    const messages = Array.isArray(error.message)
      ? error.message
      : [error.message];
    super(messages[0]);
    this.name = 'ApiRequestError';
    this.statusCode = error.statusCode;
    this.messages = messages;
  }
}

// Generic fetch wrapper
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${config.apiUrl}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add auth token if available
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle empty responses (e.g., 204 No Content)
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    if (isApiError(data)) {
      throw new ApiRequestError(data);
    }
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return data as T;
}

// Convenience methods
export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),
};
