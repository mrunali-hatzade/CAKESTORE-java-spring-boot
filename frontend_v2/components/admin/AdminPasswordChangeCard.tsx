'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { authApi } from '@/lib/api/auth';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/components/common/Toast';

export interface AdminPasswordChangeCardProps {
  onSuccess?: () => void;
  className?: string;
}

export function AdminPasswordChangeCard({ onSuccess, className = '' }: AdminPasswordChangeCardProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const errors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    // 1. Required field checks
    if (!currentPassword) {
      errors.currentPassword = 'Current password is required.';
    }

    if (!newPassword) {
      errors.newPassword = 'New password is required.';
    } else if (newPassword.length < 8) {
      // 2. Minimum length rule (matches backend requirement of >= 8 chars)
      errors.newPassword = 'New password must be at least 8 characters long.';
    } else if (currentPassword && newPassword === currentPassword) {
      // 3. New password must differ from current password
      errors.newPassword = 'New password must be different from current password.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm new password is required.';
    } else if (newPassword && confirmPassword !== newPassword) {
      // 4. Confirm password match
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setSuccessMessage(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Send currentPassword and newPassword using exact backend DTO
      await authApi.changePassword({
        currentPassword,
        newPassword,
      });

      // Clear input fields from memory immediately
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFieldErrors({});

      const msg = 'Password successfully changed. In accordance with platform security policy, all active sessions have been revoked. Redirecting to login...';
      setSuccessMessage(msg);
      toast.success('Password changed successfully. Please log in again.');

      if (onSuccess) {
        onSuccess();
      }

      // Backend increments tokenVersion and invalidates all existing tokens.
      // Clear local session storage and AuthContext state, then redirect to login.
      setTimeout(async () => {
        try {
          await logout();
        } catch {
          // Ignore network errors during session wipe
        }
        router.push('/login?password_changed=true&redirect=/admin');
      }, 1500);
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to update password. Please check your credentials.';
      setGeneralError(errMsg);
      toast.error(errMsg);

      // Map backend-specific error messages to relevant fields when applicable
      if (errMsg.toLowerCase().includes('current password')) {
        setFieldErrors((prev) => ({
          ...prev,
          currentPassword: errMsg,
        }));
      } else if (errMsg.toLowerCase().includes('at least 8 characters')) {
        setFieldErrors((prev) => ({
          ...prev,
          newPassword: errMsg,
        }));
      } else if (errMsg.toLowerCase().includes('different from current password')) {
        setFieldErrors((prev) => ({
          ...prev,
          newPassword: errMsg,
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className={`p-6 sm:p-8 border-slate-200 bg-white shadow-soft rounded-2xl ${className}`}>
      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
          <KeyRound className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-serif font-bold text-lg sm:text-xl text-slate-900">
            Change Administrator Password
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Update your administrative login credentials. For security, changing your password invalidates all active sessions across all devices.
          </p>
        </div>
      </div>

      {generalError && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-medium flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to update password</p>
            <p className="mt-0.5 text-rose-700">{generalError}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-medium flex items-start gap-3"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Password Updated Successfully</p>
            <p className="mt-0.5 text-emerald-700">{successMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-lg" noValidate>
        {/* Current Password Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="admin-current-password"
            className="block text-xs sm:text-sm font-semibold text-slate-700"
          >
            Current Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="admin-current-password"
              name="currentPassword"
              type={showCurrentPassword ? 'text' : 'password'}
              required
              disabled={isSubmitting}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (fieldErrors.currentPassword) {
                  setFieldErrors((prev) => ({ ...prev, currentPassword: undefined }));
                }
              }}
              placeholder="Enter your current password"
              className={`w-full px-3.5 py-2.5 pr-10 rounded-xl border text-sm text-slate-900 bg-white placeholder:text-slate-400 transition-colors focus:outline-hidden focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 ${
                fieldErrors.currentPassword
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                  : 'border-slate-300 focus:border-indigo-600 focus:ring-indigo-600/20'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              disabled={isSubmitting}
              aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-hidden p-1 rounded-md"
            >
              {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {fieldErrors.currentPassword && (
            <p className="text-xs text-rose-600 font-medium mt-1">
              {fieldErrors.currentPassword}
            </p>
          )}
        </div>

        {/* New Password Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="admin-new-password"
            className="block text-xs sm:text-sm font-semibold text-slate-700"
          >
            New Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="admin-new-password"
              name="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              required
              disabled={isSubmitting}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (fieldErrors.newPassword) {
                  setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
                }
              }}
              placeholder="At least 8 characters"
              className={`w-full px-3.5 py-2.5 pr-10 rounded-xl border text-sm text-slate-900 bg-white placeholder:text-slate-400 transition-colors focus:outline-hidden focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 ${
                fieldErrors.newPassword
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                  : 'border-slate-300 focus:border-indigo-600 focus:ring-indigo-600/20'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              disabled={isSubmitting}
              aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-hidden p-1 rounded-md"
            >
              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {fieldErrors.newPassword ? (
            <p className="text-xs text-rose-600 font-medium mt-1">{fieldErrors.newPassword}</p>
          ) : (
            <p className="text-[11px] text-slate-500">
              Must be at least 8 characters long and different from your current password.
            </p>
          )}
        </div>

        {/* Confirm New Password Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="admin-confirm-password"
            className="block text-xs sm:text-sm font-semibold text-slate-700"
          >
            Confirm New Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="admin-confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              disabled={isSubmitting}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }
              }}
              placeholder="Re-enter your new password"
              className={`w-full px-3.5 py-2.5 pr-10 rounded-xl border text-sm text-slate-900 bg-white placeholder:text-slate-400 transition-colors focus:outline-hidden focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 ${
                fieldErrors.confirmPassword
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                  : 'border-slate-300 focus:border-indigo-600 focus:ring-indigo-600/20'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isSubmitting}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-hidden p-1 rounded-md"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <p className="text-xs text-rose-600 font-medium mt-1">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            isLoading={isSubmitting}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Updating Password...' : 'Update Password'}
          </Button>
        </div>
      </form>

      {/* Security Stamp Notice */}
      <div className="mt-8 pt-6 border-t border-slate-100 flex items-start gap-3 text-xs text-slate-500">
        <Lock className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-700 font-semibold">Security Note:</strong> CakeStore uses account-level cryptographic token versions. Updating your administrator password immediately revokes active JWT sessions across all browsers and devices to prevent session hijacking.
        </p>
      </div>
    </Card>
  );
}

