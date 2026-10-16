export type AdminNotificationType =
  | 'NEW_BAKERY'
  | 'BAKERY_AWAITING_APPROVAL'
  | 'VERIFICATION_SUBMITTED'
  | 'OWNER_FEEDBACK'
  | 'CONTACT_ENQUIRY'
  | 'NEW_ORDER'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FAILED'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_EXPIRING'
  | 'SUBSCRIPTION_EXPIRED'
  | 'BAKERY_SUSPENDED'
  | 'SECURITY_ALERT'
  | 'SYSTEM_ALERT';

export type AdminNotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type AdminNotificationCategory =
  | 'ALL'
  | 'UNREAD'
  | 'BAKERY'
  | 'ORDERS'
  | 'PAYMENTS'
  | 'COMMUNICATION'
  | 'SUBSCRIPTIONS'
  | 'SYSTEM'
  | 'SECURITY';

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  priority: AdminNotificationPriority;
  category?: AdminNotificationCategory;
  createdAt: string;
  isRead: boolean;
  referenceId?: string | number;
  referenceType?: string;
  actionUrl?: string;
}
