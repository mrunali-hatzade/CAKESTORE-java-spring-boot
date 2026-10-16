/**
 * Centralized CakeStore API Client
 * Connects to Spring Boot Backend on http://localhost:8080
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  token?: string | null;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('cakestore_token');
}

export function setStoredToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('cakestore_token', token);
  }
}

export function clearStoredToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('cakestore_token');
    localStorage.removeItem('cakestore_user');
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, token, headers = {}, ...rest } = options;

  let url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const reqHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };

  if (!(rest.body instanceof FormData) && !reqHeaders['Content-Type']) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  const hasExplicitAuthHeader = Boolean(reqHeaders['Authorization'] || reqHeaders['authorization']);

  if (!hasExplicitAuthHeader) {
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    } else if (token === undefined) {
      const isCustomerOrStorefrontEndpoint =
        endpoint.startsWith('/api/customer/') ||
        endpoint.startsWith('/api/storefront/');

      if (!isCustomerOrStorefrontEndpoint) {
        const storedToken = getStoredToken();
        if (storedToken) {
          reqHeaders['Authorization'] = `Bearer ${storedToken}`;
        }
      } else {
        if (typeof window !== 'undefined') {
          const guestToken = sessionStorage.getItem('cakeStoreGuestToken');
          if (guestToken) {
            reqHeaders['Authorization'] = `Bearer ${guestToken}`;
          }
        }
      }
    }
    // If token === null, explicitly unauthenticated
  }

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      ...rest,
      headers: reqHeaders,
      signal: rest.signal || AbortSignal.timeout(30000),
    });

    if (response.status === 204) {
      return {} as T;
    }

    let responseData: any = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = text;
      }
    }

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      if (typeof responseData === 'object' && responseData !== null) {
        if (Array.isArray(responseData.errors) && responseData.errors.length > 0) {
          errorMessage = responseData.errors
            .map((e: any) => e.defaultMessage || e.message || String(e))
            .join(', ');
        } else if (responseData.message) {
          errorMessage = responseData.message;
        } else if (responseData.error && responseData.error !== 'Bad Request') {
          errorMessage = responseData.error;
        }
      } else if (typeof responseData === 'string' && responseData.trim().length > 0) {
        errorMessage = responseData;
      }

      if (response.status === 500) {
        if (typeof window !== 'undefined') {
          console.error('Internal Server Error');
        }
      }

      // Removed aggressive auto-logout and redirect on 401 per user request
      if (response.status === 401) {
        // Just pass the error back without forcing a redirect
        console.warn('API returned 401 Unauthorized for', endpoint);
      }

      throw new ApiError(response.status, errorMessage, responseData);
    }

    return responseData as T;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, error.message || 'Network request failed', error);
  }
}

export const apiClient = {
  // cache: 'no-store' ensures the browser never serves a stale cached response.
  // This is critical so that owner dashboard changes (delivery config, about info, etc.)
  // are always reflected immediately when the customer refreshes the storefront page.
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET', cache: 'no-store' }),

  post: <T>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  patch: <T>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
