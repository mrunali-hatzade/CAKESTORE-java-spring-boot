'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Users,
  UserCheck,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  Plus,
  ArrowLeft,
  Smartphone,
  RefreshCw,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { sendAdminMessage, getAdminBroadcastHistory } from '@/lib/api/admin';
import { SentBroadcastRecord, AdminMessagePayload } from '@/types/admin';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/common/Toast';
import { useRegisterAdminRefresh } from '@/context/AdminRefreshContext';

const STORAGE_KEY = 'cake_admin_broadcast_active_submission';

interface ActiveBroadcastSubmission {
  idempotencyKey: string;
  payload: {
    title: string;
    message: string;
    targetType: 'ALL' | 'SPECIFIC';
    specificOwnerId: number | null;
    sendEmail: boolean;
  };
  submittedAt: number;
  status: 'IN_FLIGHT' | 'UNCERTAIN';
}

export default function AdminMessagesPage() {
  const [broadcasts, setBroadcasts] = useState<SentBroadcastRecord[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const toast = useToast();

  // Form Fields
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<'ALL' | 'SPECIFIC'>('ALL');
  const [specificOwnerId, setSpecificOwnerId] = useState<string>('');
  const [sendEmail, setSendEmail] = useState(true);

  // Uncertain submission state
  const [activeSubmission, setActiveSubmission] = useState<ActiveBroadcastSubmission | null>(null);
  const [showAbandonModal, setShowAbandonModal] = useState(false);

  useRegisterAdminRefresh(
    useCallback(async () => {
      await fetchHistory();
    }, [])
  );

  useEffect(() => {
    fetchHistory();
    restoreActiveSubmission();

    const handleRefresh = () => {
      fetchHistory();
    };
    window.addEventListener('adminGlobalRefresh', handleRefresh);
    return () => {
      window.removeEventListener('adminGlobalRefresh', handleRefresh);
    };
  }, []);

  const restoreActiveSubmission = () => {
    if (typeof window === 'undefined') return;
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: ActiveBroadcastSubmission = JSON.parse(stored);
        setActiveSubmission(parsed);
        setTitle(parsed.payload.title);
        setMessage(parsed.payload.message);
        setTargetType(parsed.payload.targetType);
        setSpecificOwnerId(parsed.payload.specificOwnerId ? String(parsed.payload.specificOwnerId) : '');
        setSendEmail(parsed.payload.sendEmail);
        setIsComposing(true);
      }
    } catch (e) {
      console.error('Failed to restore active broadcast submission', e);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await getAdminBroadcastHistory();
      setBroadcasts(data || []);
    } catch (err) {
      console.error('Failed to load broadcast history', err);
    }
  };

  const executeDispatch = async (idempotencyKey: string, payload: ActiveBroadcastSubmission['payload']) => {
    setIsSending(true);
    try {
      const response = await sendAdminMessage({
        idempotencyKey,
        title: payload.title,
        message: payload.message,
        targetType: payload.targetType,
        specificOwnerId: payload.specificOwnerId,
        sendEmail: payload.sendEmail,
      });

      // Terminal Success (HTTP 200 OK)
      sessionStorage.removeItem(STORAGE_KEY);
      setActiveSubmission(null);
      setTitle('');
      setMessage('');
      setSpecificOwnerId('');
      setSendEmail(true);
      setIsComposing(false);
      fetchHistory();
      toast.success(response || 'Broadcast dispatched successfully. Processing in background.');
    } catch (err: any) {
      const status = err.status || 0;

      if (status === 409) {
        // Terminal Failure / Conflict: Unlock form so admin can adjust message or start fresh
        sessionStorage.removeItem(STORAGE_KEY);
        setActiveSubmission(null);
        toast.error(err.message || 'Conflict: previous broadcast failed or key was reused.');
      } else if (status === 400) {
        // Terminal Validation Rejection: Unlock form so admin can fix fields
        sessionStorage.removeItem(STORAGE_KEY);
        setActiveSubmission(null);
        toast.error(err.message || 'Validation error: please check required fields.');
      } else {
        // Network timeout, connection drop, 5xx, or 429 lock contention -> UNCERTAIN
        const uncertainSubmission: ActiveBroadcastSubmission = {
          idempotencyKey,
          payload,
          submittedAt: Date.now(),
          status: 'UNCERTAIN',
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(uncertainSubmission));
        setActiveSubmission(uncertainSubmission);

        if (status === 429) {
          toast.info('Broadcast record is currently locked by background processing. Please retry in a few seconds.');
        } else {
          toast.error(err.message || 'Network error: outcome uncertain. Form locked to prevent duplicate dispatch.');
        }
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !message.trim()) {
      toast.error('Please complete both the title and message fields');
      return;
    }

    if (targetType === 'SPECIFIC' && !specificOwnerId) {
      toast.error('Please specify a valid Owner User ID');
      return;
    }

    // Generate fresh idempotency key
    const idempotencyKey = crypto.randomUUID();
    const payload = {
      title: title.trim(),
      message: message.trim(),
      targetType,
      specificOwnerId: targetType === 'SPECIFIC' ? Number(specificOwnerId) : null,
      sendEmail,
    };

    const inFlightSubmission: ActiveBroadcastSubmission = {
      idempotencyKey,
      payload,
      submittedAt: Date.now(),
      status: 'IN_FLIGHT',
    };

    // Save in sessionStorage and lock fields immediately
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(inFlightSubmission));
    setActiveSubmission(inFlightSubmission);

    await executeDispatch(idempotencyKey, payload);
  };

  const handleRetry = async () => {
    if (!activeSubmission) return;
    await executeDispatch(activeSubmission.idempotencyKey, activeSubmission.payload);
  };

  const handleConfirmAbandon = () => {
    // Frontend-only local draft discard
    sessionStorage.removeItem(STORAGE_KEY);
    setActiveSubmission(null);
    setShowAbandonModal(false);
    toast.info('Local draft discarded. Composer unlocked.');
  };

  const isFormLocked = isSending || activeSubmission !== null;

  if (isComposing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeSubmission) {
                toast.info('Please resolve or abandon the uncertain submission before exiting.');
                return;
              }
              setIsComposing(false);
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to History
          </Button>
          <div>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-slate-900">
              Compose Broadcast
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Create a new announcement for bakery owners
            </p>
          </div>
        </div>

        {/* Uncertain Submission Alert Banner */}
        {activeSubmission && (
          <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold">Uncertain Submission Status</h4>
                <p className="text-xs text-amber-800 leading-relaxed">
                  The network connection dropped or timed out while dispatching this broadcast. Form fields are locked with the original idempotency key to prevent duplicate sends.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1 pl-8">
              <Button
                size="sm"
                variant="primary"
                onClick={handleRetry}
                disabled={isSending}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSending ? 'animate-spin' : ''}`} />
                <span>{isSending ? 'Checking / Retrying...' : 'Retry / Check Status'}</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAbandonModal(true)}
                disabled={isSending}
                className="border-amber-400 text-amber-900 hover:bg-amber-100 text-xs"
              >
                Abandon Broadcast
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Form Controls */}
          <div>
            <Card className="p-6 border-slate-200 shadow-soft space-y-5">
              <form id="broadcast-form" onSubmit={handleSend} className="space-y-4">
                <Input
                  label="Announcement Title"
                  required
                  placeholder="e.g. Festival Surge Orders Preparation"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isFormLocked}
                />

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Target Audience
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isFormLocked}
                      onClick={() => setTargetType('ALL')}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        targetType === 'ALL'
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      } ${isFormLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>All Owners</span>
                    </button>

                    <button
                      type="button"
                      disabled={isFormLocked}
                      onClick={() => setTargetType('SPECIFIC')}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        targetType === 'SPECIFIC'
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      } ${isFormLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Specific Owner</span>
                    </button>
                  </div>
                </div>

                {targetType === 'SPECIFIC' && (
                  <Input
                    label="Owner User ID"
                    type="number"
                    required
                    placeholder="e.g. 5"
                    value={specificOwnerId}
                    onChange={(e) => setSpecificOwnerId(e.target.value)}
                    helperText="User ID of the bakery owner registered in the database."
                    disabled={isFormLocked}
                  />
                )}

                <Textarea
                  label="Broadcast Message Body"
                  required
                  rows={4}
                  placeholder="Write your platform announcement or operational alert here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isFormLocked}
                />

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="sendEmail"
                    checked={sendEmail}
                    disabled={isFormLocked}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <label htmlFor="sendEmail" className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>Dispatch Email Copy to Owner Inbox</span>
                  </label>
                </div>
              </form>
            </Card>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isSending}
                onClick={() => {
                  if (activeSubmission) {
                    setShowAbandonModal(true);
                  } else {
                    setIsComposing(false);
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="broadcast-form"
                variant="primary"
                disabled={isFormLocked}
                className="bg-indigo-600 hover:bg-indigo-700 border-indigo-700 gap-2"
              >
                <Send className={`w-4 h-4 ${isSending ? 'animate-pulse' : ''}`} />
                <span>{isSending ? 'Dispatching...' : 'Dispatch Broadcast'}</span>
              </Button>
            </div>
          </div>

          {/* Right Column: Live Preview */}
          <div>
            <Card className="p-6 border-slate-200 shadow-soft bg-slate-50/50 sticky top-6">
              <div className="flex items-center gap-2 mb-6">
                <Smartphone className="w-5 h-5 text-slate-500" />
                <h3 className="font-serif font-bold text-sm text-slate-700">Live Preview</h3>
              </div>
              
              <div className="space-y-4">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <Megaphone className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="space-y-1 w-full">
                      <h4 className="text-sm font-bold text-slate-900 break-words">
                        {title || 'Your Title Here'}
                      </h4>
                      <p className="text-xs text-slate-600 break-words whitespace-pre-wrap">
                        {message || 'Your message content will appear here...'}
                      </p>
                      <p className="text-[10px] text-slate-400 pt-2">Just now</p>
                    </div>
                  </div>
                </div>

                {sendEmail && (
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                    <div className="border-b border-slate-100 pb-2 mb-2">
                      <p className="text-[10px] text-slate-400">Subject: {title || 'Your Title Here'}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-slate-600 break-words whitespace-pre-wrap">
                        {message || 'Your email content will appear here...'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Abandon Broadcast Confirmation Modal */}
        {showAbandonModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 text-amber-600">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="font-serif font-bold text-lg text-slate-900">
                  Abandon Uncertain Broadcast?
                </h3>
              </div>

              <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <p className="font-semibold text-slate-800">
                  Warning: The server may still process your original submission.
                </p>
                <p>
                  Abandoning this broadcast only discards your local draft and unlocks the composer. It does <strong>NOT</strong> call the server, cancel background processing, or rollback notifications if the server already accepted your request.
                </p>
                <p>
                  If you submit a new broadcast after abandoning, it will create a <strong>completely separate broadcast</strong> with a new key and will not retry the original.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAbandonModal(false)}
                >
                  Keep Draft & Retry
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleConfirmAbandon}
                >
                  Discard Local Draft & Unlock
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-slate-900">
            Campaign Manager
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            View history and dispatch new broadcasts to bakery owners
          </p>
        </div>
        <Button onClick={() => setIsComposing(true)} variant="primary" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4" />
          Compose Broadcast
        </Button>
      </div>

      {/* Main View: Broadcast History */}
      <Card className="border-slate-200 shadow-soft overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-serif font-bold text-base text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            Broadcast History
          </h3>
          <span className="text-xs font-medium text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200">
            {broadcasts.length} total
          </span>
        </div>
        
        <div className="divide-y divide-slate-100">
          {broadcasts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No broadcasts have been dispatched yet.
            </div>
          ) : (
            broadcasts.map((bcast) => {
              const isFailed = bcast.status === 'FAILED';
              const isReserved = bcast.status === 'RESERVED';

              return (
                <div key={bcast.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 max-w-3xl">
                      <div className="flex items-center gap-3">
                        <h4 className="font-bold text-sm text-slate-900">{bcast.title}</h4>
                        <Badge variant="default" className="text-[10px] bg-white">
                          {bcast.targetType === 'SPECIFIC' ? `Owner User #${bcast.targetOwnerId}` : 'All Bakery Owners'}
                        </Badge>
                        {bcast.sentEmail && (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                            <Mail className="w-3 h-3" />
                            Email Included
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {bcast.message}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-4 text-right shrink-0">
                      <div className="space-y-1">
                        {isFailed ? (
                          <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-red-600">
                            <XCircle className="w-3.5 h-3.5" />
                            Failed
                          </div>
                        ) : isReserved ? (
                          <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-amber-600">
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            Processing...
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-emerald-700">
                            <Clock className="w-3.5 h-3.5" />
                            Attempted ({bcast.recipientCount ?? 0})
                          </div>
                        )}

                        <div className="text-[11px] text-slate-400 font-medium">
                          {new Date(bcast.sentAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
