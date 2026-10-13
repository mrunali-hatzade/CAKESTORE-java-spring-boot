'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  TrendingUp,
  Store,
  ExternalLink,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  XCircle,
  FileText,
  CreditCard,
  ShoppingBag,
  Cake,
  Activity,
  AlertTriangle,
  Ban,
  FileCheck,
  Loader2,
  Receipt,
} from 'lucide-react';
import { getShopDetails, updateShopStatus, updateShopVerification, getAdminDocumentViewUrl } from '@/lib/api/admin';
import { AdminShopDetails, BusinessDocumentItem } from '@/types/admin';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { LoadingState } from '@/components/ui/LoadingState';
import { useToast } from '@/components/common/Toast';

import { AdminSuspensionModal } from '@/components/admin/shops/AdminSuspensionModal';
import { AdminKycRejectionModal } from '@/components/admin/shops/AdminKycRejectionModal';

export default function AdminShopDetailPage() {
  const params = useParams();
  const router = useRouter();
  const shopId = Number(params?.id);

  const [details, setDetails] = useState<AdminShopDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  // Suspension Modal State (B2)
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);

  // KYC Rejection Modal State (B3)
  const [isRejectKycModalOpen, setIsRejectKycModalOpen] = useState(false);

  // Document Viewing State
  const [viewingDocId, setViewingDocId] = useState<number | null>(null);

  const toast = useToast();

  const loadShop = useCallback(async () => {
    if (!shopId) return;
    setIsLoading(true);

    try {
      const data = await getShopDetails(shopId);
      setDetails(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch bakery details');
    } finally {
      setIsLoading(false);
    }
  }, [shopId, toast]);

  useEffect(() => {
    loadShop();
    const handleRefresh = () => loadShop();
    window.addEventListener('adminGlobalRefresh', handleRefresh);
    return () => window.removeEventListener('adminGlobalRefresh', handleRefresh);
  }, [loadShop]);

  const handleStatusUpdate = async (newStatus: string, reason?: string) => {
    if (!shopId) return;
    if (newStatus === 'SUSPENDED' && (!reason || !reason.trim())) {
      toast.error('Suspension reason is mandatory and cannot be blank.');
      return;
    }

    setIsMutating(true);
    try {
      await updateShopStatus(shopId, newStatus, reason?.trim());
      toast.success(`Bakery #${shopId} status changed to ${newStatus}`);
      setIsSuspendModalOpen(false);

      // Optimistic update
      if (details) {
        setDetails({
          ...details,
          shop: {
            ...details.shop,
            status: newStatus,
          },
          activityLogs: [
            {
              id: Date.now(),
              action: newStatus === 'SUSPENDED' ? 'SHOP_SUSPENDED' : 'STATUS_CHANGE',
              details: newStatus === 'SUSPENDED'
                ? `Admin suspended shop: ${reason?.trim()}`
                : `Admin changed shop status to ${newStatus}`,
              createdAt: new Date().toISOString(),
              timestamp: new Date().toISOString(),
            },
            ...(details.activityLogs || []),
          ],
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update shop status');
    } finally {
      setIsMutating(false);
    }
  };

  const handleVerificationReview = async (action: 'APPROVE' | 'REJECT', reason?: string) => {
    if (!shopId) return;
    if (action === 'REJECT' && (!reason || !reason.trim())) {
      toast.error('Rejection reason is mandatory and cannot be blank.');
      return;
    }

    setIsMutating(true);
    try {
      await updateShopVerification(shopId, action, reason?.trim());
      const newStatus = action === 'APPROVE' ? 'VERIFIED' : 'REJECTED';
      toast.success(`Bakery #${shopId} verification status marked as ${newStatus}`);
      setIsRejectKycModalOpen(false);

      // Optimistic update
      if (details) {
        setDetails({
          ...details,
          shop: {
            ...details.shop,
            verificationStatus: newStatus,
          },
          businessDocuments: (details.businessDocuments || []).map((d) => ({
            ...d,
            status: newStatus,
          })),
          activityLogs: [
            {
              id: Date.now(),
              action: action === 'APPROVE' ? 'VERIFIED' : 'REJECTED',
              details: action === 'APPROVE'
                ? 'Admin approved bakery verification documents'
                : `Admin rejected verification: ${reason?.trim()}`,
              createdAt: new Date().toISOString(),
              timestamp: new Date().toISOString(),
            },
            ...(details.activityLogs || []),
          ],
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to review verification');
    } finally {
      setIsMutating(false);
    }
  };

  const handleViewDocument = async (docId: number) => {
    setViewingDocId(docId);
    try {
      const res = await getAdminDocumentViewUrl(docId);
      if (res && res.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Could not generate secure view link for this document.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to open document. Please check permissions.');
    } finally {
      setViewingDocId(null);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading bakery verification details..." />;
  }

  if (!details) {
    return (
      <div className="text-center py-16 space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Bakery Verification Record Not Found</h2>
        <p className="text-xs text-slate-500">The requested bakery tenant ID could not be loaded.</p>
        <Link href="/admin/shops">
          <Button variant="outline" size="sm">Back to Bakery Directory</Button>
        </Link>
      </div>
    );
  }

  const { shop, subscriptions = [], payments = [], activityLogs = [], businessDocuments = [] } = details;

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'ACTIVE') return <Badge variant="success">Active Storefront</Badge>;
    if (s === 'PENDING' || s === 'PENDING_APPROVAL') return <Badge variant="warning">Pending Review</Badge>;
    if (s === 'SUSPENDED') return <Badge variant="error">Suspended</Badge>;
    if (s === 'INACTIVE') return <Badge variant="default">Inactive</Badge>;
    if (s === 'REJECTED') return <Badge variant="error">Rejected</Badge>;
    return <Badge variant="default">{status}</Badge>;
  };

  const getVerificationBadge = (vStatus?: string) => {
    const s = (vStatus || 'PROCESSING').toUpperCase();
    if (s === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Verified</span>
        </span>
      );
    }
    if (s === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Rejected</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3.5 h-3.5" />
        <span>Under Review</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar with Back Navigation */}
      <div className="sticky top-0 z-20 -mx-4 -mt-4 px-4 py-2.5 sm:-mx-8 sm:-mt-8 sm:px-8 sm:py-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <Link
          href="/admin/shops"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Bakery Directory</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <Link href={`/shop/${shop.id}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50">
              <Store className="w-4 h-4" />
              <span>View Storefront</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Details Header Banner */}
      <Card className="p-6 border-slate-200 shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-serif text-2xl font-bold shrink-0 border border-indigo-100">
              {shop.businessName.charAt(0)}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-serif font-bold text-xl sm:text-2xl text-slate-900">
                  {shop.businessName}
                </h1>
                {getStatusBadge(shop.status)}
                {getVerificationBadge(shop.verificationStatus)}
                {shop.isPureVeg && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    🌱 100% Pure Veg
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                <span className="font-mono text-slate-400">Tenant ID #{shop.id}</span>
                <span>•</span>
                <span>Registered: {new Date(shop.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </p>
            </div>
          </div>

          {/* Moderation Status Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {shop.status !== 'ACTIVE' && (
              <div title={shop.verificationStatus !== 'VERIFIED' ? 'Cannot activate until KYC verification is approved' : ''}>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isMutating || shop.verificationStatus !== 'VERIFIED'}
                  onClick={() => handleStatusUpdate('ACTIVE')}
                  className="bg-emerald-600 hover:bg-emerald-700 border-emerald-700 gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Activate Storefront</span>
                </Button>
              </div>
            )}

            {shop.status === 'ACTIVE' && (
              <Button
                variant="danger"
                size="sm"
                disabled={isMutating}
                onClick={() => setIsSuspendModalOpen(true)}
                className="gap-1.5"
              >
                <Ban className="w-4 h-4" />
                <span>Suspend Storefront</span>
              </Button>
            )}

            {shop.status !== 'PENDING' && (
              <Button
                variant="outline"
                size="sm"
                disabled={isMutating}
                onClick={() => handleStatusUpdate('PENDING')}
                className="gap-1.5 text-amber-700 hover:bg-amber-50"
              >
                <Clock className="w-4 h-4" />
                <span>Mark Under Review</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Link href={`/shop/${shop.id}`} target="_blank">
          <Card className="p-5 border-slate-200/80 shadow-soft hover:shadow-md transition-shadow cursor-pointer h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Catalog Products</span>
              <Cake className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold font-serif text-slate-900 mt-2">{details.totalProducts}</p>
            <span className="text-xs text-slate-500 mt-1 block">Live menu items</span>
          </Card>
        </Link>

        <Card className="p-5 border-slate-200/80 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Orders</span>
            <ShoppingBag className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-serif text-slate-900 mt-2">{details.totalOrders}</p>
          <span className="text-xs text-slate-500 mt-1 block">Lifetime orders placed</span>
        </Card>

        <Card className="p-5 border-slate-200/80 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">FSSAI Status</span>
            <ShieldCheck className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-sm font-bold text-slate-900 mt-2 font-mono truncate">
            {shop.fssaiRegistration || 'Not Submitted'}
          </p>
          <span className="text-xs text-purple-600 mt-1 block">
            {shop.fssaiRegistration ? 'License Registered' : 'Missing Verification Document'}
          </span>
        </Card>

        <Card className="p-5 border-slate-200/80 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Plan</span>
            <CreditCard className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-sm font-bold text-slate-900 mt-2 truncate">
            {subscriptions[0]?.planName || 'Starter Bakery'}
          </p>
          <span className="text-xs text-amber-600 mt-1 block">
            {subscriptions[0]?.status || 'No Active Plan'}
          </span>
        </Card>
      </div>

      {/* Two Column Layout: Business KYC vs Activity & Subscription History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Business & KYC Profile */}
        <Card className="p-6 border-slate-200/80 shadow-soft space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <h3 className="font-serif font-bold text-base text-slate-900">
                Bakery Business & Verification Details
              </h3>
            </div>
            {getVerificationBadge(shop.verificationStatus)}
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="text-slate-400 font-medium block">About & Bio</span>
              <p className="text-slate-700 mt-1 leading-relaxed">
                {shop.description || 'No description provided by bakery.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Phone</span>
                  <p className="text-slate-800 font-medium">
                    {shop.phone ? <a href={`tel:${shop.phone}`} className="text-indigo-600 hover:underline">{shop.phone}</a> : '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Email</span>
                  <p className="text-slate-800 font-medium truncate">
                    {shop.email ? <a href={`mailto:${shop.email}`} className="text-indigo-600 hover:underline">{shop.email}</a> : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 space-y-1">
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-[10px] font-semibold uppercase">Address & Location</span>
              </div>
              <p className="text-slate-800 font-medium pl-6">
                {shop.address || '—'}
              </p>
              <p className="text-slate-500 pl-6">
                {[shop.city, shop.state, shop.pincode].filter(Boolean).join(', ') || '—'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-indigo-700 uppercase">
                  FSSAI Food License #
                </span>
                <span className="text-[10px] font-semibold text-emerald-600">Compliance</span>
              </div>
              <p className="text-base font-bold font-mono text-indigo-950">
                {shop.fssaiRegistration || (businessDocuments?.some(doc => doc.documentType?.includes('FSSAI')) ? 'Document Attached (Number Missing)' : 'NOT_SUBMITTED')}
              </p>
            </div>

            {/* B3: Submitted Verification Documents Section */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                  Submitted Verification Documents ({businessDocuments.length})
                </span>
              </div>

              {businessDocuments.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-400">
                  <p>No compliance documents uploaded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {businessDocuments.map((doc: BusinessDocumentItem) => (
                    <div
                      key={doc.id}
                      className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div className="truncate">
                          <p className="font-bold text-slate-800 truncate">{doc.documentType}</p>
                          <p className="text-[10px] text-slate-400">
                            Uploaded: {new Date(doc.createdAt).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          doc.status === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : doc.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {doc.status}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleViewDocument(doc.id)}
                          disabled={viewingDocId === doc.id}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50 cursor-pointer"
                          title="View Document Securely"
                        >
                          {viewingDocId === doc.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                          ) : (
                            <ExternalLink className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* B3: Administrative KYC Actions (Approve / Reject) */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                disabled={isMutating || shop.verificationStatus === 'VERIFIED'}
                onClick={() => handleVerificationReview('APPROVE')}
                className="w-full sm:w-auto flex-1 bg-emerald-600 hover:bg-emerald-700 border-emerald-700 gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{shop.verificationStatus === 'VERIFIED' ? 'Verified' : 'Verify Bakery'}</span>
              </Button>

              <Button
                variant="danger"
                size="sm"
                disabled={isMutating}
                onClick={() => setIsRejectKycModalOpen(true)}
                className="w-full sm:w-auto flex-1 gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject Application</span>
              </Button>
            </div>
          </div>
        </Card>

        {/* Right Column: Subscriptions & Activity Log */}
        <div className="space-y-6">
          {/* Bakery Business Performance Card */}
          <Card className="p-6 border-slate-200/80 shadow-soft">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h3 className="font-serif font-bold text-base text-slate-900">
                  Bakery Performance
                </h3>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                Order Metrics
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Bakery Sales / GMV</span>
                <p className="text-base font-bold text-slate-900 mt-0.5">
                  ₹{(details.totalRevenue ?? 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">This Month</span>
                <p className="text-base font-bold text-slate-900 mt-0.5">
                  ₹{(details.monthlyRevenue ?? 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">This Week</span>
                <p className="text-base font-bold text-slate-900 mt-0.5">
                  ₹{(details.weeklyRevenue ?? 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Orders</span>
                <p className="text-base font-bold text-slate-900 mt-0.5">{details.totalOrders}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Completed</span>
                <p className="text-base font-bold text-emerald-600 mt-0.5">
                  {details.completedOrders ?? 0}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Avg Order Value</span>
                <p className="text-base font-bold text-indigo-600 mt-0.5">
                  ₹{details.avgOrderValue ?? (details.totalOrders > 0 ? Math.round((details.totalRevenue ?? 0) / details.totalOrders) : 0)}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 italic">
              Authoritative order GMV from backend. Zero platform commission.
            </p>
          </Card>

          {/* Subscription Information Card */}
          <Card className="p-6 border-slate-200/80 shadow-soft">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-600" />
                <h3 className="font-serif font-bold text-base text-slate-900">
                  Subscription Plan
                </h3>
              </div>
              <Badge variant={subscriptions[0]?.status === 'ACTIVE' ? 'success' : 'default'} size="sm">
                {subscriptions[0]?.status || 'UNSUBSCRIBED'}
              </Badge>
            </div>

            <div className="p-4 rounded-xl bg-purple-50/40 border border-purple-100 space-y-3 text-xs mb-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-sm">
                  {subscriptions[0]?.planName || 'No Active Plan'}
                </span>
                <span className="font-extrabold text-purple-700 text-sm">
                  {subscriptions[0]?.amount ? `₹${subscriptions[0].amount} / billing cycle` : '—'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1 border-t border-purple-100/60">
                <div>
                  <span className="text-slate-400 block font-medium">Start Date</span>
                  <span className="font-semibold text-slate-700">
                    {subscriptions[0]?.startDate || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Renewal / Expiry</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">
                      {subscriptions[0]?.endDate || '—'}
                    </span>
                    {subscriptions[0]?.endDate && (() => {
                      const daysLeft = Math.ceil((new Date(subscriptions[0].endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      if (daysLeft < 0) return <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">⚠️ EXPIRED</span>;
                      if (daysLeft <= 7) return <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">⚠️ Expires in {daysLeft} day(s)</span>;
                      return null;
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {subscriptions.length > 1 && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400">Past Billing Cycles</span>
                {subscriptions.slice(1).map((sub) => (
                  <div
                    key={sub.id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{sub.planName}</p>
                      <p className="text-[10px] text-slate-400">{sub.startDate} - {sub.endDate}</p>
                    </div>
                    <span className="font-bold text-slate-700">₹{sub.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Subscription Billing History Card */}
          <Card className="p-6 border-slate-200/80 shadow-soft">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <h3 className="font-serif font-bold text-base text-slate-900">
                  Subscription Billing History
                </h3>
              </div>
              <Badge variant="default" size="sm">
                {payments.length} {payments.length === 1 ? 'Invoice' : 'Invoices'}
              </Badge>
            </div>

            {payments.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                No subscription billing records found for this bakery.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {payments.map((p) => {
                  const isCompleted = p.status?.toUpperCase() === 'COMPLETED';
                  const isFailed = p.status?.toUpperCase() === 'FAILED';
                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-slate-900">
                            ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {p.currency || 'INR'}
                          </span>
                        </div>
                        <Badge
                          variant={isCompleted ? 'success' : isFailed ? 'error' : 'warning'}
                          size="sm"
                        >
                          {p.status}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-400">
                          {new Date(p.paidAt || p.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
                          {p.providerPaymentId && (
                            <span title="Payment ID">{p.providerPaymentId}</span>
                          )}
                          {p.providerOrderId && (
                            <span title="Order ID">• {p.providerOrderId}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Activity Logs Card */}
          <Card className="p-6 border-slate-200/80 shadow-soft">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
              <Activity className="w-4 h-4 text-emerald-600" />
              <h3 className="font-serif font-bold text-base text-slate-900">
                Security & Audit Trail
              </h3>
            </div>

            {activityLogs.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No activity logs recorded.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 font-mono text-[11px]">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(log.timestamp || log.createdAt || Date.now()).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{log.details || log.metadata}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* B2: Suspension Confirmation Modal */}
      <AdminSuspensionModal
        isOpen={isSuspendModalOpen}
        onClose={() => setIsSuspendModalOpen(false)}
        onConfirm={(reason) => handleStatusUpdate('SUSPENDED', reason)}
        isMutating={isMutating}
      />

      {/* B3: KYC Rejection Modal */}
      <AdminKycRejectionModal
        isOpen={isRejectKycModalOpen}
        onClose={() => setIsRejectKycModalOpen(false)}
        onConfirm={(reason) => handleVerificationReview('REJECT', reason)}
        isMutating={isMutating}
      />
    </div>
  );
}
