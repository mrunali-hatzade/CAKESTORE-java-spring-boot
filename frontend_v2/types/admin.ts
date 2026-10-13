export interface DashboardStats {
  totalAdmins?: number;
  totalShopOwners?: number;
  totalRegisteredBakeries?: number;
  activeBakeries?: number;
  pendingBakeries?: number;
  suspendedBakeries?: number;
  inactiveBakeries?: number;
  activeSubscribedBakeries?: number;
  expiredSubscribedBakeries?: number;
  pendingPaymentBakeries?: number;
  expiringSoonSubscribedBakeries?: number;
  gracePeriodSubscribedBakeries?: number;
  totalShops: number;
  activeShops: number;
  suspendedShops: number;
  inactiveShops: number;
  pendingShops: number;
  totalUsers: number;
  todayRegistrations: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  todayPayments: number;
  monthlyPlatformRevenue: number;
  totalPlatformRevenue: number;
  monthlyGmv: number;
  totalGmv: number;
  totalCustomers?: number;
  totalSubscriptions?: number;
  deletedAccounts?: number;
  deletedBakeries?: number;
  suspendedSubscribedBakeries?: number;
  cancelledSubscribedBakeries?: number;
  periodPlatformRevenue?: number;
  periodGmv?: number;
}

export interface BusinessDocumentItem {
  id: number;
  documentType: string;
  fileUrl: string;
  status: 'PROCESSING' | 'VERIFIED' | 'ACTION_REQUIRED' | 'REJECTED' | string;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminShopSummary {
  shopId: number;
  businessName: string;
  ownerName?: string;
  ownerEmail?: string;
  shopStatus: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REJECTED' | string;
  subscriptionStatus?: string;
  registeredAt: string;
}

export interface AdminShopDetails {
  shop: {
    id: number;
    businessName: string;
    description?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    fssaiRegistration?: string;
    status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REJECTED' | string;
    verificationStatus?: 'PROCESSING' | 'VERIFIED' | 'ACTION_REQUIRED' | 'REJECTED' | string;
    isPureVeg?: boolean;
    createdAt: string;
    updatedAt: string;
  };
  subscriptions?: {
    id: number;
    planName?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    amount?: number;
  }[];
  payments?: {
    id: number;
    amount: number;
    currency?: string;
    provider?: string;
    providerOrderId?: string;
    providerPaymentId?: string;
    status: string;
    failureReason?: string;
    paidAt?: string;
    createdAt: string;
  }[];
  activityLogs?: {
    id: number;
    action: string;
    details?: string;
    metadata?: string;
    createdAt?: string;
    timestamp?: string;
  }[];
  businessDocuments?: BusinessDocumentItem[];
  totalProducts: number;
  totalOrders: number;
  totalRevenue?: number;
  monthlyRevenue?: number;
  weeklyRevenue?: number;
  completedOrders?: number;
  cancelledOrders?: number;
  avgOrderValue?: number;
}

export interface AdminPlan {
  id: number;
  name: string;
  description?: string;
  billingCycle?: string;
  price: number;
  currency: string;
  durationDays: number;
  features?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminMessagePayload {
  title: string;
  message: string;
  specificOwnerId?: number | null;
  sendEmail?: boolean;
}

export interface SentBroadcastRecord {
  id: string;
  title: string;
  message: string;
  targetType: string;
  targetOwnerId?: number;
  sentAt: string;
  recipientCount: number;
}

// ==========================================
// ADMIN ORDERS & PAYMENTS LEDGER DTOs
// ==========================================

export interface AdminOrderSummary {
  id: number;
  orderNumber: string;
  shopId: number | null;
  shopName: string | null;
  customerName: string;
  customerPhoneMasked: string | null;
  customerEmailMasked: string | null;
  totalAmount: number;
  subtotal: number;
  deliveryCharge: number;
  discountAmount: number;
  couponCode: string | null;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  transactionId: string | null;
  itemCount: number;
  deliveryDate: string | null;
  deliverySlotDetails: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface AdminOrderItemDto {
  id: number;
  productId: number | null;
  productNameSnapshot: string;
  variantName: string | null;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  dietaryPreference: string | null;
  cakeMessage: string | null;
  addonsSummary: string | null;
  productImageUrl: string | null;
}

export interface AdminOrderDetail {
  id: number;
  orderNumber: string;
  shopId: number | null;
  shopName: string | null;
  shopPhone: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string;
  specialInstructions: string | null;
  subtotal: number;
  deliveryCharge: number;
  discountAmount: number;
  totalAmount: number;
  couponCode: string | null;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  transactionId: string | null;
  razorpayOrderId: string | null;
  deliveryDate: string | null;
  deliverySlotDetails: string | null;
  createdAt: string;
  paidAt: string | null;
  items: AdminOrderItemDto[];
}

export interface AdminPaymentSummary {
  id: number;
  shopId: number | null;
  shopName: string | null;
  transactionType: 'SUBSCRIPTION' | 'RETAIL_ORDER' | 'UNKNOWN' | string;
  financialClassification: 'PLATFORM_REVENUE' | 'NETWORK_GMV_ZERO_COMMISSION' | 'UNLINKED_TRANSACTION' | string;
  associationState: 'SUBSCRIPTION_LINKED' | 'ORDER_MATCHED' | 'UNLINKED_GATEWAY_RECORD' | string;
  planName: string | null;
  relatedOrderNumber: string | null;
  relatedOrderId: number | null;
  amount: number;
  currency: string;
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  gatewayStatus: 'COMPLETED' | 'PENDING' | 'FAILED' | string;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface AdminSubscriptionSnapshot {
  subscriptionId: number | null;
  planName: string | null;
  amount: number;
  status: string | null;
  startDate: string | null;
  expiryDate: string | null;
}

export interface AdminOrderSnapshot {
  orderId: number;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  totalAmount: number;
  customerName: string;
  deliveryDate: string | null;
  deliverySlotDetails: string | null;
  createdAt: string;
}

export interface AdminPaymentDetail {
  id: number;
  shopId: number | null;
  shopName: string | null;
  shopPhone: string | null;
  shopEmail: string | null;
  transactionType: 'SUBSCRIPTION' | 'RETAIL_ORDER' | 'UNKNOWN' | string;
  financialClassification: 'PLATFORM_REVENUE' | 'NETWORK_GMV_ZERO_COMMISSION' | 'UNLINKED_TRANSACTION' | string;
  associationState: 'SUBSCRIPTION_LINKED' | 'ORDER_MATCHED' | 'UNLINKED_GATEWAY_RECORD' | string;
  planName: string | null;
  relatedOrderNumber: string | null;
  relatedOrderId: number | null;
  amount: number;
  currency: string;
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  gatewayStatus: string;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  subscriptionDetails: AdminSubscriptionSnapshot | null;
  orderDetails: AdminOrderSnapshot | null;
}

