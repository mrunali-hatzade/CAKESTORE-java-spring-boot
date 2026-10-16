'use client';

import React, { useState } from 'react';
import {
  Star,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { communicationApi } from '@/lib/api/communication';
import { PlatformFeedbackCategory } from '@/types/communication';

interface OwnerFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES: { label: string; value: PlatformFeedbackCategory }[] = [
  { label: 'General Experience', value: 'GENERAL' },
  { label: 'Dashboard & Navigation', value: 'DASHBOARD' },
  { label: 'Orders & Kitchen Flow', value: 'ORDERS' },
  { label: 'Payments & Payouts', value: 'PAYMENTS' },
  { label: 'Storefront & Customer View', value: 'STOREFRONT' },
  { label: 'Subscription & Plans', value: 'SUBSCRIPTION' },
  { label: 'Feature Request / Idea', value: 'FEATURE_REQUEST' },
];

export default function OwnerFeedbackModal({ isOpen, onClose }: OwnerFeedbackModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [category, setCategory] = useState<PlatformFeedbackCategory>('GENERAL');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setErrorMsg('Please enter your feedback or improvement suggestions.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await communicationApi.submitPlatformFeedback({
        rating,
        category,
        message: message.trim(),
      });
      setIsSubmitted(true);
    } catch (err: any) {
      const error =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to submit feedback. Please try again.';
      setErrorMsg(error);
      // Feedback message and rating are deliberately preserved in state
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setIsSubmitted(false);
    setMessage('');
    setRating(5);
    setCategory('GENERAL');
    setErrorMsg(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleResetAndClose} title="Platform Feedback">
      {isSubmitted ? (
        <div className="py-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="font-serif font-bold text-xl text-owner-heading">
            Thank You for Your Feedback!
          </h3>
          <p className="text-xs text-owner-muted max-w-sm mx-auto leading-relaxed">
            Your insights directly guide our engineering and design roadmap for the CakeStore platform.
          </p>
          <div className="pt-2">
            <Button onClick={handleResetAndClose} size="sm">
              Close
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Context Explainer Banner */}
          <div className="p-3.5 rounded-2xl bg-brand-blush/60 border border-brand-blush-border flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-brand-plum shrink-0 mt-0.5" />
            <p className="text-xs text-brand-plum leading-relaxed">
              <strong>How is CakeStore helping your business?</strong> This feedback goes directly to our platform product team to help improve your bakery dashboard and tools.
            </p>
          </div>

          {/* Star Rating */}
          <div>
            <label className="block text-xs font-semibold text-owner-heading mb-1.5">
              Overall Platform Rating
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 text-slate-300 hover:scale-110 transition-transform focus:outline-none"
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${
                      (hoverRating || rating) >= star
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-bold text-slate-700 ml-2">
                {rating === 5 && 'Outstanding! 🌟'}
                {rating === 4 && 'Very Good 👍'}
                {rating === 3 && 'Average 🙂'}
                {rating === 2 && 'Needs Improvement ⚠️'}
                {rating === 1 && 'Poor Experience ❌'}
              </span>
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-semibold text-owner-heading mb-1.5">
              Topic / Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PlatformFeedbackCategory)}
              className="w-full px-3 py-2 rounded-xl border border-owner-border text-xs text-owner-heading bg-white focus:outline-none focus:ring-2 focus:ring-brand-plum/20"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Feedback Textarea */}
          <div>
            <Textarea
              label="What can we improve?"
              required
              rows={4}
              placeholder="Tell us what you love, what features you need, or what feels slow or confusing..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              error={errorMsg || undefined}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetAndClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Feedback'}</span>
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
