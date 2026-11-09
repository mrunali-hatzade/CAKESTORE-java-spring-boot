'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Star,
  Search,
  RefreshCw,
  Filter,
  Eye,
  EyeOff,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  X,
  Store,
  ShoppingBag,
  MessageSquare,
  Calendar,
  Image as ImageIcon,
  Video,
  ShieldAlert,
  User,
  Clock,
  ExternalLink,
} from 'lucide-react';
import {
  getAdminProductReviews,
  moderateProductReview,
  getAllShops,
} from '@/lib/api/admin';
import {
  AdminProductReview,
  ReviewModerationStatus,
  AdminShopSummary,
} from '@/types/admin';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { useRegisterAdminRefresh } from '@/context/AdminRefreshContext';

type StatusFilter = 'ALL' | ReviewModerationStatus;
type RatingFilter = 'ALL' | 1 | 2 | 3 | 4 | 5;

export default function AdminProductReviewsPage() {
  const [reviews, setReviews] = useState<AdminProductReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Summary counts
  const [totalCount, setTotalCount] = useState(0);
  const [publishedCount, setPublishedCount] = useState(0);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);

  // Shops for bakery filter dropdown
  const [availableShops, setAvailableShops] = useState<AdminShopSummary[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('ALL');
  const [selectedShopId, setSelectedShopId] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Detail Modal
  const [selectedReview, setSelectedReview] = useState<AdminProductReview | null>(null);

  // Hide Review Modal
  const [reviewToHide, setReviewToHide] = useState<AdminProductReview | null>(null);
  const [hideReason, setHideReason] = useState('');
  const [isHiding, setIsHiding] = useState(false);
  const [hideError, setHideError] = useState<string | null>(null);

  // Restore Review Confirmation
  const [reviewToRestore, setReviewToRestore] = useState<AdminProductReview | null>(null);

  const toast = useToast();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchSeqRef = useRef<number>(0);

  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(0);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Load available bakeries on mount
  useEffect(() => {
    getAllShops(0, 100)
      .then((res) => {
        setAvailableShops(res.content || []);
      })
      .catch((err) => {
        console.warn('Failed to load bakeries list for review filter:', err);
      });
  }, []);

  // Fetch summary counts
  const fetchSummaryCounts = useCallback(async () => {
    setIsLoadingCounts(true);
    try {
      const [allRes, pubRes, hidRes] = await Promise.all([
        getAdminProductReviews({ page: 0, size: 1 }),
        getAdminProductReviews({ status: 'PUBLISHED', page: 0, size: 1 }),
        getAdminProductReviews({ status: 'HIDDEN', page: 0, size: 1 }),
      ]);
      setTotalCount(allRes.totalElements || 0);
      setPublishedCount(pubRes.totalElements || 0);
      setHiddenCount(hidRes.totalElements || 0);
    } catch (err) {
      console.warn('Failed to load review summary counts:', err);
    } finally {
      setIsLoadingCounts(false);
    }
  }, []);

  // Fetch reviews with filters and pagination
  const fetchReviews = useCallback(
    async (isManualRefresh = false) => {
      const seq = ++fetchSeqRef.current;
      if (!isManualRefresh) setIsLoading(true);
      setError(null);

      try {
        const params: any = {
          page,
          size,
          sortField: 'createdAt',
          sortDir: 'desc',
        };

        if (statusFilter !== 'ALL') {
          params.status = statusFilter;
        }

        if (ratingFilter !== 'ALL') {
          params.rating = ratingFilter;
        }

        if (selectedShopId) {
          params.shopId = Number(selectedShopId);
        }

        if (debouncedQuery.trim()) {
          params.query = debouncedQuery.trim();
        }

        const data = await getAdminProductReviews(params);

        if (seq === fetchSeqRef.current) {
          setReviews(data.content || []);
          setTotalPages(data.totalPages || 0);
          setTotalElements(data.totalElements || 0);
        }
      } catch (err: any) {
        if (seq === fetchSeqRef.current) {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            'Failed to fetch product reviews. Please try again.';
          setError(msg);
          setReviews([]);
        }
      } finally {
        if (seq === fetchSeqRef.current) {
          setIsLoading(false);
        }
      }
    },
    [page, size, statusFilter, ratingFilter, selectedShopId, debouncedQuery]
  );

  // Trigger counts and reviews fetch
  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    fetchSummaryCounts();
  }, [fetchSummaryCounts]);

  // Register with global Admin Refresh Header
  useRegisterAdminRefresh(
    useCallback(async () => {
      await Promise.all([fetchReviews(true), fetchSummaryCounts()]);
    }, [fetchReviews, fetchSummaryCounts])
  );

  // Reset all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setStatusFilter('ALL');
    setRatingFilter('ALL');
    setSelectedShopId('');
    setPage(0);
  };

  const hasActiveFilters =
    debouncedQuery !== '' ||
    statusFilter !== 'ALL' ||
    ratingFilter !== 'ALL' ||
    selectedShopId !== '';

  // Execute Hide Review
  const handleConfirmHide = async () => {
    if (!reviewToHide) return;
    const trimmedReason = hideReason.trim();

    if (!trimmedReason) {
      setHideError('Moderation reason is mandatory when hiding a review.');
      return;
    }

    if (trimmedReason.length > 500) {
      setHideError('Moderation reason cannot exceed 500 characters.');
      return;
    }

    setIsHiding(true);
    setHideError(null);

    try {
      const updated = await moderateProductReview(reviewToHide.id, {
        status: 'HIDDEN',
        reason: trimmedReason,
      });

      toast.success(
        `Review #${updated.id} has been hidden and removed from the public storefront.`
      );

      // Update in local state if currently selected in detail modal
      if (selectedReview?.id === updated.id) {
        setSelectedReview(updated);
      }

      setReviewToHide(null);
      setHideReason('');
      await Promise.all([fetchReviews(true), fetchSummaryCounts()]);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to hide review. Please check your network and try again.';
      setHideError(msg);
      toast.error(msg);
    } finally {
      setIsHiding(false);
    }
  };

  // Execute Restore Review
  const handleConfirmRestore = async () => {
    if (!reviewToRestore) return;

    try {
      const updated = await moderateProductReview(reviewToRestore.id, {
        status: 'PUBLISHED',
      });

      toast.success(
        `Review #${updated.id} is now published and visible on the storefront.`
      );

      if (selectedReview?.id === updated.id) {
        setSelectedReview(updated);
      }

      setReviewToRestore(null);
      await Promise.all([fetchReviews(true), fetchSummaryCounts()]);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to restore review. Please check your network and try again.';
      toast.error(msg);
    }
  };

  // Render Star Rating
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3.5 h-3.5 ${
              star <= rating
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-200 fill-slate-100'
            }`}
          />
        ))}
        <span className="ml-1 text-xs font-semibold text-slate-700">{rating}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Content Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 tracking-tight">
            Product Review Moderation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Super Admin moderation of verified customer product reviews. Hide inappropriate content or restore reviews.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchReviews(true);
              fetchSummaryCounts();
            }}
            disabled={isLoading}
            className="flex items-center gap-2 text-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 sm:p-5 border-slate-200/80 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Reviews
              </p>
              <h3 className="text-2xl font-bold font-serif text-slate-900 mt-1">
                {isLoadingCounts ? '...' : totalCount.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Star className="w-5 h-5 fill-indigo-200" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 border-slate-200/80 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Published
              </p>
              <h3 className="text-2xl font-bold font-serif text-emerald-600 mt-1">
                {isLoadingCounts ? '...' : publishedCount.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 border-slate-200/80 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Hidden (Moderated)
              </p>
              <h3 className="text-2xl font-bold font-serif text-rose-600 mt-1">
                {isLoadingCounts ? '...' : hiddenCount.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <EyeOff className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar Card */}
      <Card className="p-4 sm:p-5 shadow-xs border-slate-200/80 bg-white">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer, bakery, product, text..."
                className="pl-9 pr-8 text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Moderation Status */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Moderation Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as StatusFilter);
                  setPage(0);
                }}
                className="w-full text-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="HIDDEN">Hidden</option>
              </select>
            </div>

            {/* Star Rating */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Star Rating
              </label>
              <select
                value={ratingFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setRatingFilter(val === 'ALL' ? 'ALL' : (Number(val) as RatingFilter));
                  setPage(0);
                }}
                className="w-full text-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ALL">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
            </div>

            {/* Bakery Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Bakery Shop
              </label>
              <select
                value={selectedShopId}
                onChange={(e) => {
                  setSelectedShopId(e.target.value);
                  setPage(0);
                }}
                className="w-full text-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All Bakeries</option>
                {availableShops.map((shop) => (
                  <option key={shop.shopId} value={shop.shopId}>
                    {shop.businessName} (ID: #{shop.shopId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filter Row & Reset */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span className="font-medium">Filters active</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-xs text-indigo-600 hover:text-indigo-800 p-0 h-auto font-medium"
              >
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Review Table or Empty/Loading State */}
      <Card className="overflow-hidden border-slate-200/80 bg-white shadow-xs">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingState message="Loading product reviews..." />
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900 mb-1">Unable to Load Reviews</h3>
            <p className="text-sm text-slate-500 mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchReviews(true)}>
              Try Again
            </Button>
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Star className="w-8 h-8 text-slate-400" />}
              title={hasActiveFilters ? 'No Matching Reviews' : 'No Product Reviews Yet'}
              description={
                hasActiveFilters
                  ? 'Try modifying or clearing your filters to see more results.'
                  : 'Customer reviews will appear here once verified order items are reviewed.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="outline" size="sm" onClick={handleClearFilters}>
                    Clear Filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">ID</th>
                  <th className="py-3 px-4 font-semibold">Bakery & Product</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Rating</th>
                  <th className="py-3 px-4 font-semibold max-w-xs">Review Text</th>
                  <th className="py-3 px-4 font-semibold">Media</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Submitted</th>
                  <th className="py-3 px-4 font-semibold">Owner Reply</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reviews.map((rev) => {
                  const isPublished = rev.moderationStatus === 'PUBLISHED';
                  return (
                    <tr
                      key={rev.id}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                      onClick={() => setSelectedReview(rev)}
                    >
                      {/* ID */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500 font-medium">
                        #{rev.id}
                      </td>

                      {/* Bakery & Product */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900 leading-tight">
                          {rev.productName}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Store className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{rev.shopName}</span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{rev.customerName || 'Customer'}</span>
                        </div>
                        <span className="inline-block text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5">
                          Verified Buyer
                        </span>
                      </td>

                      {/* Rating */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStars(rev.rating)}
                      </td>

                      {/* Review Text */}
                      <td className="py-3.5 px-4 max-w-xs">
                        {rev.reviewText ? (
                          <p className="line-clamp-2 text-xs text-slate-600 leading-relaxed">
                            {rev.reviewText}
                          </p>
                        ) : (
                          <span className="text-xs italic text-slate-400">
                            (No comment provided)
                          </span>
                        )}
                      </td>

                      {/* Media */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {rev.cakeImageUrl && (
                            <span
                              title="Customer photo attached"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded"
                            >
                              <ImageIcon className="w-3 h-3 text-indigo-500" />
                              Photo
                            </span>
                          )}
                          {rev.cakeVideoUrl && (
                            <span
                              title="Customer video attached"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-purple-50 border border-purple-200/60 px-1.5 py-0.5 rounded"
                            >
                              <Video className="w-3 h-3 text-purple-500" />
                              Video
                            </span>
                          )}
                          {!rev.cakeImageUrl && !rev.cakeVideoUrl && (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </div>
                      </td>

                      {/* Moderation Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isPublished ? (
                          <Badge
                            variant="success"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200"
                          >
                            Published
                          </Badge>
                        ) : (
                          <Badge
                            variant="error"
                            className="bg-rose-50 text-rose-700 border-rose-200"
                          >
                            Hidden
                          </Badge>
                        )}
                      </td>

                      {/* Submitted Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                        {new Date(rev.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Owner Reply */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {rev.ownerReply ? (
                          <span
                            title="Bakery replied to this review"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-full"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Replied
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">None</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedReview(rev)}
                            className="text-slate-600 hover:text-slate-900 p-1.5 h-8 w-8"
                            title="View Full Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {isPublished ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setReviewToHide(rev);
                                setHideReason('');
                                setHideError(null);
                              }}
                              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 h-8 px-2.5 flex items-center gap-1"
                              title="Hide Review from Storefront"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Hide</span>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReviewToRestore(rev)}
                              className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 h-8 px-2.5 flex items-center gap-1"
                              title="Restore Review to Public Storefront"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!isLoading && totalElements > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="text-xs text-slate-500">
              Showing{' '}
              <span className="font-medium text-slate-700">
                {page * size + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium text-slate-700">
                {Math.min((page + 1) * size, totalElements)}
              </span>{' '}
              of <span className="font-medium text-slate-700">{totalElements}</span>{' '}
              reviews
            </div>

            <div className="flex items-center gap-2">
              <select
                value={size}
                onChange={(e) => {
                  setSize(Number(e.target.value));
                  setPage(0);
                }}
                className="text-xs rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
              </select>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="text-xs px-2.5 py-1 h-8"
                >
                  Previous
                </Button>
                <span className="text-xs text-slate-600 px-2 font-medium">
                  Page {page + 1} of {Math.max(1, totalPages)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="text-xs px-2.5 py-1 h-8"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Review Detail Modal */}
      <Modal
        isOpen={!!selectedReview}
        onClose={() => setSelectedReview(null)}
        title={`Review Details — #${selectedReview?.id}`}
        maxWidth="2xl"
      >
        {selectedReview && (
          <div className="space-y-6 pt-2">
            {/* Header info bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-3">
                {renderStars(selectedReview.rating)}
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(selectedReview.createdAt).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div>
                {selectedReview.moderationStatus === 'PUBLISHED' ? (
                  <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    Published
                  </Badge>
                ) : (
                  <Badge variant="error" className="bg-rose-50 text-rose-700 border-rose-200">
                    Hidden
                  </Badge>
                )}
              </div>
            </div>

            {/* Bakery & Customer metadata (PRIVACY PROTECTED: NO PHONE OR EDIT TOKEN) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-100">
                <div className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider mb-1">
                  Product & Bakery
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {selectedReview.productName}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedReview.shopName}</span>
                  <span className="text-slate-400 font-mono">(ID: #{selectedReview.shopId})</span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-100">
                <div className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider mb-1">
                  Customer
                </div>
                <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>{selectedReview.customerName || 'Verified Customer'}</span>
                </div>
                <div className="text-xs text-emerald-600 font-medium mt-1">
                  Verified Order Purchase
                </div>
              </div>
            </div>

            {/* Review Content */}
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1.5">
                Review Text
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedReview.reviewText || (
                  <span className="italic text-slate-400">No review text was provided by the customer.</span>
                )}
              </div>
            </div>

            {/* Attached Media */}
            {(selectedReview.cakeImageUrl || selectedReview.cakeVideoUrl) && (
              <div>
                <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2">
                  Customer Media
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedReview.cakeImageUrl && (
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                          Attached Image
                        </span>
                        <a
                          href={selectedReview.cakeImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          <span>Full size</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-video flex items-center justify-center">
                        <img
                          src={selectedReview.cakeImageUrl}
                          alt="Customer product review photo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}

                  {selectedReview.cakeVideoUrl && (
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                          <Video className="w-3.5 h-3.5 text-purple-500" />
                          Attached Video
                        </span>
                        <a
                          href={selectedReview.cakeVideoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          <span>Open video</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="rounded-lg overflow-hidden border border-slate-200 bg-black aspect-video flex items-center justify-center">
                        <video
                          src={selectedReview.cakeVideoUrl}
                          controls
                          className="w-full h-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bakery Owner Reply */}
            {selectedReview.ownerReply && (
              <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs font-semibold uppercase text-indigo-700 tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                    Bakery Owner Reply
                  </div>
                  {selectedReview.ownerRepliedAt && (
                    <span className="text-[11px] text-slate-500">
                      {new Date(selectedReview.ownerRepliedAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedReview.ownerReply}
                </p>
              </div>
            )}

            {/* Moderation Audit Info (when Hidden or moderated) */}
            {selectedReview.moderationStatus === 'HIDDEN' && (
              <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-200">
                <div className="flex items-center gap-2 text-rose-800 font-semibold text-xs uppercase tracking-wider mb-2">
                  <EyeOff className="w-4 h-4 text-rose-600" />
                  <span>Moderation Audit Trail</span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div>
                    <span className="font-semibold text-rose-900">Reason:</span>{' '}
                    <span>{selectedReview.moderationReason || 'None specified'}</span>
                  </div>
                  {(selectedReview.moderatedByName || selectedReview.moderatedByEmail) && (
                    <div>
                      <span className="font-semibold text-slate-600">Moderated By:</span>{' '}
                      <span>
                        {selectedReview.moderatedByName || selectedReview.moderatedByEmail}
                        {selectedReview.moderatedByEmail && selectedReview.moderatedByName && (
                          <span className="text-slate-400 ml-1">
                            ({selectedReview.moderatedByEmail})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {selectedReview.moderatedAt && (
                    <div>
                      <span className="font-semibold text-slate-600">Timestamp:</span>{' '}
                      <span>
                        {new Date(selectedReview.moderatedAt).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <div>
                {selectedReview.moderationStatus === 'PUBLISHED' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReviewToHide(selectedReview);
                      setHideReason('');
                      setHideError(null);
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 flex items-center gap-1.5"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide Review</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReviewToRestore(selectedReview)}
                    className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore Review</span>
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedReview(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Hide Review Confirmation / Reason Modal */}
      <Modal
        isOpen={!!reviewToHide}
        onClose={() => {
          if (!isHiding) {
            setReviewToHide(null);
            setHideReason('');
            setHideError(null);
          }
        }}
        title={`Hide Review #${reviewToHide?.id}`}
        maxWidth="md"
      >
        {reviewToHide && (
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-xs text-amber-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Hiding this review will remove it from the public storefront and exclude it from the product&apos;s public average rating calculation.
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 text-slate-600 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-800">Product:</span>{' '}
                {reviewToHide.productName} ({reviewToHide.shopName})
              </div>
              <div>
                <span className="font-semibold text-slate-800">Customer:</span>{' '}
                {reviewToHide.customerName} • {reviewToHide.rating} Stars
              </div>
            </div>

            {/* Moderation Reason Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Reason for Moderation <span className="text-rose-600">*</span>
                </label>
                <span
                  className={`text-[11px] font-mono ${
                    hideReason.length > 500 ? 'text-rose-600 font-bold' : 'text-slate-400'
                  }`}
                >
                  {hideReason.length}/500
                </span>
              </div>
              <textarea
                value={hideReason}
                onChange={(e) => {
                  setHideReason(e.target.value);
                  if (hideError) setHideError(null);
                }}
                maxLength={500}
                rows={3}
                placeholder="Specify the policy violation (e.g., abusive language, inappropriate media, advertising, spam)..."
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />
              {hideError && (
                <p className="text-xs text-rose-600 font-medium mt-1">{hideError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReviewToHide(null);
                  setHideReason('');
                  setHideError(null);
                }}
                disabled={isHiding}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmHide}
                disabled={isHiding || !hideReason.trim() || hideReason.length > 500}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isHiding ? 'Hiding...' : 'Confirm & Hide'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Restore Review Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!reviewToRestore}
        onClose={() => setReviewToRestore(null)}
        onConfirm={handleConfirmRestore}
        title={`Restore Review #${reviewToRestore?.id}`}
        description={
          <div>
            Are you sure you want to restore this review to public visibility?
            <div className="mt-2 text-xs text-slate-500">
              The review will reappear on the public storefront and will be included in the product&apos;s average rating calculation again.
            </div>
          </div>
        }
        confirmLabel="Restore Review"
        cancelLabel="Cancel"
        isDestructive={false}
      />
    </div>
  );
}
