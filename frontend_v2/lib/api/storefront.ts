import { apiClient } from './client';
import { 
  Shop, 
  ShopSearchFilters, 
  PopularCity, 
  PaginatedShopList, 
  SpringPageResponse, 
  ShopPaginationMetadata 
} from '@/types/shop';
import { Product, Category } from '@/types/product';
import { PaginatedResponse } from '@/types/order';
import { StorefrontQuoteRequest, StorefrontQuoteResponse } from '@/types/storefrontManagement';

export function buildShopSearchParams(filters: ShopSearchFilters = {}): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.state && filters.state.trim() && !filters.state.toLowerCase().startsWith('all')) {
    params.state = filters.state.trim();
  }
  if (filters.district && filters.district.trim() && !filters.district.toLowerCase().startsWith('all')) {
    params.district = filters.district.trim();
  }
  if (filters.city && filters.city.trim() && !filters.city.toLowerCase().startsWith('all')) {
    params.city = filters.city.trim();
  }
  if (filters.area && filters.area.trim() && !filters.area.toLowerCase().startsWith('all')) {
    params.area = filters.area.trim();
  }
  if (filters.pincode && filters.pincode.trim() && !filters.pincode.toLowerCase().startsWith('all')) {
    params.pincode = filters.pincode.trim();
  }
  if (filters.country && filters.country.trim()) {
    params.country = filters.country.trim();
  }
  if (filters.businessType && filters.businessType !== 'ALL' && filters.businessType.trim()) {
    params.businessType = filters.businessType.trim();
  }
  if (filters.search && filters.search.trim()) {
    params.search = filters.search.trim();
  }
  if (filters.location && filters.location.trim() && !filters.location.toLowerCase().startsWith('all')) {
    params.location = filters.location.trim();
  }
  if (filters.latitude != null && !isNaN(filters.latitude)) {
    params.latitude = filters.latitude.toString();
  }
  if (filters.longitude != null && !isNaN(filters.longitude)) {
    params.longitude = filters.longitude.toString();
  }
  if (filters.radiusKm != null && !isNaN(filters.radiusKm)) {
    params.radiusKm = filters.radiusKm.toString();
  }
  if (filters.sortBy && filters.sortBy.trim()) {
    params.sortBy = filters.sortBy.trim();
  }
  if (filters.page != null) {
    params.page = filters.page.toString();
  }
  if (filters.size != null) {
    params.size = filters.size.toString();
  }
  return params;
}

export function normalizeShopSearchResponse(
  raw: unknown,
  requestedFilters?: { page?: number; size?: number }
): PaginatedShopList {
  if (Array.isArray(raw)) {
    const list = [...raw] as PaginatedShopList;
    return list;
  }

  if (raw && typeof raw === 'object' && 'content' in raw && Array.isArray((raw as { content: unknown }).content)) {
    const page = raw as SpringPageResponse<Shop>;
    const list = [...page.content] as PaginatedShopList;
    const totalElements = typeof page.totalElements === 'number' ? page.totalElements : page.content.length;
    const size = typeof page.size === 'number' ? page.size : (requestedFilters?.size ?? (page.content.length || 20));
    const totalPages = typeof page.totalPages === 'number'
      ? page.totalPages
      : (size > 0 ? Math.ceil(totalElements / size) : (totalElements > 0 ? 1 : 0));
    const pageNum = typeof page.number === 'number' ? page.number : (requestedFilters?.page ?? 0);

    list.pagination = {
      totalElements,
      totalPages,
      page: pageNum,
      size,
      first: typeof page.first === 'boolean' ? page.first : pageNum === 0,
      last: typeof page.last === 'boolean' ? page.last : (pageNum >= totalPages - 1),
      empty: typeof page.empty === 'boolean' ? page.empty : page.content.length === 0,
    };
    return list;
  }

  // Malformed, null, undefined, or unexpected shape
  const emptyList = [] as PaginatedShopList;
  return emptyList;
}

export function normalizeToPaginatedResponse(
  raw: unknown,
  requestedFilters?: { page?: number; size?: number }
): PaginatedResponse<Shop> {
  const list = normalizeShopSearchResponse(raw, requestedFilters);
  const pagination = list.pagination;

  return {
    content: list,
    totalElements: pagination?.totalElements ?? list.length,
    totalPages: pagination?.totalPages ?? (list.length > 0 ? 1 : 0),
    number: pagination?.page ?? (requestedFilters?.page ?? 0),
    size: pagination?.size ?? (requestedFilters?.size ?? (list.length || 20)),
    first: pagination?.first ?? true,
    last: pagination?.last ?? true,
    empty: pagination?.empty ?? (list.length === 0),
    numberOfElements: list.length,
    pageable: null,
    sort: null,
  };
}

export const storefrontApi = {
  getShopById: async (shopId: number | string): Promise<Shop> => {
    try {
      const shop = await apiClient.get<Shop>(`/api/storefront/shops/${shopId}`);
      if (shop && shop.id) {
        return shop;
      }
      throw new Error('Bakery not found');
    } catch (err: any) {
      console.error(`[StorefrontAPI] getShopById(${shopId}) error:`, err);
      throw new Error(err.message || 'Failed to load bakery storefront.');
    }
  },

  getPopularCities: async (limit: number = 8): Promise<PopularCity[]> => {
    try {
      const data = await apiClient.get<PopularCity[]>(
        `/api/storefront/shops/locations/popular-cities?limit=${limit}`
      );
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      throw err;
    }
  },

  searchShops: async (filters: ShopSearchFilters = {}): Promise<PaginatedShopList> => {
    const params = buildShopSearchParams(filters);

    try {
      const data = await apiClient.get<unknown>('/api/storefront/shops/search', { params });
      return normalizeShopSearchResponse(data, { page: filters.page, size: filters.size });
    } catch (err: any) {
      console.error('[StorefrontAPI] searchShops error:', err);
      throw new Error(err.message || "We couldn't load bakeries right now.");
    }
  },

  searchShopsPaged: async (filters: ShopSearchFilters = {}): Promise<PaginatedResponse<Shop>> => {
    const effectiveFilters: ShopSearchFilters = {
      ...filters,
      page: filters.page ?? 0,
      size: filters.size ?? 20,
    };
    const params = buildShopSearchParams(effectiveFilters);

    try {
      const data = await apiClient.get<unknown>('/api/storefront/shops/search', { params });
      return normalizeToPaginatedResponse(data, { page: effectiveFilters.page, size: effectiveFilters.size });
    } catch (err: any) {
      console.error('[StorefrontAPI] searchShopsPaged error:', err);
      throw new Error(err.message || "We couldn't load bakeries right now.");
    }
  },

  getStorefrontProducts: async (shopId: number | string): Promise<Product[]> => {
    try {
      const prods = await apiClient.get<Product[]>(`/api/storefront/shops/${shopId}/products`);
      return Array.isArray(prods) ? prods : [];
    } catch (err: any) {
      throw err;
    }
  },

  getProductDetails: async (
    shopId: number | string,
    productId: number | string
  ): Promise<Product> => {
    return apiClient.get<Product>(`/api/storefront/shops/${shopId}/products/${productId}`);
  },

  getStorefrontCategories: async (shopId: number | string): Promise<Category[]> => {
    try {
      const data = await apiClient.get<Category[]>(`/api/storefront/shops/${shopId}/categories`);
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      throw err;
    }
  },

  validateCoupon: async (
    shopId: number | string,
    code: string,
    subtotal: number
  ): Promise<{
    valid: boolean;
    code?: string;
    discountType?: 'PERCENTAGE' | 'FLAT';
    discountValue?: number;
    discountAmount?: number;
    minOrderValue?: number;
    maxDiscountCap?: number;
    newSubtotal?: number;
    message?: string;
  }> => {
    return apiClient.post(
      `/api/storefront/shops/${shopId}/coupons/validate`,
      { code, subtotal }
    );
  },

  getShopCoupons: async (
    shopId: number | string
  ): Promise<
    Array<{
      code: string;
      discountType: string;
      discountValue: number;
      minOrderValue?: number;
      maxDiscountCap?: number;
      expiryDate?: string;
    }>
  > => {
    try {
      const data = await apiClient.get<any>(`/api/storefront/shops/${shopId}/coupons`);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      throw err;
    }
  },

  getTopRatedProducts: async (shopId: number | string, limit: number = 8): Promise<Product[]> => {
    try {
      const prods = await apiClient.get<Product[]>(`/api/storefront/shops/${shopId}/products/top-rated?limit=${limit}`);
      return Array.isArray(prods) ? prods : [];
    } catch (err: any) {
      throw err;
    }
  },

  submitCustomCakeRequest: async (
    shopId: number | string,
    payload: any
  ): Promise<any> => {
    return apiClient.post(`/api/storefront/shops/${shopId}/custom-cakes`, payload);
  },

  submitEnquiry: async (
    shopId: number | string,
    payload: {
      customerName: string;
      customerEmail: string;
      customerMobile?: string;
      enquiryType: string;
      message: string;
    }
  ): Promise<any> => {
    return apiClient.post(`/api/storefront/shops/${shopId}/enquiries`, payload);
  },

  getShopFeedback: async (shopId: number | string): Promise<any[]> => {
    try {
      const data = await apiClient.get<any[]>(`/api/storefront/shops/${shopId}/feedback`);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      throw err;
    }
  },

  submitFeedback: async (
    shopId: number | string,
    payload: {
      customerDisplayName?: string;
      rating: number;
      comment: string;
      orderReference?: string;
      productId?: number | null;
      productName?: string;
      recommendationText?: string;
      cakeImageUrl?: string;
      cakeVideoUrl?: string;
    }
  ): Promise<any> => {
    return apiClient.post(`/api/storefront/shops/${shopId}/feedback`, payload);
  },

  updateFeedback: async (
    shopId: number | string,
    feedbackId: number | string,
    payload: {
      customerDisplayName?: string;
      rating: number;
      comment: string;
      orderReference?: string;
      productId?: number | null;
      productName?: string;
      recommendationText?: string;
      cakeImageUrl?: string;
      cakeVideoUrl?: string;
    },
    token?: string
  ): Promise<any> => {
    return apiClient.put(
      `/api/storefront/shops/${shopId}/feedback/${feedbackId}`,
      payload,
      token ? { headers: { 'X-Review-Token': token }, params: { token } } : undefined
    );
  },

  deleteFeedback: async (
    shopId: number | string,
    feedbackId: number | string,
    token?: string,
    customerName?: string
  ): Promise<any> => {
    const params: Record<string, string> = {};
    const headers: Record<string, string> = {};
    if (token) {
      params.token = token;
      headers['X-Review-Token'] = token;
    }
    if (customerName) {
      params.customerName = customerName;
      headers['X-Customer-Name'] = customerName;
    }
    return apiClient.delete(
      `/api/storefront/shops/${shopId}/feedback/${feedbackId}`,
      {
        params: Object.keys(params).length > 0 ? params : undefined,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      }
    );
  },

  uploadReviewMedia: async (file: File): Promise<{ url: string; fileName: string; type: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const response = await fetch(`${API_BASE_URL}/api/storefront/media/upload-review-media`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      let errorMsg = 'Media upload failed';
      try {
        const data = await response.json();
        if (data?.error) errorMsg = data.error;
        else if (data?.message) errorMsg = data.message;
      } catch {
        // ignore parse errors
      }
      throw new Error(errorMsg);
    }
    return response.json();
  },

  calculateQuote: async (
    shopId: number | string,
    payload: StorefrontQuoteRequest
  ): Promise<StorefrontQuoteResponse> => {
    return apiClient.post(`/api/storefront/shops/${shopId}/quote`, payload);
  },
};
