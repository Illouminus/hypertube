import { api } from './api';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  hasAccessToken,
} from './tokens';

// Re-export token utilities for convenience
export { getAccessToken, getRefreshToken, clearTokens, hasAccessToken };

// Supported languages
export const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'de', 'ru'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
  ru: 'Русский',
};

// Types matching API responses
export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  language: SupportedLanguage;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// Public user profile (no email)
export interface PublicUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  language: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RegisterData {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface UpdateProfileData {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  language?: SupportedLanguage;
  avatarUrl?: string | null;
}

/**
 * Store tokens in localStorage (wrapper for convenience)
 */
export function storeTokens(tokens: AuthTokens): void {
  setTokens(tokens.accessToken, tokens.refreshToken);
}

/**
 * Check if user is authenticated (has access token)
 */
export function isAuthenticated(): boolean {
  return hasAccessToken();
}

/**
 * Register a new user
 */
export async function register(data: RegisterData): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/register', data);
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
 * Get current user's profile
 */
export async function getProfile(): Promise<User> {
  return api.get<User>('/users/me');
}

/**
 * Update current user's profile
 */
export async function updateProfile(data: UpdateProfileData): Promise<User> {
  return api.patch<User>('/users/me', data);
}

/**
 * Get public user profile by ID
 */
export async function getPublicProfile(userId: string): Promise<PublicUser> {
  return api.get<PublicUser>(`/users/${userId}`);
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
