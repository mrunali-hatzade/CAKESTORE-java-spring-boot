'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Cake, Lock, Mail, Phone, ArrowRight, Eye, EyeOff, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('password_changed') === 'true') {
        setInfoMessage('Your password was changed successfully. Please log in with your new credentials.');
      } else if (params.get('session_expired') === 'true') {
        setInfoMessage('Your session has expired or was revoked. Please log in again.');
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await login({ username: identifier.trim(), email: identifier.trim(), password });
      if (res.role === 'ROLE_ADMIN' || (res.role as string) === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/dashboard/owner');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please verify your mobile number/email and password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-brand-cream-light font-sans">
      {/* Left Showcase Panel (Visible on lg screens) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-brand-plum text-white flex-col justify-between p-12 overflow-hidden">
        {/* Background Image with Warm Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-30"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1600&q=80)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-plum via-brand-plum/85 to-brand-plum/70" />

        {/* Brand Top Header */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-soft group-hover:scale-105 transition-transform">
              <Cake className="w-6 h-6" />
            </div>
            <div>
              <span className="font-serif text-2xl font-bold tracking-tight text-white block leading-none">
                CakeStore
              </span>
              <span className="text-[11px] tracking-widest uppercase text-white/70 font-medium">
                Artisanal Bakery Network
              </span>
            </div>
          </Link>
        </div>

        {/* Value Proposition Hero */}
        <div className="relative z-10 my-auto space-y-6 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-brand-blush" />
            <span>Dedicated Portal for Bakery Owners</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white leading-tight">
            Your Bakery, <br />
            <span className="text-brand-blush italic">Digitally Empowered.</span>
          </h1>

          <p className="text-white/80 text-sm sm:text-base leading-relaxed">
            Manage your kitchen orders, publish artisanal cake menus, track deliveries, and accept direct customer payments with zero commission.
          </p>

          <div className="space-y-3 pt-2">
            {[
              '0% commission on orders — keep 100% of your earnings',
              'Real-time kitchen order ticketing & WhatsApp alerts',
              'Custom cake inquiry management & flexible delivery slots',
            ].map((perk, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-brand-blush/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-blush" />
                </div>
                <span className="text-xs sm:text-sm text-white/90 font-medium">{perk}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Social Proof Footer */}
        <div className="relative z-10 pt-6 border-t border-white/15 flex items-center justify-between text-xs text-white/70">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-blush" />
            <span>Secure 256-bit encrypted login</span>
          </div>
          <span>500+ Verified Home Bakers</span>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Brand Link */}
          <div className="lg:hidden text-center mb-6">
            <Link href="/" className="inline-flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-plum text-white flex items-center justify-center shadow-soft">
                <Cake className="w-5 h-5" />
              </div>
              <span className="font-serif text-2xl font-bold text-brand-espresso">CakeStore</span>
            </Link>
          </div>

          {/* Form Header */}
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-brand-espresso tracking-tight">
              Welcome Back
            </h2>
            <p className="text-xs sm:text-sm text-brand-muted">
              Enter your credentials to access your bakery dashboard
            </p>
          </div>

          {infoMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-medium flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{infoMessage}</span>
            </div>
          )}

          {error && <ErrorState message={error} className="text-left" />}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-brand-espresso">
                Email address or mobile number <span className="text-brand-crimson">*</span>
              </label>
              <div className="relative">
                {/^\d+$/.test(identifier.trim()) ? (
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                ) : (
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                )}
                <input
                  type="text"
                  required
                  placeholder="e.g. 9876543210 or owner@bakery.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-border bg-white text-sm text-brand-espresso placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-plum/20 focus:border-brand-plum transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-brand-espresso">
                  Password <span className="text-brand-crimson">*</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] font-semibold text-brand-plum hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-brand-border bg-white text-sm text-brand-espresso placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-plum/20 focus:border-brand-plum transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-espresso transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-sm font-bold shadow-soft transition-all active:scale-[0.99] mt-2"
              size="lg"
              isLoading={isLoading}
            >
              <span>Sign In to Dashboard</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          {/* Registration Switcher */}
          <div className="pt-6 border-t border-brand-border/60 text-center space-y-3">
            <p className="text-xs text-brand-muted">
              Don&apos;t have an online bakery on CakeStore yet?
            </p>
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border border-brand-border bg-white hover:bg-brand-cream text-xs font-bold text-brand-espresso transition-all shadow-2xs"
            >
              <span>Register Your Bakery</span>
              <ArrowRight className="w-3.5 h-3.5 text-brand-plum" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
