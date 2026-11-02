'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoadingState } from '@/components/ui/LoadingState';

/**
 * Dashboard Router
 *
 * Gracefully directs users accessing /dashboard to their respective portal:
 * - Admin users -> /admin
 * - Bakery owners -> /dashboard/owner
 * - Unauthenticated users -> /login
 */
export default function DashboardIndexPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login');
    } else if (user?.role === 'ROLE_ADMIN' || (user?.role as string) === 'ADMIN') {
      router.replace('/admin');
    } else {
      router.replace('/dashboard/owner');
    }
  }, [isLoading, isAuthenticated, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-cream-light">
      <LoadingState message="Redirecting to your dashboard..." />
    </div>
  );
}

