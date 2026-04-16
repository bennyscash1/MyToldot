import { apiClient } from './api.client';

// ──────────────────────────────────────────────
// Auth Service
//
// Wraps the three auth API routes.
// UI components and hooks must use this — never
// call the auth API routes directly.
// ──────────────────────────────────────────────

export interface UserDto {
  id:         string;
  email:      string | undefined;
  full_name:  string | null;
}

interface LoginResult   { user: UserDto }
interface SignupResult  { user: UserDto }

export const authService = {
  /**
   * Authenticate with email + password.
   * Supabase sets HttpOnly session cookies on the response.
   */
  login: (email: string, password: string) =>
    apiClient.post<LoginResult>('/api/v1/auth/login', { email, password }),

  /**
   * Create a new account.
   * Also mirrors the user into our public `users` table.
   */
  signup: (email: string, password: string, full_name: string) =>
    apiClient.post<SignupResult>('/api/v1/auth/signup', { email, password, full_name }),

  /**
   * Sign out the current user — clears Supabase session cookies.
   */
  logout: () =>
    apiClient.post<null>('/api/v1/auth/logout', {}),
};
