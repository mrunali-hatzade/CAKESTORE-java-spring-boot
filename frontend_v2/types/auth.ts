export type UserRole = 'ROLE_CUSTOMER' | 'ROLE_SHOP_OWNER' | 'ROLE_ADMIN';

export interface AuthUser {
  id?: number | string;
  email: string;
  role: UserRole;
  shopId?: number | null;
  fullName?: string;
}

export interface LoginRequest {
  email?: string;
  username?: string;
  identifier?: string;
  password: string;
}

export interface LoginResponse {
  id?: number | string;
  token: string;
  role: UserRole;
  email: string;
  shopId?: number | null;
  fullName?: string;
  shopStatus?: string;
  subscriptionStatus?: string;
}

export interface RegisterFormData {
  fullName: string;
  email: string;
  password: string;
  mobile: string;
  businessName: string;
  businessType?: string;
  businessDescription?: string;
  businessPhone?: string;
  businessEmail?: string;
  yearsInBusiness?: number;
  addressLine1: string;
  addressLine2?: string;
  area?: string;
  city: string;
  district?: string;
  state: string;
  pincode: string;
  fssaiRegistration?: string;
  verificationFile?: File | null;
  latitude?: number;
  longitude?: number;
}
