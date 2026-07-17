/**
 * Provider-agnostic credential storage
 * Manages reading, writing, and removing user credentials
 * 
 * Current implementation: API keys in localStorage
 * Future implementations: Clerk, Auth.js, database sessions, etc.
 */

const CREDENTIAL_KEY = 'auth_credential';

/**
 * Retrieve user credential from localStorage
 * Returns null if no credential is stored
 */
export function getUserCredential(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(CREDENTIAL_KEY);
}

/**
 * Store user credential in localStorage
 * Called after user logs in or provides API key
 */
export function setUserCredential(credential: string): void {
  if (typeof window === 'undefined') {
    throw new Error('setUserCredential can only be called in browser');
  }
  localStorage.setItem(CREDENTIAL_KEY, credential);
}

/**
 * Update existing credential
 * Useful for refreshing tokens or changing keys
 */
export function updateUserCredential(credential: string): void {
  if (typeof window === 'undefined') {
    throw new Error('updateUserCredential can only be called in browser');
  }
  localStorage.setItem(CREDENTIAL_KEY, credential);
}

/**
 * Remove stored credential
 * Called on logout
 */
export function clearUserCredential(): void {
  if (typeof window === 'undefined') {
    throw new Error('clearUserCredential can only be called in browser');
  }
  localStorage.removeItem(CREDENTIAL_KEY);
}

/**
 * Check if credential exists
 */
export function hasUserCredential(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return localStorage.getItem(CREDENTIAL_KEY) !== null;
}
