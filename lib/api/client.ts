/**
 * Centralized API client with typed methods
 * 
 * Automatically attaches authentication credential to all requests
 * Centralizes error handling for 401/403 responses
 * Provides consistent interface for GET/POST/PUT/PATCH/DELETE operations
 */

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static isUnauthorized(error: unknown): boolean {
    return error instanceof ApiError && error.statusCode === 401;
  }

  static isForbidden(error: unknown): boolean {
    return error instanceof ApiError && error.statusCode === 403;
  }
}

interface ApiClientOptions extends Omit<RequestInit, 'headers' | 'body'> {
  headers?: Record<string, string>;
}

/**
 * Typed API client that automatically attaches credential
 * 
 * Usage:
 *   const client = new ApiClient(userCredential);
 *   const data = await client.get<UserData>('/api/user');
 *   await client.post('/api/data', { foo: 'bar' });
 */
export class ApiClient {
  private credential: string | undefined;
  private baseUrl: string;

  constructor(credential?: string, baseUrl: string = '') {
    this.credential = credential;
    this.baseUrl = baseUrl;
  }

  /**
   * GET request
   */
  async get<T = unknown>(
    endpoint: string,
    options?: ApiClientOptions
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: ApiClientOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: ApiClientOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: ApiClientOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(
    endpoint: string,
    options?: ApiClientOptions
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Core request method with credential attachment and error handling
   */
  private async request<T = unknown>(
    endpoint: string,
    options: RequestInit & { headers?: Record<string, string> } = {}
  ): Promise<T> {
    let url = `${this.baseUrl}${endpoint}`;
    
    // In Server Components (Node.js runtime), relative URLs fail with fetch()
    // Detect this and convert to absolute URL
    if (typeof window === 'undefined' && !url.startsWith('http')) {
      // Node.js environment - prepend origin
      const origin = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000';
      url = `${origin}${url}`;
    }
    
    const headers = new Headers(options.headers);

    // Attach credential if present
    if (this.credential) {
      headers.set('x-api-key', this.credential);
    }

    // Ensure content-type is set for JSON requests
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle successful response
      if (response.ok) {
        // Handle empty responses (204 No Content)
        if (response.status === 204) {
          return undefined as unknown as T;
        }
        return response.json() as Promise<T>;
      }

      // Parse error response
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: response.statusText };
      }

      // Throw typed error
      throw new ApiError(
        response.status,
        this.getErrorMessage(response.status, errorData),
        errorData
      );
    } catch (error) {
      // Re-throw ApiError as-is
      if (error instanceof ApiError) {
        throw error;
      }

      // Wrap network errors
      throw new ApiError(
        0,
        error instanceof Error ? error.message : 'Network request failed',
        error
      );
    }
  }

  /**
   * Extract user-friendly error message from response
   */
  private getErrorMessage(status: number, data: unknown): string {
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      if (typeof obj.error === 'string') {
        return obj.error;
      }
      if (typeof obj.message === 'string') {
        return obj.message;
      }
    }

    // Default messages based on status code
    switch (status) {
      case 401:
        return 'Unauthorized - invalid or missing credentials';
      case 403:
        return 'Forbidden - insufficient permissions';
      case 404:
        return 'Not found';
      case 429:
        return 'Too many requests - rate limited';
      case 500:
        return 'Internal server error';
      default:
        return `Request failed with status ${status}`;
    }
  }
}
