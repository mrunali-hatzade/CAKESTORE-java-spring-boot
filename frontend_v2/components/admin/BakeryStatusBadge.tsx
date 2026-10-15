import React from 'react';
import { Badge } from '@/components/ui/Badge';

export interface BakeryStatusProps {
  shopStatus?: string | null;
  subscriptionStatus?: string | null;
  isOwnerEnabled?: boolean | null;
  isMarketplaceRestricted?: boolean | null;
  isDeleted?: boolean | null;
  compact?: boolean;
}

/**
 * Computes whether the bakery's storefront is genuinely live and order-ready for customers.
 * Storefront is live ONLY if:
 * 1. shopStatus === 'ACTIVE'
 * 2. Not soft-deleted (isDeleted !== true and shopStatus !== 'DELETED')
 * 3. Subscription status is explicitly 'ACTIVE' (conservative: null/missing/EXPIRED/NONE/SUSPENDED/CANCELLED are false)
 * 4. Owner has not disabled/paused the bakery (isOwnerEnabled !== false)
 * 5. Admin has not restricted the bakery from the marketplace (isMarketplaceRestricted !== true)
 */
export function computeStorefrontAvailability(props: {
  shopStatus?: string | null;
  subscriptionStatus?: string | null;
  isOwnerEnabled?: boolean | null;
  isMarketplaceRestricted?: boolean | null;
  isDeleted?: boolean | null;
}): {
  isStoreLive: boolean;
  isDeleted: boolean;
  status: string;
  subStatus: string;
  isOwnerOn: boolean;
  isRestricted: boolean;
} {
  const status = (props.shopStatus || 'UNKNOWN').toUpperCase();
  const isDeleted = Boolean(props.isDeleted || status === 'DELETED');
  const subStatus = (props.subscriptionStatus || 'NONE').toUpperCase();
  const isSubActive = subStatus === 'ACTIVE';
  // Conservative: if isOwnerEnabled is undefined or null on an active shop, default to false if unknown or check explicitly
  const isOwnerOn = props.isOwnerEnabled === true;
  const isRestricted = Boolean(props.isMarketplaceRestricted);

  const isStoreLive =
    !isDeleted &&
    status === 'ACTIVE' &&
    isSubActive &&
    isOwnerOn &&
    !isRestricted;

  return {
    isStoreLive,
    isDeleted,
    status,
    subStatus,
    isOwnerOn,
    isRestricted,
  };
}

export function BakeryStatusBadge({
  shopStatus,
  subscriptionStatus,
  isOwnerEnabled,
  isMarketplaceRestricted,
  isDeleted,
  compact = false,
}: BakeryStatusProps) {
  const {
    isStoreLive,
    isDeleted: deleted,
    status,
    subStatus,
    isOwnerOn,
    isRestricted,
  } = computeStorefrontAvailability({
    shopStatus,
    subscriptionStatus,
    isOwnerEnabled,
    isMarketplaceRestricted,
    isDeleted,
  });

  if (deleted) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900 text-rose-300 border border-slate-700">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
        SOFT-DELETED
      </span>
    );
  }

  if (status === 'SUSPENDED') {
    return <Badge variant="error" size="sm">Suspended</Badge>;
  }

  if (status === 'PENDING' || status === 'PENDING_APPROVAL') {
    return <Badge variant="warning" size="sm">Pending Approval</Badge>;
  }

  if (status === 'REJECTED') {
    return <Badge variant="default" size="sm">Rejected</Badge>;
  }

  if (status === 'ACTIVE') {
    if (isStoreLive) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          ACTIVE • STORE LIVE
        </span>
      );
    }

    // Account is ACTIVE with administration, but storefront is NOT LIVE
    return (
      <div className="flex flex-col gap-1 items-start">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          ACTIVE • STORE OFFLINE
        </span>

        {!compact && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {isRestricted && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                Marketplace Restricted
              </span>
            )}
            {subStatus !== 'ACTIVE' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                Sub: {subStatus === 'NONE' ? 'No Subscription' : subStatus}
              </span>
            )}
            {!isOwnerOn && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300">
                Paused by Owner
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return <Badge variant="default" size="sm">{status}</Badge>;
}
