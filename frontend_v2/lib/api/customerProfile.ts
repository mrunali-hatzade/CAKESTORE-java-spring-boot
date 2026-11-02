import { apiClient } from './client';

export interface CustomerProfile {
  id: number;
  fullName: string | null;
  email: string | null;
  mobile: string;
}

export interface CustomerProfileUpdateRequest {
  fullName: string;
  email: string | null;
}

export type AddressType = 'HOME' | 'WORK' | 'OTHER';

export interface CustomerAddress {
  id: number;
  label?: string;
  recipientName: string;
  fullName?: string;
  recipientPhone: string;
  mobileNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  addressType?: AddressType;
  deliveryAddress: string;
  formattedAddress?: string;
  default: boolean;
  isDefault?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface CustomerAddressRequest {
  label?: string;
  recipientName: string;
  fullName?: string;
  recipientPhone: string;
  mobileNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  addressType?: AddressType;
  deliveryAddress?: string;
  default?: boolean;
  isDefault?: boolean;
  latitude?: number;
  longitude?: number;
}

export const customerAddressApi = {
  getAddresses: async (token: string): Promise<CustomerAddress[]> => {
    return apiClient.get<CustomerAddress[]>('/api/customer/addresses', { token });
  },

  getAddressById: async (id: number, token: string): Promise<CustomerAddress> => {
    return apiClient.get<CustomerAddress>(`/api/customer/addresses/${id}`, { token });
  },

  addAddress: async (data: CustomerAddressRequest, token: string): Promise<CustomerAddress> => {
    return apiClient.post<CustomerAddress>('/api/customer/addresses', data, { token });
  },

  updateAddress: async (id: number, data: CustomerAddressRequest, token: string): Promise<CustomerAddress> => {
    return apiClient.put<CustomerAddress>(`/api/customer/addresses/${id}`, data, { token });
  },

  deleteAddress: async (id: number, token: string): Promise<void> => {
    return apiClient.delete(`/api/customer/addresses/${id}`, { token });
  },

  setDefaultAddress: async (id: number, token: string): Promise<{ success: boolean }> => {
    return apiClient.patch<{ success: boolean }>(`/api/customer/addresses/${id}/default`, {}, { token });
  }
};

export const customerProfileApi = {
  getProfile: async (token: string): Promise<CustomerProfile> => {
    return apiClient.get<CustomerProfile>('/api/customer/profile', { token });
  },

  updateProfile: async (data: CustomerProfileUpdateRequest, token: string): Promise<CustomerProfile> => {
    return apiClient.put<CustomerProfile>('/api/customer/profile', data, { token });
  },

  getAddresses: async (token: string): Promise<CustomerAddress[]> => {
    return customerAddressApi.getAddresses(token);
  },

  addAddress: async (data: CustomerAddressRequest, token: string): Promise<CustomerAddress> => {
    return customerAddressApi.addAddress(data, token);
  },

  updateAddress: async (id: number, data: CustomerAddressRequest, token: string): Promise<CustomerAddress> => {
    return customerAddressApi.updateAddress(id, data, token);
  },

  deleteAddress: async (id: number, token: string): Promise<void> => {
    return customerAddressApi.deleteAddress(id, token);
  },

  setDefaultAddress: async (id: number, token: string): Promise<{ success: boolean }> => {
    return customerAddressApi.setDefaultAddress(id, token);
  }
};
