'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Mail,
  Search,
  Check,
  User,
  Phone,
  Calendar,
  Inbox,
  RefreshCw,
  Reply,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { communicationApi } from '@/lib/api/communication';
import { ContactEnquiry } from '@/types/communication';
import { useToast } from '@/components/common/Toast';

export default function AdminContactEnquiriesPage() {
  const toast = useToast();
  const [enquiries, setEnquiries] = useState<ContactEnquiry[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEnquiry, setSelectedEnquiry] = useState<ContactEnquiry | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

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

  const fetchEnquiries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { page, size: 20 };
      if (selectedFilter === 'UNREAD') params.isRead = false;
      if (selectedFilter === 'READ') params.isRead = true;
      if (debouncedSearch.trim()) params.search = debouncedSearch;

      const data = await communicationApi.getContactEnquiries(params);
      setEnquiries(data?.content || []);
      setTotalPages(data?.totalPages || 0);

      if (selectedFilter === 'UNREAD' && !debouncedSearch.trim()) {
        setUnreadCount(data?.totalElements || 0);
      } else {
        const unreadData = await communicationApi.getContactEnquiries({ isRead: false, page: 0, size: 1 });
        setUnreadCount(unreadData?.totalElements || 0);
      }
    } catch {
      setEnquiries([]);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, selectedFilter, debouncedSearch]);

  useEffect(() => {
    fetchEnquiries();

    const handleRefresh = () => {
      fetchEnquiries();
    };
    window.addEventListener('adminGlobalRefresh', handleRefresh);
    return () => {
      window.removeEventListener('adminGlobalRefresh', handleRefresh);
    };
  }, [fetchEnquiries]);

  const handleMarkRead = async (id: string | number) => {
    await communicationApi.markContactEnquiryRead(id);
    setEnquiries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );
    if (selectedEnquiry?.id === id) {
      setSelectedEnquiry((prev) => (prev ? { ...prev, isRead: true } : null));
    }
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleSendReply = async () => {
    if (!selectedEnquiry) return;
    if (!replyText.trim()) {
      toast.error('Reply message cannot be empty');
      return;
    }

    try {
      setIsSending(true);
      await communicationApi.replyToEnquiry(selectedEnquiry.id, replyText);
      toast.success('Reply sent successfully');
      setSelectedEnquiry((prev) =>
        prev
          ? {
              ...prev,
              adminReply: replyText.trim(),
              repliedAt: new Date().toISOString(),
              isRead: true,
            }
          : null
      );
      setReplyText('');
      setIsReplying(false);
      fetchEnquiries();
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
                Enquiries
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
              placeholder="Search enquiries..."
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
          ) : enquiries.length === 0 ? (
            <div className="text-center py-10">
              <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No enquiries found.</p>
            </div>
          ) : (
            enquiries.map((e) => (
              <div
                key={e.id}
                onClick={() => {
                  setSelectedEnquiry(e);
                  setIsReplying(false);
                  setReplyText('');
                  if (!e.isRead) handleMarkRead(e.id);
                }}
                className={`p-3 rounded-xl cursor-pointer border transition-all ${
                  selectedEnquiry?.id === e.id
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : !e.isRead
                    ? 'border-indigo-100 bg-indigo-50/20 hover:border-indigo-300'
                    : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-xs truncate mr-2 ${!e.isRead ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                    {e.name}
                  </span>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                    {formatDateTime(e.createdAt).split(',')[0]}
                  </span>
                </div>
                <div className="text-xs font-medium text-slate-800 truncate mb-1">
                  {e.subject}
                </div>
                <div className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  {e.message}
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
        {!selectedEnquiry ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
            <Mail className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm font-medium">Select a message to read</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Reading Pane Header */}
            <div className="p-5 border-b border-slate-100 shrink-0 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 mb-3 break-words">
                  {selectedEnquiry.subject}
                </h2>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                    {selectedEnquiry.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 truncate">
                        {selectedEnquiry.name}
                      </span>
                      <span className="text-xs text-slate-500 truncate">
                        &lt;{selectedEnquiry.email}&gt;
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateTime(selectedEnquiry.createdAt)}
                      </span>
                      {selectedEnquiry.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {selectedEnquiry.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                {!selectedEnquiry.isRead && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMarkRead(selectedEnquiry.id)}
                    className="text-xs gap-1.5 h-8"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark Read</span>
                  </Button>
                )}
                <button
                  onClick={() => setIsReplying(!isReplying)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors h-8"
                >
                  <Reply className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>
              </div>
            </div>

            {/* Reading Pane Body */}
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed text-[13px]">
                {selectedEnquiry.message}
              </div>

              {selectedEnquiry.adminReply && (
                <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Reply className="w-3.5 h-3.5 text-indigo-600" />
                      Admin Reply
                    </span>
                    {selectedEnquiry.repliedAt && (
                      <span className="text-[11px] text-slate-400">
                        {formatDateTime(selectedEnquiry.repliedAt)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {selectedEnquiry.adminReply}
                  </div>
                </div>
              )}
              
              {isReplying && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply here..."
                    className="w-full min-h-[120px] p-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y mb-3"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setIsReplying(false); setReplyText(''); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSendReply}
                      disabled={isSending || !replyText.trim()}
                    >
                      {isSending ? 'Sending...' : 'Send Reply'}
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

