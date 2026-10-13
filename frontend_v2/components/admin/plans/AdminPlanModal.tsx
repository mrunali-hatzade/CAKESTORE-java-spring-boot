'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/common/Toast';
import { createPlan, updatePlan } from '@/lib/api/admin';
import { AdminPlan } from '@/types/admin';

interface AdminPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingPlan: AdminPlan | null;
  onSaveSuccess: () => void;
}

export function AdminPlanModal({
  isOpen,
  onClose,
  editingPlan,
  onSaveSuccess,
}: AdminPlanModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const [form, setForm] = useState({
    name: '',
    description: '',
    billingCycle: 'monthly',
    price: 999,
    currency: 'INR',
    durationDays: 30,
    features: '',
    isActive: true,
  });

  useEffect(() => {
    if (isOpen) {
      if (editingPlan) {
        setForm({
          name: editingPlan.name,
          description: editingPlan.description || '',
          billingCycle: editingPlan.billingCycle || 'monthly',
          price: editingPlan.price,
          currency: editingPlan.currency || 'INR',
          durationDays: editingPlan.durationDays || 30,
          features: editingPlan.features || '',
          isActive: editingPlan.isActive,
        });
      } else {
        setForm({
          name: '',
          description: '',
          billingCycle: 'monthly',
          price: 999,
          currency: 'INR',
          durationDays: 30,
          features: 'Up to 50 Products, WhatsApp Ordering, Custom Branding, Analytics',
          isActive: true,
        });
      }
    }
  }, [isOpen, editingPlan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.name.trim()) {
      toast.error('Plan name cannot be empty');
      return;
    }

    if (form.price === undefined || form.price === null || isNaN(form.price) || form.price < 0) {
      toast.error('Plan price cannot be negative');
      return;
    }

    if (
      form.durationDays === undefined ||
      form.durationDays === null ||
      isNaN(form.durationDays) ||
      form.durationDays <= 0 ||
      !Number.isInteger(form.durationDays)
    ) {
      toast.error('Duration days must be greater than zero');
      return;
    }

    if (
      !form.billingCycle ||
      (form.billingCycle.toLowerCase() !== 'monthly' && form.billingCycle.toLowerCase() !== 'yearly')
    ) {
      toast.error("Billing cycle must be 'monthly' or 'yearly'");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingPlan) {
        await updatePlan(editingPlan.id, form);
        toast.success(`Plan "${form.name}" updated successfully`);
      } else {
        await createPlan(form);
        toast.success(`Plan "${form.name}" created successfully`);
      }
      onSaveSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save subscription plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingPlan ? `Edit Tier: ${editingPlan.name}` : 'Create Subscription Plan'}
      description="Configure pricing, billing cycle duration, and feature access for bakery owners."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <Input
          label="Plan Name"
          required
          placeholder="e.g. Master Patisserie Pro"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <Textarea
          label="Description"
          rows={2}
          placeholder="Short overview of the tier target audience..."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Billing Cycle</label>
          <select
            value={form.billingCycle}
            onChange={(e) => {
              const cycle = e.target.value;
              setForm({
                ...form,
                billingCycle: cycle,
                durationDays: cycle === 'yearly' ? 365 : 30,
              });
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
          >
            <option value="monthly">Monthly (30 days)</option>
            <option value="yearly">Yearly (365 days)</option>
          </select>
          <p className="text-[11px] text-slate-400 mt-1">Controls how this plan appears on the pricing page toggle.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Price (₹)"
            type="number"
            min={0}
            required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
          />

          <Input
            label="Duration (Days)"
            type="number"
            min={1}
            required
            value={form.durationDays}
            onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })}
          />
        </div>

        <Textarea
          label="Features (comma-separated)"
          rows={3}
          placeholder="Unlimited Products, Custom Domain, WhatsApp Bot, 0% Commission"
          value={form.features}
          onChange={(e) => setForm({ ...form, features: e.target.value })}
          helperText="Separate features with a comma to render them as bullet checklist items."
        />

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="isActive"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="rounded text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="isActive" className="text-xs font-semibold text-slate-700 cursor-pointer">
            Active plan (available for bakery owners to select)
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-700 border-indigo-700"
          >
            {isSubmitting
              ? 'Saving...'
              : editingPlan
              ? 'Save Changes'
              : 'Create Plan'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
