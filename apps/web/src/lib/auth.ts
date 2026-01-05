import { api } from './api';

// Types matching API responses
export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// Token storage keys
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

/**
 * Store tokens in localStorage
 */
export function storeTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

/**
 * Clear tokens from localStorage
 */
export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Get stored access token
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Get stored refresh token
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Check if user is authenticated (has access token)
 */
export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

/**
 * Register a new user
 */
export async function register(
  email: string,
  username: string,
  password: string,
): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/register', {
    email,
    username,
    password,
  });
  storeTokens(response.tokens);
  return response;
}

/**
 * Login with email/username and password
 */
export async function login(
  emailOrUsername: string,
  password: string,
): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/login', {
    emailOrUsername,
    password,
  });
  storeTokens(response.tokens);
  return response;
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<User> {
  return api.get<User>('/auth/me');
}

/**
 * Refresh access token
 */
export async function refreshTokens(): Promise<AuthTokens> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const tokens = await api.post<AuthTokens>('/auth/refresh', { refreshToken });
  storeTokens(tokens);
  return tokens;
}

/**
 * Logout - clear tokens and revoke on server
 */
export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch (error) {
    // Ignore errors during logout, still clear local tokens
    console.warn('Logout API call failed:', error);
  } finally {
    clearTokens();
  }
}

/**
 * Request password reset email
 */
export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

/**
 * Reset password with token
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  await api.post('/auth/reset-password', { token, newPassword });
}

/**
 * Attempt to refresh tokens if access token is expired
 * Returns true if refresh was successful
 */
export async function tryRefreshToken(): Promise<boolean> {
  try {
    await refreshTokens();
    return true;
  } catch {
    clearTokens();
    return false;
  }
}
