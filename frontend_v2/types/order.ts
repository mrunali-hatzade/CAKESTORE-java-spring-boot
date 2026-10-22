export type OrderStatus =
  | 'NEW'
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface PaginatedResponse<T> {
  content: T[];
  pageable: any;
  totalElements: number;
  totalPages: number;
  last: boolean;
  size: number;
  number: number;
  sort: any;
  numberOfElements: number;
  first: boolean;
  empty: boolean;
}

export interface OrderItem {
  id?: number;
  productId?: number;
  productName?: string;
  productNameSnapshot?: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  variantName?: string;
  dietaryPreference?: string;
  cakeMessage?: string;
  customMessage?: string;
  photoReferenceUrl?: string;
  addonsSummary?: string;
  productImageUrl?: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  shopId?: number;
  shopName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  fulfillmentMethod?: 'HOME_DELIVERY' | 'SELF_PICKUP';
  deliveryDate?: string;
  deliverySlotId?: number;
  deliverySlotDetails?: string;
  subtotal?: number;
  deliveryCharge?: number;
  totalAmount: number;
  discountAmount?: number;
  status: OrderStatus;
  orderStatus?: string;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | string;
  paymentMethod?: string;
  transactionId?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt?: string;
  couponCode?: string;
  specialInstructions?: string;
  items?: OrderItem[];
}

export interface GuestOrderRequest {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: 'COD' | 'ONLINE_PAYMENT';
  deliveryAddress?: string;
  deliveryDate?: string;
  deliverySlotId?: number;
  specialInstructions?: string;
  couponCode?: string;
  fulfillmentMethod?: 'HOME_DELIVERY' | 'SELF_PICKUP';
  expectedDeliveryFee?: number;
  expectedTotal?: number;
  confirmPriceChange?: boolean;
  items: {
    productId: number;
    quantity: number;
    customMessage?: string;
    variantId?: number;
    addonIds?: number[];
    dietaryPreference?: string;
    cakeMessage?: string;
  }[];
}
