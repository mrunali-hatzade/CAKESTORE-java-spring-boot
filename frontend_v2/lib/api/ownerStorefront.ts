import { apiClient } from './client';
import {
  ShopBanner,
  ShopBannerRequest,
  ShopBusinessHour,
  ShopBusinessHoursRequest,
  ShopDeliveryConfig,
  ShopStorefrontSettings,
  ShopCustomFormField,
  WebsiteConfigurationRequest,
  ShopSocialLink,
  ShopSocialLinkRequest,
} from '@/types/storefrontManagement';


export const ownerStorefrontApi = {
  // Hero Banners
  getBanners: async (): Promise<ShopBanner[]> => {
    return apiClient.get<ShopBanner[]>('/api/owner/storefront/banners');
  },
  createBanner: async (data: ShopBannerRequest): Promise<ShopBanner> => {
    return apiClient.post<ShopBanner>('/api/owner/storefront/banners', data);
  },
  updateBanner: async (id: number, data: ShopBannerRequest): Promise<ShopBanner> => {
    return apiClient.put<ShopBanner>(`/api/owner/storefront/banners/${id}`, data);
  },
  deleteBanner: async (id: number): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`/api/owner/storefront/banners/${id}`);
  },

  // Business Hours
  getBusinessHours: async (): Promise<ShopBusinessHour[]> => {
    return apiClient.get<ShopBusinessHour[]>('/api/owner/storefront/business-hours');
  },
  saveBusinessHour: async (data: ShopBusinessHoursRequest): Promise<ShopBusinessHour> => {
    return apiClient.post<ShopBusinessHour>('/api/owner/storefront/business-hours', data);
  },

  // Delivery Config
  getDeliveryConfig: async (): Promise<ShopDeliveryConfig> => {
    return apiClient.get<ShopDeliveryConfig>('/api/owner/storefront/delivery-config');
  },
  updateDeliveryConfig: async (data: Partial<ShopDeliveryConfig>): Promise<ShopDeliveryConfig> => {
    return apiClient.put<ShopDeliveryConfig>('/api/owner/storefront/delivery-config', data);
  },

  // Storefront Section Visibility & Fulfillment Settings
  getStorefrontSettings: async (): Promise<ShopStorefrontSettings> => {
    return apiClient.get<ShopStorefrontSettings>('/api/owner/storefront/settings');
  },
  updateStorefrontSettings: async (data: Partial<ShopStorefrontSettings>): Promise<ShopStorefrontSettings> => {
    return apiClient.put<ShopStorefrontSettings>('/api/owner/storefront/settings', data);
  },

  // Atomic Save All
  updateWebsiteConfiguration: async (data: WebsiteConfigurationRequest): Promise<{ message: string }> => {
    return apiClient.put<{ message: string }>('/api/owner/storefront/website', data);
  },

  // Custom Cake Form Fields
  getCustomFormFields: async (): Promise<ShopCustomFormField[]> => {
    return apiClient.get<ShopCustomFormField[]>('/api/owner/storefront/custom-fields');
  },
  createCustomFormField: async (data: Partial<ShopCustomFormField>): Promise<ShopCustomFormField> => {
    return apiClient.post<ShopCustomFormField>('/api/owner/storefront/custom-fields', data);
  },
  updateCustomFormField: async (id: number, data: Partial<ShopCustomFormField>): Promise<ShopCustomFormField> => {
    return apiClient.put<ShopCustomFormField>(`/api/owner/storefront/custom-fields/${id}`, data);
  },
  deleteCustomFormField: async (id: number): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`/api/owner/storefront/custom-fields/${id}`);
  },

  // Social & External Links
  getSocialLinks: async (): Promise<ShopSocialLink[]> => {
    return apiClient.get<ShopSocialLink[]>('/api/owner/storefront/social-links');
  },
  createSocialLink: async (data: ShopSocialLinkRequest): Promise<ShopSocialLink> => {
    return apiClient.post<ShopSocialLink>('/api/owner/storefront/social-links', data);
  },
  updateSocialLink: async (id: number, data: ShopSocialLinkRequest): Promise<ShopSocialLink> => {
    return apiClient.put<ShopSocialLink>(`/api/owner/storefront/social-links/${id}`, data);
  },
  deleteSocialLink: async (id: number): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`/api/owner/storefront/social-links/${id}`);
  },
};

