import { apiClient } from './client';

export interface GlobalSettings {
  id?: number;
  platformName: string;
  supportEmail: string;
  razorpayKeyId: string;
  razorpayKeySecret?: string;
  razorpayWebhookSecret?: string;
  razorpayKeySecretConfigured?: boolean;
  razorpayWebhookSecretConfigured?: boolean;
  platformCurrency: string;
  updatedAt?: string;
}

export const adminSettingsApi = {
  getSettings: async (): Promise<GlobalSettings> => {
    return await apiClient.get<GlobalSettings>('/api/admin/settings');
  },

  updateSettings: async (settings: Partial<GlobalSettings>): Promise<GlobalSettings> => {
    return await apiClient.put<GlobalSettings>('/api/admin/settings', settings);
  },
};
