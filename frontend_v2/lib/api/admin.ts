import { apiClient } from './client';
import { PaginatedResponse } from '@/types/order';
import {
  DashboardStats,
  AdminShopSummary,
  AdminShopDetails,
  AdminPlan,
  AdminMessagePayload,
  AdminOrderSummary,
  AdminOrderDetail,
  AdminPaymentSummary,
  AdminPaymentDetail,
} from '@/types/admin';

// ==========================================
// SUPER ADMIN API CLIENT FUNCTIONS (LIVE BACKEND)
// ==========================================

/**
 * Fetch top-level platform statistics for Admin Dashboard.
 */
export async function getPlatformStats(startDate?: string, endDate?: string): Promise<DashboardStats> {
  return apiClient.get<DashboardStats>('/api/admin/dashboard/stats', {
    params: { startDate, endDate }
  });
}

export async function getShopCounts(): Promise<{ total: number; active: number; pending: number; suspended: number }> {
  return apiClient.get<{ total: number; active: number; pending: number; suspended: number }>('/api/admin/shops/counts');
}

/**
 * Fetch all registered bakery shops across the platform.
 */
export async function getAllShops(page: number = 0, size: number = 20, search?: string, status?: string): Promise<PaginatedResponse<AdminShopSummary>> {
  return apiClient.get<PaginatedResponse<AdminShopSummary>>('/api/admin/shops', {
    params: { page, size, ...(search && { search }), ...(status && status !== "ALL" && { status }) }
  });
}

export async function getAllAdminShops(page: number = 0, size: number = 20, search?: string, status?: string): Promise<PaginatedResponse<AdminShopSummary>> {
  return apiClient.get<PaginatedResponse<AdminShopSummary>>('/api/admin/shops', {
    params: { page, size, ...(search && { search }), ...(status && status !== "ALL" && { status }) }
  });
}

/**
 * Fetch deep operational details for a specific bakery shop.
 */
export async function getShopDetails(shopId: number): Promise<AdminShopDetails> {
  return apiClient.get<AdminShopDetails>(`/api/admin/shops/${shopId}`);
}

export async function getAdminShopDetails(shopId: number): Promise<AdminShopDetails> {
  return apiClient.get<AdminShopDetails>(`/api/admin/shops/${shopId}`);
}

/**
 * Update shop operational status (ACTIVE, SUSPENDED, INACTIVE).
 */
export async function updateShopStatus(
  shopId: number,
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | string,
  reason?: string
): Promise<any> {
  return apiClient.patch(`/api/admin/shops/${shopId}/status`, { status, reason });
}

/**
 * Review bakery KYC compliance verification (APPROVE, REJECT).
 */
export async function updateShopVerification(
  shopId: number,
  action: 'APPROVE' | 'REJECT',
  reason?: string
): Promise<any> {
  return apiClient.patch(`/api/admin/shops/${shopId}/verification`, { action, reason });
}

/**
 * Fetch platform subscription plans.
 */
export async function getAllPlans(): Promise<AdminPlan[]> {
  return apiClient.get<AdminPlan[]>('/api/admin/plans');
}

export async function getAdminPlans(): Promise<AdminPlan[]> {
  return apiClient.get<AdminPlan[]>('/api/admin/plans');
}

/**
 * Create a new subscription plan.
 */
export async function createPlan(plan: Partial<AdminPlan>): Promise<AdminPlan> {
  return apiClient.post<AdminPlan>('/api/admin/plans', plan);
}

/**
 * Update an existing subscription plan.
 */
export async function updatePlan(id: number, plan: Partial<AdminPlan>): Promise<AdminPlan> {
  return apiClient.put<AdminPlan>(`/api/admin/plans/${id}`, plan);
}

/**
 * Toggle plan active status.
 */
export async function togglePlanStatus(id: number, isActive: boolean): Promise<AdminPlan> {
  return apiClient.patch<AdminPlan>(`/api/admin/plans/${id}/status?isActive=${isActive}`);
}

/**
 * Broadcast an announcement message to all or specific bakery owners.
 */
export async function getAdminBroadcastHistory(): Promise<any[]> {
  return apiClient.get<any[]>('/api/admin/messages/history');
}

export async function sendAdminMessage(payload: AdminMessagePayload): Promise<string> {
  return apiClient.post<string>('/api/admin/messages', payload);
}

export async function reorderPlans(planIds: number[]): Promise<any> {
  return apiClient.put('/api/admin/plans/reorder', planIds);
}

export const adminApi = {
  getPlatformStats,
  getAllShops,
  getAllAdminShops,
  getShopDetails,
  getAdminShopDetails,
  updateShopStatus,
  updateShopVerification,
  getAllPlans,
  getAdminPlans,
  createPlan,
  updatePlan,
  togglePlanStatus,
  reorderPlans,
  sendAdminMessage,
  getAdminBroadcastHistory,
  getAdminDocumentViewUrl,
};

export async function getRecentActivity(): Promise<any[]> {
  return apiClient.get<any[]>('/api/admin/dashboard/stats/activity');
}

export async function getRevenueAnalytics(): Promise<{ saasRevenue: any[], networkGmv: any[] }> {
  const res: any = await apiClient.get('/api/admin/dashboard/stats/analytics/revenue');
  return res.data || res;
}

/**
 * Obtain authorized view URL for a private shop verification document.
 */
export async function getAdminDocumentViewUrl(documentId: number): Promise<{ url: string }> {
  return apiClient.get<{ url: string }>(`/api/admin/documents/${documentId}/view?redirect=false`);
}

// ==========================================
// ADMIN ORDERS & PAYMENTS LEDGER API METHODS
// ==========================================

export interface GetAdminOrdersParams {
  page?: number;
  size?: number;
  query?: string;
  status?: string;
  orderStatus?: string;
  paymentStatus?: string;
  shopId?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Fetch cross-shop orders with masking and pagination (size max 50).
 */
export async function getAdminOrders(params: GetAdminOrdersParams = {}): Promise<PaginatedResponse<AdminOrderSummary>> {
  return apiClient.get<PaginatedResponse<AdminOrderSummary>>('/api/admin/orders', {
    params: {
      page: params.page ?? 0,
      size: Math.min(params.size ?? 20, 50),
      ...(params.query && { query: params.query }),
      ...(params.status && params.status !== 'ALL' && { status: params.status }),
      ...(params.orderStatus && params.orderStatus !== 'ALL' && { orderStatus: params.orderStatus }),
      ...(params.paymentStatus && params.paymentStatus !== 'ALL' && { paymentStatus: params.paymentStatus }),
      ...(params.shopId && { shopId: params.shopId }),
      ...(params.startDate && { startDate: params.startDate }),
      ...(params.endDate && { endDate: params.endDate }),
    }
  });
}

/**
 * Fetch detailed order information including line items, delivery slot, and address.
 */
export async function getAdminOrderDetail(orderId: number): Promise<AdminOrderDetail> {
  return apiClient.get<AdminOrderDetail>(`/api/admin/orders/${orderId}`);
}

export interface GetAdminPaymentsParams {
  page?: number;
  size?: number;
  query?: string;
  status?: string;
  type?: string;
  transactionType?: string;
  shopId?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Fetch cross-shop payments ledger with 3-tier classification and pagination (size max 50).
 */
export async function getAdminPayments(params: GetAdminPaymentsParams = {}): Promise<PaginatedResponse<AdminPaymentSummary>> {
  return apiClient.get<PaginatedResponse<AdminPaymentSummary>>('/api/admin/payments', {
    params: {
      page: params.page ?? 0,
      size: Math.min(params.size ?? 20, 50),
      ...(params.query && { query: params.query }),
      ...(params.status && params.status !== 'ALL' && { status: params.status }),
      ...(params.type && params.type !== 'ALL' && { type: params.type }),
      ...(params.transactionType && params.transactionType !== 'ALL' && { transactionType: params.transactionType }),
      ...(params.shopId && { shopId: params.shopId }),
      ...(params.startDate && { startDate: params.startDate }),
      ...(params.endDate && { endDate: params.endDate }),
    }
  });
}

/**
 * Fetch detailed payment record with subscription snapshot, order snapshot, or unlinked diagnostics.
 */
export async function getAdminPaymentDetail(paymentId: number): Promise<AdminPaymentDetail> {
  return apiClient.get<AdminPaymentDetail>(`/api/admin/payments/${paymentId}`);
}

