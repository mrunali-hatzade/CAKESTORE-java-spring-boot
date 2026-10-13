'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { adminSettingsApi, GlobalSettings } from '@/lib/api/adminSettings';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Save, Shield, CreditCard, Building2, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/common/Toast';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Partial<GlobalSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const toast = useToast();

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminSettingsApi.getSettings();
      setSettings(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Clean up payload so empty secret strings don't accidentally overwrite configured values
      const payload: Partial<GlobalSettings> = {
        platformName: settings.platformName,
        supportEmail: settings.supportEmail,
        razorpayKeyId: settings.razorpayKeyId,
        platformCurrency: settings.platformCurrency,
      };

      if (settings.razorpayKeySecret && settings.razorpayKeySecret.trim()) {
        payload.razorpayKeySecret = settings.razorpayKeySecret.trim();
      }
      if (settings.razorpayWebhookSecret && settings.razorpayWebhookSecret.trim()) {
        payload.razorpayWebhookSecret = settings.razorpayWebhookSecret.trim();
      }

      const updated = await adminSettingsApi.updateSettings(payload);
      setSettings({
        ...updated,
        razorpayKeySecret: '',
        razorpayWebhookSecret: '',
      });
      toast.success('Platform settings saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading platform settings...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 pb-32">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-serif">Global Platform Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure your platform&apos;s core identity, payments, and tax rules.</p>
      </div>

      <div className="space-y-6">
        {/* General Branding */}
        <Card className="p-6 border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Building2 className="w-5 h-5" /></div>
            <h2 className="text-lg font-semibold text-slate-800">Platform Identity</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Platform Name</label>
              <Input name="platformName" value={settings.platformName || ''} onChange={handleChange} placeholder="e.g. CakeStore" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Support Email</label>
              <Input name="supportEmail" value={settings.supportEmail || ''} onChange={handleChange} placeholder="e.g. support@cakestore.com" />
            </div>
          </div>
        </Card>

        {/* Payment Gateway (Razorpay) */}
        <Card className="p-6 border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><CreditCard className="w-5 h-5" /></div>
            <h2 className="text-lg font-semibold text-slate-800">Payment Gateway (Razorpay)</h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Enter your live or test Razorpay API credentials. These keys are encrypted in the database and used for SaaS subscriptions and platform orders.
          </p>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Razorpay Key ID</label>
              <Input 
                name="razorpayKeyId" 
                value={settings.razorpayKeyId || ''} 
                onChange={handleChange} 
                placeholder="rzp_live_... or rzp_test_..." 
                className="font-mono text-sm" 
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">Razorpay Key Secret</label>
                {settings.razorpayKeySecretConfigured ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Configured securely
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    Not configured
                  </span>
                )}
              </div>
              <div className="relative">
                <Input 
                  name="razorpayKeySecret" 
                  type={showSecret ? 'text' : 'password'} 
                  value={settings.razorpayKeySecret || ''} 
                  onChange={handleChange} 
                  placeholder={settings.razorpayKeySecretConfigured ? '•••••••• (Secret configured — leave blank to keep unchanged)' : 'Enter Secret Key'} 
                  className="font-mono text-sm pr-10" 
                />
                <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">Webhook Secret</label>
                {settings.razorpayWebhookSecretConfigured ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Configured securely
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    Not configured
                  </span>
                )}
              </div>
              <div className="relative">
                <Input 
                  name="razorpayWebhookSecret" 
                  type={showWebhook ? 'text' : 'password'} 
                  value={settings.razorpayWebhookSecret || ''} 
                  onChange={handleChange} 
                  placeholder={settings.razorpayWebhookSecretConfigured ? '•••••••• (Webhook secret configured — leave blank to keep unchanged)' : 'Enter Webhook Secret'} 
                  className="font-mono text-sm pr-10" 
                />
                <button type="button" onClick={() => setShowWebhook(!showWebhook)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  {showWebhook ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Used to verify incoming webhooks from Razorpay for successful payments.</p>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px] shadow-md">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
