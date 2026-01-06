import { config } from '@/config/env';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './tokens';

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

// Custom error for expired authentication (refresh failed)
export class AuthExpiredError extends Error {
  constructor(message = 'Session expired. Please sign in again.') {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

// Endpoints that should NOT trigger refresh-retry on 401
// (they handle auth themselves or are the refresh endpoint)
const NO_REFRESH_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
];

/**
 * Check if endpoint should skip refresh-retry logic on 401
 */
function shouldSkipRefresh(endpoint: string): boolean {
  return NO_REFRESH_ENDPOINTS.some(
    (path) => endpoint === path || endpoint.startsWith(`${path}?`)
  );
}

// Shared refresh promise to prevent refresh storms
let refreshPromise: Promise<string> | null = null;

/**
 * Attempt to refresh tokens. Uses a shared promise so concurrent
 * 401 responses only trigger one refresh request.
 * Returns the new access token on success.
 */
async function doRefreshTokens(): Promise<string> {
  // If a refresh is already in progress, wait for it
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    throw new AuthExpiredError('No refresh token available');
  }

  // Create the refresh promise
  refreshPromise = (async () => {
    try {
      const url = `${config.apiUrl}/auth/refresh`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        clearTokens();
        throw new AuthExpiredError('Failed to refresh session');
      }

      // API returns { accessToken, refreshToken }
      const newAccessToken = data.accessToken;
      const newRefreshToken = data.refreshToken;

      if (!newAccessToken || !newRefreshToken) {
        clearTokens();
        throw new AuthExpiredError('Invalid refresh response');
      }

      setTokens(newAccessToken, newRefreshToken);
      return newAccessToken;
    } finally {
      // Clear the shared promise so future refreshes can happen
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Execute a fetch request with the given access token
 */
async function executeRequest(
  url: string,
  options: RequestInit,
  accessToken: string | null,
): Promise<{ response: Response; data: unknown }> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  return { response, data };
}

// Generic fetch wrapper with automatic token refresh
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  _isRetry = false,
): Promise<T> {
  const url = `${config.apiUrl}${endpoint}`;
  const accessToken = getAccessToken();

  const { response, data } = await executeRequest(url, options, accessToken);

  // Handle 401 Unauthorized - attempt token refresh (only once)
  if (response.status === 401 && !_isRetry) {
    // Skip refresh for specific auth endpoints (login, register, refresh, logout)
    // Note: /auth/me SHOULD trigger refresh since it's a protected endpoint
    if (shouldSkipRefresh(endpoint)) {
      // Don't try to refresh for these endpoints - just throw the error
      if (isApiError(data)) {
        throw new ApiRequestError(data);
      }
      throw new Error(`API request failed: ${response.statusText}`);
    }

    try {
      // Attempt to refresh tokens
      await doRefreshTokens();
      // Retry the original request with the new token (mark as retry to prevent loops)
      return apiFetch<T>(endpoint, options, true);
    } catch (err) {
      // Refresh failed - throw AuthExpiredError
      if (err instanceof AuthExpiredError) {
        throw err;
      }
      throw new AuthExpiredError('Session expired. Please sign in again.');
    }
  }

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

  patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),
};
