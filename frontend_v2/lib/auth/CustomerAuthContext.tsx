'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ordersApi, OtpDeliveryResponse } from '@/lib/api/orders';

// ─────────────────────────────────────────────────
// Customer Authentication Context
// ─────────────────────────────────────────────────
// Manages passwordless CUSTOMER authentication state.
// Separate from the owner/admin AuthContext intentionally:
//   - Customers authenticate via Phone → OTP → JWT
//   - Owners/Admins authenticate via Email/Password → JWT
//   - Customer tokens live in sessionStorage (session-scoped)
//   - Owner tokens live in localStorage (persistent)
// ─────────────────────────────────────────────────

const CUSTOMER_TOKEN_KEY = 'cakeStoreGuestToken';
const CUSTOMER_PHONE_KEY = 'cakeStoreGuestPhone';

interface CustomerAuthState {
  /** Whether the customer has been authenticated via OTP */
  isAuthenticated: boolean;
  /** The verified phone number (10-digit, no prefix) */
  phone: string | null;
  /** The JWT token from the backend */
  token: string | null;
  /** Whether auth state is still loading from storage */
  isLoading: boolean;
}

interface CustomerAuthContextType extends CustomerAuthState {
  /** Request an OTP for the given phone number with optional email fallback */
  requestOtp: (phone: string, email?: string) => Promise<OtpDeliveryResponse>;
  /** Verify an OTP and establish an authenticated session */
  verifyOtp: (phone: string, otp: string) => Promise<string>;
  /** Clear the customer session */
  logout: () => void;
  /** Get the stored customer token (for API calls) */
  getToken: () => string | null;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

function normalizePhone(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.substring(1);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  return digits;
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CustomerAuthState>({
    isAuthenticated: false,
    phone: null,
    token: null,
    isLoading: true,
  });

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    try {
      const savedToken = sessionStorage.getItem(CUSTOMER_TOKEN_KEY);
      const savedPhone = sessionStorage.getItem(CUSTOMER_PHONE_KEY);
      if (savedToken && savedPhone) {
        setState({
          isAuthenticated: true,
          phone: normalizePhone(savedPhone),
          token: savedToken,
          isLoading: false,
        });
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const requestOtp = useCallback(async (phone: string, email?: string): Promise<OtpDeliveryResponse> => {
    const cleanPhone = normalizePhone(phone);
    return await ordersApi.requestTrackingOtp(cleanPhone, email);
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string): Promise<string> => {
    const cleanPhone = normalizePhone(phone);
    const res = await ordersApi.verifyTrackingOtp(cleanPhone, otp);
    const token = res.token;

    // Persist in sessionStorage (session-scoped, not cross-tab)
    sessionStorage.setItem(CUSTOMER_TOKEN_KEY, token);
    sessionStorage.setItem(CUSTOMER_PHONE_KEY, cleanPhone);

    setState({
      isAuthenticated: true,
      phone: cleanPhone,
      token,
      isLoading: false,
    });

    return token;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(CUSTOMER_TOKEN_KEY);
    sessionStorage.removeItem(CUSTOMER_PHONE_KEY);
    setState({
      isAuthenticated: false,
      phone: null,
      token: null,
      isLoading: false,
    });
  }, []);

  const getToken = useCallback((): string | null => {
    return sessionStorage.getItem(CUSTOMER_TOKEN_KEY);
  }, []);

  return (
    <CustomerAuthContext.Provider
      value={{
        ...state,
        requestOtp,
        verifyOtp,
        logout,
        getToken,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
}
