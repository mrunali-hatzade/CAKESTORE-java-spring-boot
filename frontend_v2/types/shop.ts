export type ShopStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REJECTED' | 'EXPIRED' | 'INACTIVE' | string;

export interface ShopBanner {
  id?: number;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonUrl?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface ShopBusinessHours {
  id?: number;
  dayOfWeek: string; // MONDAY..SUNDAY
  isOpen: boolean;
  openTime: string; // "09:00"
  closeTime: string; // "21:00"
}

export interface ShopDeliveryConfig {
  id?: number;
  deliveryChargeType: 'FREE' | 'FIXED' | string;
  fixedChargeAmount: number;
  minOrderForFreeDelivery?: number | null;
  deliveryNotes?: string | null;
}

export interface ShopStorefrontSettings {
  id?: number;
  heroBannerEnabled: boolean;
  topRatedEnabled: boolean;
  reviewsEnabled: boolean;
  bakeryInfoEnabled: boolean;
  categoriesEnabled: boolean;
  filtersEnabled: boolean;
  ratingsEnabled: boolean;
  aboutStoryEnabled: boolean;
  aboutImageEnabled: boolean;
  fulfillmentEnabled: boolean;
  leadTimeDays: number;
  leadTimeMessage: string;
  customCakesEnabled: boolean;
  whatsappEnabled: boolean;
  phoneEnabled: boolean;
  emailEnabled: boolean;
  addressEnabled: boolean;
  mapEnabled: boolean;
  businessHoursEnabled: boolean;
  hideStreetAddress?: boolean;
}


export interface ShopCustomFormField {
  id?: number;
  fieldKey: string;
  fieldLabel: string;
  fieldType: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DROPDOWN' | 'RADIO' | 'CHECKBOX' | 'DATE' | 'TIME' | 'IMAGE' | string;
  isRequired: boolean;
  isEnabled: boolean;
  optionsJson?: string | null;
  displayOrder: number;
}

export interface Shop {
  id: number;
  businessName: string;
  businessType?: string;
  businessCategory?: string;
  businessDescription?: string;
  description?: string;
  businessPhone?: string;
  businessEmail?: string;
  phone?: string;
  email?: string;
  address?: string;
  addressLine1: string;
  addressLine2?: string;
  area?: string;
  city: string;
  district?: string;
  state: string;
  pincode: string;
  distanceKm?: number;
  latitude?: number;
  longitude?: number;
  status: ShopStatus;
  verificationStatus?: 'VERIFIED' | 'PROCESSING' | 'UNVERIFIED' | string;
  isOwnerEnabled?: boolean;
  isMarketplaceRestricted?: boolean;
  marketplaceRestrictionReason?: string | null;
  fssaiRegistration?: string;
  yearsInBusiness?: number;
  rating?: number;
  reviewCount?: number;
  imageUrl?: string;
  bannerUrl?: string;
  coverImageUrl?: string;
  logoUrl?: string;
  isPureVeg?: boolean;
  deliveryAvailable?: boolean;
  deliveryTimeMinutes?: number;
  minOrderValue?: number;
  featuredCategory?: string;
  createdAt?: string;
  updatedAt?: string;

  // About & Social
  aboutStory?: string;
  aboutImageUrl?: string;
  showAboutImage?: boolean;
  whatsappNumber?: string;
  mapLocationUrl?: string;

  // Review Summary
  averageRating?: number;
  totalReviews?: number;

  // Storefront Configuration & Components
  banners?: ShopBanner[];
  businessHours?: ShopBusinessHours[];
  deliveryConfig?: ShopDeliveryConfig;
  storefrontSettings?: ShopStorefrontSettings;
  customCakeFormFields?: ShopCustomFormField[];
  socialLinks?: import('./storefrontManagement').ShopSocialLink[];
}


export interface ShopSearchFilters {
  state?: string;
  district?: string;
  city?: string;
  area?: string;
  pincode?: string;
  country?: string;
  businessType?: string;
  search?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  sortBy?: string;
  page?: number;
  size?: number;
}

export interface PopularCity {
  cityName: string;
  stateName?: string;
  activeBakeryCount: number;
}

