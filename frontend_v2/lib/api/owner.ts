import { apiClient } from './client';
import {
  DashboardAnalytics,
  CouponRecord,
  CreateCouponPayload,
  CustomerProfile,
  CustomCakeRequest,
  ConvertToOrderPayload,
  ConvertToOrderResult,
  GeneralEnquiry,
  FeedbackRecord,
  ShopSettings,
  ShopPayoutDetails,
  SubscriptionRecord,
  PaymentMockResult,
  OwnerDashboardStats,
  OwnerPaymentRecord,
  GlobalSearchResults,
} from '@/types/owner';
import { PaginatedResponse } from '@/types/order';

export const ownerApi = {
  // Stats
  getDashboardStats: async (): Promise<OwnerDashboardStats> => {
    return apiClient.get<OwnerDashboardStats>('/api/shops/my-shop/stats');
  },

  // Analytics
  getAnalytics: async (range: string = '7d'): Promise<DashboardAnalytics> => {
    return apiClient.get<DashboardAnalytics>('/api/owner/analytics/dashboard', {
      params: { range },
    });
  },

  // Coupons
  getCoupons: async (): Promise<CouponRecord[]> => {
    const res = await apiClient.get<PaginatedResponse<CouponRecord>>('/api/owner/coupons', { params: { page: 0, size: 1000 } });
    return res.content;
  },

  getOwnerCoupons: async (page = 0, size = 10, search?: string, status?: string): Promise<PaginatedResponse<CouponRecord>> => {
    return apiClient.get<PaginatedResponse<CouponRecord>>('/api/owner/coupons', { params: { page, size, ...(search ? { search } : {}), ...(status && status !== 'ALL' ? { status } : {}) } });
  },

  createCoupon: async (data: CreateCouponPayload): Promise<CouponRecord> => {
    return apiClient.post<CouponRecord>('/api/owner/coupons', data);
  },

  createOwnerCoupon: async (data: CreateCouponPayload): Promise<CouponRecord> => {
    return apiClient.post<CouponRecord>('/api/owner/coupons', data);
  },

  updateOwnerCoupon: async (id: number | string, data: CreateCouponPayload): Promise<CouponRecord> => {
    return apiClient.put<CouponRecord>(`/api/owner/coupons/${id}`, data);
  },

  toggleCoupon: async (id: string | number): Promise<CouponRecord> => {
    return apiClient.patch<CouponRecord>(`/api/owner/coupons/${id}/toggle`);
  },

  deleteCoupon: async (id: string | number): Promise<{ message?: string }> => {
    return apiClient.delete<{ message?: string }>(`/api/owner/coupons/${id}`);
  },

  // Customers
  getCustomers: async (page: number = 0, size: number = 10, search: string = ''): Promise<PaginatedResponse<CustomerProfile>> => {
    return apiClient.get<PaginatedResponse<CustomerProfile>>('/api/owner/customers', {
      params: { page, size, ...(search ? { search } : {}) },
    });
  },

  getOwnerCustomers: async (): Promise<CustomerProfile[]> => {
    return apiClient.get<CustomerProfile[]>('/api/owner/customers');
  },

  getCustomerProfile: async (email: string): Promise<CustomerProfile> => {
    return apiClient.get<CustomerProfile>(`/api/owner/customers/${encodeURIComponent(email)}`);
  },

  // Enquiries (General)
  getEnquiries: async (): Promise<GeneralEnquiry[]> => {
    return apiClient.get<GeneralEnquiry[]>('/api/owner/enquiries');
  },

  getOwnerEnquiries: async (page = 0, size = 20, search?: string, status?: string, type?: string): Promise<PaginatedResponse<GeneralEnquiry>> => {
    return apiClient.get<PaginatedResponse<GeneralEnquiry>>('/api/owner/enquiries', {
      params: { 
        page, 
        size, 
        ...(search ? { search } : {}),
        ...(status && status !== 'ALL' ? { status } : {}),
        ...(type && type !== 'ALL' ? { type } : {})
      },
    });
  },

  replyToEnquiry: async (id: string | number, reply: string): Promise<GeneralEnquiry> => {
    return apiClient.post<GeneralEnquiry>(`/api/owner/enquiries/${id}/reply`, { reply: reply.trim() });
  },

  replyToGeneralEnquiry: async (id: number, reply: string): Promise<GeneralEnquiry> => {
    return apiClient.post<GeneralEnquiry>(`/api/owner/enquiries/${id}/reply`, { reply: reply.trim() });
  },

  updateGeneralEnquiryStatus: async (id: number, status: string): Promise<GeneralEnquiry> => {
    return apiClient.patch<GeneralEnquiry>(`/api/owner/enquiries/${id}/status?status=${encodeURIComponent(status)}`);
  },

  deleteGeneralEnquiry: async (id: number): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`/api/owner/enquiries/${id}`);
  },

  // Custom Cakes
  getCustomCakeRequests: async (): Promise<CustomCakeRequest[]> => {
    return apiClient.get<CustomCakeRequest[]>('/api/owner/custom-cakes');
  },

  getOwnerCustomCakeRequests: async (): Promise<CustomCakeRequest[]> => {
    return apiClient.get<CustomCakeRequest[]>('/api/owner/custom-cakes');
  },

  respondToCustomCakeRequest: async (
    id: string | number,
    status: string,
    reply?: string
  ): Promise<CustomCakeRequest> => {
    const url = `/api/owner/custom-cakes/${id}/respond?status=${encodeURIComponent(status)}`;
    const body = reply && reply.trim() ? { reply: reply.trim() } : undefined;
    return apiClient.post<CustomCakeRequest>(url, body);
  },

  convertToOrder: async (
    id: string | number,
    payload?: ConvertToOrderPayload
  ): Promise<ConvertToOrderResult> => {
    return apiClient.post<ConvertToOrderResult>(`/api/owner/custom-cakes/${id}/convert-to-order`, payload || {});
  },

  updateEnquiryStatus: async (id: string | number, status: any, quotedPrice?: number): Promise<void> => {
    const statusStr = String(status);
    const reply = quotedPrice ? `Quote: ?${quotedPrice}` : `Status: ${statusStr}`;
    await apiClient.post(`/api/owner/custom-cakes/${id}/respond?status=${encodeURIComponent(statusStr)}`, { reply }).catch(() => {});
  },

  // Reviews / Feedback
  getReviews: async (): Promise<FeedbackRecord[]> => {
    return apiClient.get<FeedbackRecord[]>('/api/owner/feedback');
  },

  getOwnerFeedback: async (page = 0, size = 20, search?: string, rating?: number): Promise<PaginatedResponse<FeedbackRecord>> => {
    return apiClient.get<PaginatedResponse<FeedbackRecord>>('/api/owner/feedback', {
      params: { 
        page, 
        size, 
        ...(search ? { search } : {}),
        ...(rating ? { rating } : {})
      },
    });
  },

  replyToReview: async (id: string | number, reply: string): Promise<FeedbackRecord> => {
    return apiClient.post<FeedbackRecord>(`/api/owner/feedback/${id}/reply`, { reply: reply.trim() });
  },

  replyToFeedback: async (id: number, reply: string): Promise<FeedbackRecord> => {
    return apiClient.post<FeedbackRecord>(`/api/owner/feedback/${id}/reply`, { reply: reply.trim() });
  },

  deleteReview: async (id: string | number): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`/api/owner/feedback/${id}`);
  },

  deleteFeedback: async (id: number): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`/api/owner/feedback/${id}`);
  },

  moderateFeedback: async (id: number | string, isApproved: boolean): Promise<FeedbackRecord> => {
    return apiClient.patch<FeedbackRecord>(`/api/owner/feedback/${id}/moderation?isApproved=${isApproved}`);
  },

  // Shop Settings / Profile
  getShopSettings: async (): Promise<ShopSettings> => {
    return apiClient.get<ShopSettings>('/api/shops/my-shop');
  },

  getVerificationStatus: async (): Promise<{
    shopId?: number;
    verificationStatus: string;
    rejectionReason?: string | null;
    documents?: any[];
  } | null> => {
    try {
      return await apiClient.get('/api/verification/status');
    } catch {
      return null;
    }
  },

  uploadVerificationDocument: async (data: { documentType: string; fileUrl: string }): Promise<any> => {
    return apiClient.post('/api/verification/documents', data);
  },

  updateShopSettings: async (data: Partial<ShopSettings>): Promise<ShopSettings> => {
    return apiClient.put<ShopSettings>('/api/shops/my-shop', data);
  },

  updateOperationalStatus: async (enabled: boolean): Promise<ShopSettings> => {
    return apiClient.put<ShopSettings>('/api/shops/my-shop/operational-status', { enabled });
  },

  // Payout Details
  getPayoutDetails: async (): Promise<ShopPayoutDetails | null> => {
    try {
      return await apiClient.get<ShopPayoutDetails>('/api/shops/my-shop/payouts');
    } catch {
      return null;
    }
  },

  updatePayoutDetails: async (data: ShopPayoutDetails): Promise<ShopPayoutDetails> => {
    return apiClient.post<ShopPayoutDetails>('/api/shops/my-shop/payouts', data);
  },

  // Subscription
  getSubscription: async (): Promise<SubscriptionRecord | null> => {
    try {
      return await apiClient.get<SubscriptionRecord>('/api/owner/subscriptions/current');
    } catch {
      return null;
    }
  },

  getCurrentSubscription: async (): Promise<SubscriptionRecord | null> => {
    try {
      return await apiClient.get<SubscriptionRecord>('/api/owner/subscriptions/current');
    } catch {
      return null;
    }
  },

  cancelSubscription: async (reason?: string): Promise<SubscriptionRecord> => {
    const payload = reason && reason.trim() ? { reason: reason.trim() } : {};
    return apiClient.post<SubscriptionRecord>('/api/owner/subscriptions/cancel', payload);
  },

  // Stage C: Owner Payments & Invoices (Paginated)
  getPayments: async (page = 0, size = 10): Promise<PaginatedResponse<OwnerPaymentRecord>> => {
    const res: any = await apiClient.get('/api/owner/payments', {
      params: { page, size },
    });
    if (Array.isArray(res)) {
      return {
        content: res,
        pageable: {},
        totalElements: res.length,
        totalPages: 1,
        last: true,
        size: res.length,
        number: 0,
        sort: {},
        numberOfElements: res.length,
        first: true,
        empty: res.length === 0,
      };
    }
    return res;
  },

  downloadPaymentInvoice: async (paymentId: number): Promise<void> => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const token = typeof window !== 'undefined' ? localStorage.getItem('cakestore_token') : null;

    const response = await fetch(`${API_BASE_URL}/api/owner/payments/${paymentId}/invoice`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error(`Failed to download invoice: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `invoice-SUB-${paymentId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  initiateSubscriptionPayment: async (planId: number): Promise<any> => {
    return apiClient.post('/api/owner/payments/initiate-subscription', { planId });
  },

  verifySubscriptionPayment: async (payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    planId: number;
  }): Promise<any> => {
    return apiClient.post('/api/owner/payments/verify-subscription', payload);
  },

  deleteAccount: async (data: { password: string; confirmationText: string }): Promise<{ success: boolean; message: string }> => {
    return apiClient.post<{ success: boolean; message: string }>('/api/owner/account/delete', data);
  },

  // Global Multi-Entity Command Palette Search
  globalSearch: async (query: string): Promise<GlobalSearchResults> => {
    return apiClient.get<GlobalSearchResults>('/api/shops/my-shop/search', {
      params: { q: query },
    });
  },
};



