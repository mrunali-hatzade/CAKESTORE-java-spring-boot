'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser, LoginRequest, LoginResponse, UserRole } from '@/types/auth';
import { authApi } from '@/lib/api/auth';
import { setStoredToken, clearStoredToken, getStoredToken } from '@/lib/api/client';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<LoginResponse>;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedToken = getStoredToken();
      const storedUserStr = localStorage.getItem('cakestore_user');
      if (storedToken && storedUserStr) {
        setToken(storedToken);
        setUser(JSON.parse(storedUserStr));
      }
    } catch {
      clearStoredToken();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
    const res = await authApi.login(credentials);
    setStoredToken(res.token);
    const authUser: AuthUser = {
      id: res.id,
      email: res.email,
      role: res.role,
      shopId: res.shopId,
      fullName: res.fullName,
    };
    localStorage.setItem('cakestore_user', JSON.stringify(authUser));
    setToken(res.token);
    setUser(authUser);
    return res;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors if network is down or session is already invalid
    } finally {
      clearStoredToken();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cakestore_user');
      }
      setToken(null);
      setUser(null);
    }
  };

  const hasRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
