export interface DailySalesDataPoint {
  date: string;
  dayName: string;
  shortDay: string;
  label: string;
  revenue: number;
  orderCount: number;
  isToday: boolean;
}

export interface PaymentMethodBreakdown {
  method: string;
  label: string;
  orderCount: number;
  revenue: number;
  percentage: number;
}

export interface TopProductMetric {
  name: string;
  quantity: number;
  revenue: number;
  sharePercentage: number;
  imageUrl?: string | null;
}

export interface CodSettlementSummary {
  pendingAmount: number;
  pendingOrders: number;
  collectedAmount: number;
  collectedOrders: number;
  onlineCollectedAmount: number;
  onlineOrders: number;
  totalCollectedAmount: number;
  totalCollectedOrders: number;
}

export interface DashboardAnalytics {
  shopId: number;
  range?: string;
  totalRevenue: number;
  realizedRevenue?: number;
  collectedRevenue?: number;
  totalGrossSales?: number;
  pendingReceivables?: number;
  pendingCodAmount?: number;
  pendingCodOrders?: number;
  collectedCodAmount?: number;
  collectedCodOrders?: number;
  onlineCollectedAmount?: number;
  onlineOrders?: number;
  codSettlement?: CodSettlementSummary;
  totalOrders: number;
  completedOrders?: number;
  inProgressOrders?: number;
  cancelledOrders?: number;
  cancellationRate?: number;
  averageOrderValue?: number;
  periodRevenue?: number;
  periodOrders?: number;
  periodDailyAverage?: number;
  peakDay?: string | null;
  peakDate?: string | null;
  peakAmount?: number;
  dailyData?: DailySalesDataPoint[];
  salesByDay: Record<string, number>;
  topSellingProducts: Record<string, number>;
  topProductsDetails?: TopProductMetric[];
  paymentBreakdown?: PaymentMethodBreakdown[];
  conversionRate?: number;
  activeProductsCount?: number;
  totalCoupons?: number;
  activeCoupons?: number;
  totalDiscountGranted?: number;
  totalCouponOrders?: number;
  couponUtilizationRate?: number;
}

export type DiscountType = 'PERCENTAGE' | 'FLAT';

export interface CouponRecord {
  id: number;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue?: number;
  maxDiscountCap?: number;
  startDate?: string;
  expiryDate?: string;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCouponPayload {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue?: number | null;
  maxDiscountCap?: number | null;
  startDate?: string | null;
  expiryDate?: string | null;
  usageLimit?: number | null;
  isActive?: boolean;
}

export interface Coupon {
  id: string | number;
  code: string;
  discountPercent?: number;
  flatDiscount?: number;
  minOrderAmount?: number;
  validUntil?: string;
  isActive: boolean;
  usageCount?: number;
}

export interface CreateCouponRequest {
  code: string;
  discountPercent?: number;
  flatDiscount?: number;
  minOrderAmount?: number;
  validUntil?: string;
}

export interface OrderItemSummary {
  id: number;
  productNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  variantName?: string;
  dietaryPreference?: string;
  cakeMessage?: string;
  photoReferenceUrl?: string;
  addonsSummary?: string;
  productImageUrl?: string;
}

export interface CustomerOrderSummary {
  id: number;
  orderNumber: string;
  totalAmount: number;
  orderStatus: string;
  paymentStatus: string;
  deliveryAddress?: string;
  deliveryDate?: string;
  couponCode?: string;
  discountAmount?: number;
  createdAt: string;
  items?: OrderItemSummary[];
}

export interface CustomerProfile {
  name: string;
  email?: string;
  mobile?: string;
  address?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: string;
  orderHistory?: CustomerOrderSummary[];
}

export interface OwnerCustomer {
  id: string | number;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalSpend: number;
  lastOrderDate?: string;
  address?: string;
}

export type EnquiryStatus = 'NEW' | 'QUOTED' | 'IN_PROGRESS' | 'FULFILLED' | 'DECLINED' | 'PENDING' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED';

export interface CustomCakeRequest {
  id: number;
  customerName: string;
  customerEmail: string;
  customerMobile?: string;
  occasion?: string;
  cakeType?: string;
  flavour?: string;
  servings?: number;
  designDescription?: string;
  referenceImageUrl?: string;
  budget?: number;
  requiredDate?: string;
  deliveryPreference?: string;
  status: 'PENDING' | 'QUOTED' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED' | string;
  ownerResponse?: string;
  convertedOrderId?: number;
  convertedOrderNumber?: string;
  fieldValues?: Array<{
    id?: number;
    fieldKey: string;
    fieldLabel: string;
    fieldValue: string;
  }>;
  createdAt: string;
  updatedAt?: string;
}

export interface ConvertToOrderPayload {
  agreedPrice?: number;
  deliveryCharge?: number;
  deliveryDate?: string;
  deliveryAddress?: string;
  fulfillmentType?: 'DOORSTEP_DELIVERY' | 'STORE_PICKUP';
  deliverySlotId?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  notes?: string;
}

export interface ConvertToOrderResult {
  orderId: number;
  orderNumber: string;
  customCakeRequestId: number;
  totalAmount: number;
  orderStatus: string;
  paymentStatus: string;
  message: string;
}

export interface GeneralEnquiry {
  id: number;
  customerName: string;
  customerEmail: string;
  customerMobile?: string;
  enquiryType: string;
  message: string;
  ownerReply?: string;
  status: 'NEW' | 'REPLIED' | string;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomCakeEnquiry {
  id: string | number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  occasion: string;
  flavor?: string;
  weightKg?: number;
  budget?: number;
  eventDate: string;
  referenceImageUrl?: string;
  status: EnquiryStatus;
  notes?: string;
  quotedPrice?: number;
  createdAt?: string;
}

export interface FeedbackRecord {
  id: number;
  customerDisplayName: string;
  rating: number;
  comment?: string;
  orderReference?: string;
  productId?: number;
  productName?: string;
  cakeImageUrl?: string;
  cakeVideoUrl?: string;
  customerEmail?: string;
  isApproved?: boolean;
  ownerReply?: string;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BakeryReview {
  id: string | number;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  orderNumber?: string;
  cakeName?: string;
  reply?: string;
  replyDate?: string;
}

export interface ShopSettings {
  id?: string | number;
  businessName: string;
  businessType?: string;
  description?: string;
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
  latitude?: number;
  longitude?: number;
  fssaiRegistration?: string;
  isPureVeg: boolean;
  openingTime?: string;
  closingTime?: string;
  coverImageUrl?: string;
  logoUrl?: string;
  instagramUrl?: string;
  whatsappNumber?: string;
  aboutStory?: string;
  aboutImageUrl?: string;
  showAboutImage?: boolean;
  mapLocationUrl?: string;
  verificationStatus?: 'PROCESSING' | 'VERIFIED' | 'ACTION_REQUIRED' | 'REJECTED' | string;
  status?: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'EXPIRED' | 'INACTIVE' | string;
  isOwnerEnabled?: boolean;
  isMarketplaceRestricted?: boolean;
  marketplaceRestrictionReason?: string | null;
}

export interface SubscriptionPlanSummary {
  id: number;
  name: string;
  description?: string;
  price: number;
  currency: string;
  durationDays: number;
  features?: string;
  isActive: boolean;
}

export type SubscriptionStatusType = 
  | 'PENDING'
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCELLED';

export interface SubscriptionRecord {
  id: number;
  plan?: SubscriptionPlanSummary | null;
  autoRenew: boolean;
  status: SubscriptionStatusType;
  amount: number;
  startDate?: string;
  expiryDate?: string;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMockResult {
  message: string;
  orderId: string;
  paymentId: string;
}

export interface OwnerSubscription {
  planId: string;
  planName: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  status: 'PENDING' | 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'GRACE_PERIOD' | 'SUSPENDED' | 'CANCELLED';
  renewalDate: string;
  ordersProcessedThisMonth: number;
  ordersLimit: number;
  features: string[];
}

export interface OwnerDashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  shopStatus: string;
  subscriptionStatus: string;
  todayRevenue?: number;
  todayDeliveries?: number;
  pendingConfirmationOrders?: number;
  pendingCodOrders?: number;
  pendingCodAmount?: number;
  unscheduledTodayDeliveries?: number;
  pendingCustomEnquiries?: number;
  totalActionItems?: number;
}

export interface ShopPayoutDetails {
  id?: number;
  shopId?: number;
  bankAccountNumber?: string;
  ifscCode?: string;
  beneficiaryName?: string;
  upiId?: string;
  razorpayAccountId?: string;
}

export interface OwnerPaymentRecord {
  id: number;
  amount: number;
  currency: string;
  provider: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  status: string;
  failureReason?: string;
  paidAt?: string;
  createdAt: string;
  subscriptionPlanName?: string;
  invoiceAvailable: boolean;
}

export interface GlobalSearchOrderResult {
  id: number;
  orderNumber: string;
  customerName?: string;
  customerPhone?: string;
  totalAmount: number;
  orderStatus: string;
  paymentStatus: string;
  createdAt: string;
}

export interface GlobalSearchProductResult {
  id: number;
  name: string;
  price: number;
  categoryName?: string;
  imageUrl?: string;
  status: string;
  availability: boolean;
}

export interface GlobalSearchCustomerResult {
  name: string;
  email?: string;
  mobile?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: string;
}

export interface GlobalSearchCustomCakeResult {
  id: number;
  customerName: string;
  occasion?: string;
  flavour?: string;
  budget?: number;
  status: string;
  createdAt: string;
}

export interface GlobalSearchEnquiryResult {
  id: number;
  customerName: string;
  enquiryType: string;
  messageSnippet?: string;
  status: string;
  createdAt: string;
}

export interface GlobalSearchResults {
  orders: GlobalSearchOrderResult[];
  products: GlobalSearchProductResult[];
  customers: GlobalSearchCustomerResult[];
  customCakes: GlobalSearchCustomCakeResult[];
  enquiries: GlobalSearchEnquiryResult[];
}

