import { apiClient } from './client';
import {
  AdminNotification,
  AdminNotificationCategory,
} from '@/types/adminNotifications';
import { PaginatedResponse } from '@/types/order';

export const adminNotificationsApi = {
  /**
   * Super Admin: Fetch notifications filtered by category, read state, or search.
   */
  async getNotifications(params?: {
    category?: AdminNotificationCategory;
    isRead?: boolean;
    search?: string;
    page?: number;
    size?: number;
  }): Promise<PaginatedResponse<AdminNotification>> {
    try {
      return await apiClient.get<PaginatedResponse<AdminNotification>>('/api/admin/notifications', { params });
    } catch (err: any) {
      if (err?.status === 404 || err?.status === 500) {
        return { 
          content: [], 
          totalElements: 0, 
          totalPages: 0, 
          size: 20, 
          number: 0,
          pageable: null,
          last: true,
          sort: null,
          numberOfElements: 0,
          first: true,
          empty: true
        };
      }
      throw err;
    }
  },

  /**
   * Super Admin: Get unread notifications count for badge.
   */
  async getUnreadCount(): Promise<number> {
    try {
      const res = await apiClient.get<{ unreadCount: number }>('/api/admin/notifications/unread-count');
      return res.unreadCount ?? 0;
    } catch (err: any) {
      return 0;
    }
  },

  /**
   * Super Admin: Mark single notification as read.
   */
  async markAsRead(id: string): Promise<void> {
    await apiClient.patch(`/api/admin/notifications/${id}/read`, {});
  },

  /**
   * Super Admin: Mark all notifications as read.
   */
  async markAllAsRead(): Promise<void> {
    await apiClient.post('/api/admin/notifications/mark-all-read', {});
  },
};
