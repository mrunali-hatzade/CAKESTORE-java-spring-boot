'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, ChevronRight, KeyRound, Smartphone, AlertTriangle } from 'lucide-react';
import { AdminPasswordChangeCard } from '@/components/admin/AdminPasswordChangeCard';
import { Card } from '@/components/ui/Card';

export default function AdminSecurityPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Breadcrumb & Header */}
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 font-medium" aria-label="Breadcrumb">
          <Link href="/admin" className="hover:text-indigo-600 transition-colors">
            Admin
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-800">Security & Credentials</span>
        </nav>
        <h1 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 tracking-tight">
          Admin Security & Credentials
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage your platform administrator password and review account-level security safeguards.
        </p>
      </div>

      {/* Main Password Change Component */}
      <AdminPasswordChangeCard />

      {/* Security Information Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 border-slate-200 bg-white rounded-2xl shadow-soft">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-slate-900">Session Invalidation Policy</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Whenever an administrator updates their password, the backend increments the account&apos;s authoritative <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] text-slate-800">token_version</code> and stamps <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] text-slate-800">tokens_invalidated_before</code>. All existing access tokens are instantly rejected.
          </p>
        </Card>

        <Card className="p-6 border-slate-200 bg-white rounded-2xl shadow-soft">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-slate-900">Credential Hygiene</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Ensure your administrator password uses a combination of uppercase and lowercase letters, numbers, and special characters. Never reuse credentials from personal accounts or store administrative passwords in shared documents.
          </p>
        </Card>
      </div>
    </div>
  );
}

