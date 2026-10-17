'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  CreditCard,
  Check,
  Plus,
  Edit2,
  Power,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Save,
} from 'lucide-react';
import {
  getAllPlans,
  togglePlanStatus,
  reorderPlans,
} from '@/lib/api/admin';
import { AdminPlan } from '@/types/admin';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/common/Toast';
import { AdminPlanModal } from '@/components/admin/plans/AdminPlanModal';
import { useRegisterAdminRefresh } from '@/context/AdminRefreshContext';

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [isOrderChanged, setIsOrderChanged] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const toast = useToast();

  const loadPlans = React.useCallback(async (isManual = false) => {
    if (!isManual) setIsLoading(true);

    try {
      const data = await getAllPlans();
      setPlans(data || []);
      setIsOrderChanged(false);
    } catch {
      toast.error('Failed to load subscription plans');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const movePlan = (planId: number, direction: 'up' | 'down', cycle: string) => {
    setPlans((prev) => {
      const cyclePlans = prev.filter((p) => p.billingCycle === cycle || (!p.billingCycle && cycle === 'monthly'));
      const cycleIdx = cyclePlans.findIndex((p) => p.id === planId);
      
      if (cycleIdx < 0) return prev;
      const swapCycleIdx = direction === 'up' ? cycleIdx - 1 : cycleIdx + 1;
      if (swapCycleIdx < 0 || swapCycleIdx >= cyclePlans.length) return prev;
      
      const swapPlanId = cyclePlans[swapCycleIdx].id;
      
      const idx1 = prev.findIndex((p) => p.id === planId);
      const idx2 = prev.findIndex((p) => p.id === swapPlanId);
      
      const newPlans = [...prev];
      const temp = newPlans[idx1];
      newPlans[idx1] = newPlans[idx2];
      newPlans[idx2] = temp;
      
      return newPlans;
    });
    setIsOrderChanged(true);
  };

  const handleSaveOrder = async () => {
    try {
      setIsSavingOrder(true);
      await reorderPlans(plans.map(p => p.id));
      toast.success('Plan display order saved successfully');
      setIsOrderChanged(false);
      loadPlans();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save plan order');
    } finally {
      setIsSavingOrder(false);
    }
  };

  useRegisterAdminRefresh(
    useCallback(async () => {
      await loadPlans(true);
    }, [loadPlans])
  );

  useEffect(() => {
    loadPlans();

    const handleRefresh = () => {
      loadPlans(true);
    };

    window.addEventListener('adminGlobalRefresh', handleRefresh);
    return () => {
      window.removeEventListener('adminGlobalRefresh', handleRefresh);
    };
  }, [loadPlans]);

  const openCreateModal = () => {
    setEditingPlan(null);
    setIsModalOpen(true);
  };

  const openEditModal = (plan: AdminPlan) => {
    setEditingPlan(plan);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (plan: AdminPlan) => {
    const nextStatus = !plan.isActive;
    try {
      await togglePlanStatus(plan.id, nextStatus);
      setPlans((prev) =>
        prev.map((p) => (p.id === plan.id ? { ...p, isActive: nextStatus } : p))
      );
      toast.success(
        `Plan "${plan.name}" is now ${nextStatus ? 'active' : 'disabled'}`
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle plan status');
    }
  };

  if (isLoading) return <LoadingState message="Loading SaaS subscription tiers..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-slate-900">
            SaaS Subscription Plans
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure pricing tiers, product quota limits, and platform features for bakery owners
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSaveOrder}
            disabled={!isOrderChanged || isSavingOrder}
            className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
          >
            <Save className={`w-3.5 h-3.5 ${isSavingOrder ? 'animate-pulse' : ''}`} />
            <span>{isSavingOrder ? 'Saving...' : 'Save Order'}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={openCreateModal}
            className="bg-indigo-600 hover:bg-indigo-700 border-indigo-700 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Plan</span>
          </Button>
        </div>
      </div>

      {/* Plans Grid */}
      {plans.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="w-8 h-8 text-slate-400" />}
          title="No Subscription Plans Configured"
          description="Create your first SaaS pricing tier for bakery owners to select upon onboarding."
          action={
            <Button variant="primary" size="sm" onClick={openCreateModal}>
              Create First Plan
            </Button>
          }
        />
      ) : (
        <div className="space-y-12 max-w-6xl">
          {['monthly', 'yearly'].map((cycle) => {
            // Group plans. Fallback to monthly if billingCycle is undefined for legacy plans.
            const cyclePlans = plans.filter((p) => p.billingCycle === cycle || (!p.billingCycle && cycle === 'monthly'));
            
            if (cyclePlans.length === 0 && cycle === 'yearly') return null;

            return (
              <div key={cycle} className="space-y-6">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-serif font-bold text-slate-900 capitalize">{cycle} Plans</h3>
                  <div className="h-px bg-slate-200 flex-1 ml-4" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cyclePlans.map((plan) => {
                    let featureList: string[] = [];
                    if (plan.features) {
                      try {
                        const parsed = JSON.parse(plan.features);
                        if (Array.isArray(parsed)) {
                          featureList = parsed.map((item) => String(item).trim()).filter(Boolean);
                        }
                      } catch {
                        featureList = plan.features
                          .replace(/[\[\]"']/g, '')
                          .split(',')
                          .map((f) => f.trim())
                          .filter(Boolean);
                      }
                    }

                    return (
                      <Card
                        key={plan.id}
                        className={`p-7 rounded-2xl flex flex-col justify-between border-slate-200/90 shadow-soft hover:shadow-card transition-all ${
                          !plan.isActive ? 'opacity-70 bg-slate-50/70' : 'bg-white'
                        }`}
                      >
                        <div>
                          {/* Top Bar */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h3 className="font-serif font-bold text-xl text-slate-900">
                                {plan.name}
                              </h3>
                              <div className="flex flex-col -space-y-1">
                                <button onClick={() => movePlan(plan.id, 'up', cycle)} className="text-slate-400 hover:text-indigo-600" title="Move Up">
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                                <button onClick={() => movePlan(plan.id, 'down', cycle)} className="text-slate-400 hover:text-indigo-600" title="Move Down">
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {plan.billingCycle && (
                                <Badge variant="default" size="sm">
                                  {plan.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}
                                </Badge>
                              )}
                              <Badge variant={plan.isActive ? 'success' : 'default'} size="sm">
                                {plan.isActive ? 'Active' : 'Disabled'}
                              </Badge>
                            </div>
                          </div>

                          <p className="text-sm text-slate-500 mt-2.5 min-h-[2.5rem] line-clamp-2 leading-relaxed">
                            {plan.description || 'Standard bakery subscription tier.'}
                          </p>

                          {/* Price */}
                          <div className="mt-5 pb-5 border-b border-slate-100">
                            <p className="text-3xl sm:text-4xl font-extrabold font-serif text-slate-900">
                              ₹{plan.price.toLocaleString('en-IN')}
                              <span className="text-xs font-normal text-slate-500 font-sans ml-1">
                                / {plan.durationDays} days
                              </span>
                            </p>
                            <span className="text-xs text-indigo-600 font-semibold mt-1 inline-block">
                              Currency: {plan.currency || 'INR'}
                            </span>
                          </div>

                          {/* Features */}
                          <div className="mt-5 space-y-3 text-sm text-slate-700">
                            {featureList.length > 0 ? (
                              featureList.slice(0, 4).map((feature, idx) => (
                                <div key={idx} className="flex items-start gap-2.5">
                                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                  <span className="leading-snug">{feature}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-slate-400 italic">No specific feature tags listed.</p>
                            )}
                            {featureList.length > 4 && (
                              <div className="text-xs text-slate-400 font-medium pt-1">
                                + {featureList.length - 4} more features
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(plan)}
                            className="gap-2 text-xs flex-1 py-2"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit Tier</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(plan)}
                            className={`gap-1.5 text-xs py-2 ${
                              plan.isActive
                                ? 'text-rose-600 hover:bg-rose-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{plan.isActive ? 'Disable' : 'Enable'}</span>
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                  
                  {/* Quick Add Plan Slot - Only show in Monthly to avoid duplicating */}
                  {cycle === 'monthly' && (
                    <div
                      onClick={openCreateModal}
                      className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 p-7 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[300px] group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white group-hover:bg-indigo-600 group-hover:text-white text-slate-400 flex items-center justify-center shadow-xs border border-slate-200 transition-colors mb-4">
                        <Plus className="w-6 h-6" />
                      </div>
                      <h4 className="font-serif font-bold text-base text-slate-800 group-hover:text-indigo-600 transition-colors">
                        Add Another Tier
                      </h4>
                      <p className="text-xs text-slate-400 max-w-xs mt-1.5 leading-relaxed">
                        Create Starter, Growth, or Custom Enterprise plans
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Plan Modal (Create / Edit) */}
      <AdminPlanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingPlan={editingPlan}
        onSaveSuccess={() => loadPlans(false)}
      />
    </div>
  );
}
