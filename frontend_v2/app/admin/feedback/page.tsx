'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MessageCircle,
  Star,
  Search,
  Check,
  Store,
  User,
  Calendar,
  Inbox,
  RefreshCw,
  Reply,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { communicationApi } from '@/lib/api/communication';
import { PlatformFeedback } from '@/types/communication';
import { useToast } from '@/components/common/Toast';

export default function AdminPlatformFeedbackPage() {
  const [feedbackList, setFeedbackList] = useState<PlatformFeedback[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<PlatformFeedback | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const toast = useToast();
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [selectedFilter, debouncedSearch]);

  const fetchFeedback = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { page, size: 20 };
      if (selectedFilter === 'UNREAD') params.isRead = false;
      if (selectedFilter === 'READ') params.isRead = true;
      if (debouncedSearch.trim()) params.search = debouncedSearch;

      const data = await communicationApi.getPlatformFeedback(params);
      setFeedbackList(data?.content || []);
      setTotalPages(data?.totalPages || 0);

      if (selectedFilter === 'UNREAD' && !debouncedSearch.trim()) {
        setUnreadCount(data?.totalElements || 0);
      } else {
        const unreadData = await communicationApi.getPlatformFeedback({ isRead: false, page: 0, size: 1 });
        setUnreadCount(unreadData?.totalElements || 0);
      }
    } catch {
      setFeedbackList([]);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, selectedFilter, debouncedSearch]);

  useEffect(() => {
    fetchFeedback();

    const handleRefresh = () => {
      fetchFeedback();
    };
    window.addEventListener('adminGlobalRefresh', handleRefresh);
    return () => {
      window.removeEventListener('adminGlobalRefresh', handleRefresh);
    };
  }, [fetchFeedback]);

  const handleMarkRead = async (id: string | number) => {
    await communicationApi.markPlatformFeedbackRead(id);
    setFeedbackList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );
    if (selectedFeedback?.id === id) {
      setSelectedFeedback((prev) => (prev ? { ...prev, isRead: true } : null));
    }
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleSendReply = async () => {
    if (!selectedFeedback) return;
    if (!replyText.trim()) {
      toast.error('Reply message cannot be empty');
      return;
    }

    try {
      setIsSending(true);
      await communicationApi.replyToFeedback(selectedFeedback.id, replyText);
      toast.success('Reply sent successfully');
      setReplyText('');
      setIsReplying(false);
      fetchFeedback();
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to send reply. Please try again.';
      toast.error(errorMsg);
      // Draft replyText is deliberately preserved so admin does not lose their input
    } finally {
      setIsSending(false);
    }
  };

  const formatDateTime = (dateVal?: string | Date | null) => {
    if (!dateVal) return 'N/A';
    try {
      const d = new Date(dateVal);
      return isNaN(d.getTime())
        ? 'N/A'
        : d.toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[600px] h-[calc(100vh-200px)]">
      {/* Left Column (List Pane) */}
      <div className="w-full lg:w-[380px] flex flex-col gap-4 h-full border-r border-slate-200 pr-0 lg:pr-6">
        {/* Header */}
        <div className="flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="font-serif font-bold text-xl text-slate-900">
                Feedback
              </h1>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                  {unreadCount} Unread
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search feedback..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100/50 rounded-xl">
            <button
              onClick={() => setSelectedFilter('ALL')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedFilter('UNREAD')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                selectedFilter === 'UNREAD'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Unread
              {unreadCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              )}
            </button>
            <button
              onClick={() => setSelectedFilter('READ')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedFilter === 'READ'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Read
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {isLoading ? (
            <LoadingState message="Loading..." />
          ) : feedbackList.length === 0 ? (
            <div className="text-center py-10">
              <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No feedback found.</p>
            </div>
          ) : (
            feedbackList.map((f) => (
              <div
                key={f.id}
                onClick={() => {
                  setSelectedFeedback(f);
                  if (!f.isRead) handleMarkRead(f.id);
                }}
                className={`p-3 rounded-xl cursor-pointer border transition-all ${
                  selectedFeedback?.id === f.id
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : !f.isRead
                    ? 'border-indigo-100 bg-indigo-50/20 hover:border-indigo-300'
                    : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-xs truncate mr-2 ${!f.isRead ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                    {f.shopName || `Bakery #${f.shopId || '—'}`}
                  </span>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                    {formatDateTime(f.createdAt).split(',')[0]}
                  </span>
                </div>
                <div className="flex items-center gap-1 mb-1.5">
                  <div className="flex items-center text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          i < f.rating ? 'fill-amber-400' : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  {f.category && (
                    <span className="text-[9px] uppercase font-bold text-slate-500 ml-2">
                      {f.category.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  {f.message}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center pt-3 border-t border-slate-100 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="text-xs h-8"
            >
              Prev
            </Button>
            <span className="text-[10px] text-slate-500">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="text-xs h-8"
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Right Column (Reading Pane) */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm h-full">
        {!selectedFeedback ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
            <MessageCircle className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm font-medium">Select a message to read</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Reading Pane Header */}
            <div className="p-5 border-b border-slate-100 shrink-0 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-lg font-bold text-slate-900 break-words">
                    {selectedFeedback.shopName || `Bakery #${selectedFeedback.shopId || '—'}`}
                  </h2>
                  {selectedFeedback.category && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {selectedFeedback.category.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                    <Store className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 truncate">
                        {selectedFeedback.ownerName || selectedFeedback.ownerEmail || 'Owner'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateTime(selectedFeedback.createdAt)}
                      </span>
                      <div className="flex items-center text-amber-400 ml-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < selectedFeedback.rating ? 'fill-amber-400' : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsReplying(!isReplying)}
                  className="text-xs gap-1.5 h-8"
                >
                  <Reply className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </Button>
                {!selectedFeedback.isRead && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMarkRead(selectedFeedback.id)}
                    className="text-xs gap-1.5 h-8"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark Read</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Reading Pane Body */}
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed text-[13px] mb-6">
                {selectedFeedback.message}
              </div>
              
              {isReplying && (
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Reply to Feedback</h3>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply here..."
                    className="w-full p-3 border rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 mb-3 min-h-[120px] resize-y"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsReplying(false)}
                      disabled={isSending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSendReply}
                      isLoading={isSending}
                      disabled={isSending || !replyText.trim()}
                    >
                      Send Reply
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
