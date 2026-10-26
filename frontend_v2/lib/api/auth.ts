import { apiClient } from './client';
import { LoginRequest, LoginResponse, RegisterFormData } from '@/types/auth';

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const rawId = credentials.identifier || credentials.username || credentials.email;
    const payload = {
      identifier: rawId,
      username: rawId,
      email: rawId,
      password: credentials.password,
    };
    return apiClient.post<LoginResponse>('/api/auth/login', payload);
  },

  register: async (formData: RegisterFormData): Promise<any> => {
    const data = new FormData();
    data.append('fullName', formData.fullName);
    data.append('email', formData.email);
    data.append('password', formData.password);
    data.append('mobile', formData.mobile);
    data.append('businessName', formData.businessName);
    if (formData.businessType) data.append('businessType', formData.businessType);
    if (formData.businessDescription) data.append('businessDescription', formData.businessDescription);
    if (formData.businessPhone) data.append('businessPhone', formData.businessPhone);
    if (formData.businessEmail) data.append('businessEmail', formData.businessEmail);
    if (formData.yearsInBusiness !== undefined) data.append('yearsInBusiness', String(formData.yearsInBusiness));
    data.append('addressLine1', formData.addressLine1);
    if (formData.addressLine2) data.append('addressLine2', formData.addressLine2);
    if (formData.area) data.append('area', formData.area);
    data.append('city', formData.city);
    if (formData.district) data.append('district', formData.district);
    data.append('state', formData.state);
    data.append('pincode', formData.pincode);
    if (formData.fssaiRegistration) data.append('fssaiRegistration', formData.fssaiRegistration);
    if (formData.verificationFile) {
      data.append('verificationFile', formData.verificationFile);
    }
    if (formData.latitude !== undefined && formData.latitude !== null) {
      data.append('latitude', String(formData.latitude));
    }
    if (formData.longitude !== undefined && formData.longitude !== null) {
      data.append('longitude', String(formData.longitude));
    }

    return apiClient.post('/api/auth/register', data);
  },

  forgotPassword: async (email: string): Promise<any> => {
    return apiClient.post('/api/auth/forgot-password', { email });
  },

  resetPassword: async (data: { token: string; newPassword: string }): Promise<any> => {
    return apiClient.post('/api/auth/reset-password', data);
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<any> => {
    return apiClient.post('/api/auth/change-password', data);
  },

  logout: async (): Promise<any> => {
    return apiClient.post('/api/auth/logout');
  },
};
