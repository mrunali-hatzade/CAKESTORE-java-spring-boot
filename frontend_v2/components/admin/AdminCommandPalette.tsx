'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, LayoutDashboard, Store, CreditCard, ShoppingBag, Receipt,
  MessageSquare, MessageCircle, Mail, Bell, X, ArrowRight, Loader2,
  ShieldAlert
} from 'lucide-react';
import { getAllShops } from '@/lib/api/admin';
import { communicationApi } from '@/lib/api/communication';
import { adminNotificationsApi } from '@/lib/api/adminNotifications';

interface AdminCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavShortcut {
  id: string;
  type: 'shortcut';
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STATIC_NAV_SHORTCUTS: NavShortcut[] = [
  { id: 'nav-dashboard', type: 'shortcut', label: 'Platform Overview', description: 'View platform revenue and metrics', href: '/admin', icon: LayoutDashboard },
  { id: 'nav-shops', type: 'shortcut', label: 'Bakery Management', description: 'Approve KYC and manage shops', href: '/admin/shops', icon: Store },
  { id: 'nav-orders', type: 'shortcut', label: 'Orders Ledger', description: 'Cross-shop retail orders and status', href: '/admin/orders', icon: ShoppingBag },
  { id: 'nav-payments', type: 'shortcut', label: 'Payments Ledger', description: 'Cross-shop gateway transactions and GMV', href: '/admin/payments', icon: Receipt },
  { id: 'nav-plans', type: 'shortcut', label: 'Plans & Subscriptions', description: 'Manage pricing and billing', href: '/admin/plans', icon: CreditCard },
  { id: 'nav-feedback', type: 'shortcut', label: 'Platform Feedback', description: 'Read reviews from owners', href: '/admin/feedback', icon: MessageSquare },
  { id: 'nav-enquiries', type: 'shortcut', label: 'Contact Enquiries', description: 'Read messages from public users', href: '/admin/enquiries', icon: MessageCircle },
  { id: 'nav-broadcasts', type: 'shortcut', label: 'Broadcasts', description: 'Send mass emails and alerts', href: '/admin/messages', icon: Mail },
  { id: 'nav-notifications', type: 'shortcut', label: 'Notifications', description: 'View your platform alerts', href: '/admin/notifications', icon: Bell },
  { id: 'nav-settings', type: 'shortcut', label: 'Global Settings', description: 'Platform configuration and security', href: '/admin/settings', icon: ShieldAlert },
];

export const AdminCommandPalette: React.FC<AdminCommandPaletteProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Dynamic search states
  const [isSearching, setIsSearching] = useState(false);
  const [shopResults, setShopResults] = useState<any[]>([]);
  const [feedbackResults, setFeedbackResults] = useState<any[]>([]);
  const [enquiryResults, setEnquiryResults] = useState<any[]>([]);
  const [notificationResults, setNotificationResults] = useState<any[]>([]);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setShopResults([]);
      setFeedbackResults([]);
      setEnquiryResults([]);
      setNotificationResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced multi-search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setIsSearching(false);
      setShopResults([]);
      setFeedbackResults([]);
      setEnquiryResults([]);
      setNotificationResults([]);
      return;
    }

    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const [shopsRes, feedRes, enqRes, notifRes] = await Promise.all([
          getAllShops(0, 3, trimmed),
          communicationApi.getPlatformFeedback({ search: trimmed, page: 0, size: 2 }).catch(() => ({ content: [] })),
          communicationApi.getContactEnquiries({ search: trimmed, page: 0, size: 2 }).catch(() => ({ content: [] })),
          adminNotificationsApi.getNotifications({ search: trimmed, page: 0, size: 3 }).catch(() => ({ content: [] }))
        ]);
        
        setShopResults(shopsRes.content || []);
        setFeedbackResults((feedRes as any).content || []);
        setEnquiryResults((enqRes as any).content || []);
        setNotificationResults((notifRes as any).content || []);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [query]);

  const filteredShortcuts = STATIC_NAV_SHORTCUTS.filter(s => 
    s.label.toLowerCase().includes(query.toLowerCase()) || 
    s.description.toLowerCase().includes(query.toLowerCase())
  );

  // Flatten all items for keyboard navigation
  const allItems = [
    ...shopResults.map(s => ({ ...s, _type: 'shop' })),
    ...feedbackResults.map(f => ({ ...f, _type: 'feedback' })),
    ...enquiryResults.map(e => ({ ...e, _type: 'enquiry' })),
    ...notificationResults.map(n => ({ ...n, _type: 'notification' })),
    ...filteredShortcuts.map(s => ({ ...s, _type: 'shortcut' })),
  ];
  
  const hasExternalSearchFallback = query.trim().length > 0;
  const totalItems = allItems.length + (hasExternalSearchFallback ? 1 : 0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, shopResults, feedbackResults, enquiryResults, notificationResults]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (totalItems === 0) return;
      
      if (selectedIndex < allItems.length) {
        const item = allItems[selectedIndex];
        if (item._type === 'shortcut') handleSelect(item.href);
        if (item._type === 'shop') handleSelect(`/admin/shops/${item.id}`);
        if (item._type === 'feedback') handleSelect(`/admin/feedback?search=${encodeURIComponent(item.subject || query)}`);
        if (item._type === 'enquiry') handleSelect(`/admin/enquiries?search=${encodeURIComponent(item.subject || query)}`);
      } else {
        // Fallback generic search
        handleSelect(`/admin/shops?search=${encodeURIComponent(query.trim())}`);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleSelect = (href: string) => {
    router.push(href);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[20vh] px-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center px-4 border-b border-slate-100">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 px-4 py-4 text-base outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
            placeholder="Search bakeries, owners, feedback, or type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {isSearching ? (
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin mr-2" />
          ) : (
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200">
          
          {/* Dynamic Results */}
          {query.trim().length > 1 && (
            <div className="px-2 py-1.5 mb-2">
              <div className="text-xs font-semibold text-slate-500 mb-2 px-2">Live Search Results</div>
              
              {shopResults.map((shop, i) => {
                const globalIndex = allItems.findIndex(x => x._type === 'shop' && x.id === shop.id);
                const isSelected = selectedIndex === globalIndex;
                return (
                  <button
                    key={`shop-${shop.id}`}
                    onClick={() => handleSelect(`/admin/shops/${shop.id}`)}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors mb-1 ${isSelected ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                        <Store className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{shop.name} <span className="text-xs font-normal text-slate-400 ml-1">Bakery</span></div>
                        <div className={`text-xs ${isSelected ? 'text-indigo-600/70' : 'text-slate-500'}`}>{shop.ownerName}  {shop.city}</div>
                      </div>
                    </div>
                    <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                  </button>
                );
              })}

              {feedbackResults.map((fb, i) => {
                const globalIndex = allItems.findIndex(x => x._type === 'feedback' && x.id === fb.id);
                const isSelected = selectedIndex === globalIndex;
                return (
                  <button
                    key={`fb-${fb.id}`}
                    onClick={() => handleSelect(`/admin/feedback?search=${encodeURIComponent(fb.subject)}`)}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors mb-1 ${isSelected ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{fb.subject} <span className="text-xs font-normal text-slate-400 ml-1">Feedback</span></div>
                        <div className={`text-xs ${isSelected ? 'text-indigo-600/70' : 'text-slate-500'}`}>From Shop #{fb.shopId}</div>
                      </div>
                    </div>
                    <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                  </button>
                );
              })}
              
              {enquiryResults.map((eq, i) => {
                const globalIndex = allItems.findIndex(x => x._type === 'enquiry' && x.id === eq.id);
                const isSelected = selectedIndex === globalIndex;
                return (
                  <button
                    key={`eq-${eq.id}`}
                    onClick={() => handleSelect(`/admin/enquiries?search=${encodeURIComponent(eq.subject)}`)}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors mb-1 ${isSelected ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{eq.subject} <span className="text-xs font-normal text-slate-400 ml-1">Enquiry</span></div>
                        <div className={`text-xs ${isSelected ? 'text-indigo-600/70' : 'text-slate-500'}`}>From {eq.name}</div>
                      </div>
                    </div>
                    <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                  </button>
                );
              })}

              
              {notificationResults.map((notif, i) => {
                const globalIndex = allItems.findIndex(x => x._type === 'notification' && x.id === notif.id);
                const isSelected = selectedIndex === globalIndex;
                return (
                  <button
                    key={`notif-${notif.id}`}
                    onClick={() => handleSelect(`/admin/notifications?search=${encodeURIComponent(notif.title)}`)}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors mb-1 ${isSelected ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{notif.title} <span className="text-xs font-normal text-slate-400 ml-1">Alert</span></div>
                        <div className={`text-xs ${isSelected ? 'text-indigo-600/70' : 'text-slate-500'}`}>{notif.message.substring(0, 50)}...</div>
                      </div>
                    </div>
                    <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                  </button>
                );
              })}

              {!isSearching && shopResults.length === 0 && feedbackResults.length === 0 && enquiryResults.length === 0 && notificationResults.length === 0 && (
                <div className="text-center py-6 text-sm text-slate-500">
                  No exact matches found. Press Enter to force a deep directory search.
                </div>
              )}
            </div>
          )}

          {/* Navigation Shortcuts */}
          {filteredShortcuts.length > 0 && (
            <div className="px-2 py-1.5">
              <div className="text-xs font-semibold text-slate-500 mb-2 px-2">Shortcuts</div>
              {filteredShortcuts.map((shortcut) => {
                const Icon = shortcut.icon;
                const globalIndex = allItems.findIndex(x => x._type === 'shortcut' && x.id === shortcut.id);
                const isSelected = selectedIndex === globalIndex;
                return (
                  <button
                    key={shortcut.id}
                    onClick={() => handleSelect(shortcut.href)}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors mb-1 ${isSelected ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-white text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-500'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{shortcut.label}</div>
                        <div className={`text-xs ${isSelected ? 'text-slate-600' : 'text-slate-500'}`}>{shortcut.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-white font-mono shadow-sm"></kbd> to navigate</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-white font-mono shadow-sm">Enter </kbd> to select</span>
          </div>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-white font-mono shadow-sm">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};
