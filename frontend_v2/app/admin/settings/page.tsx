'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { adminSettingsApi, GlobalSettings } from '@/lib/api/adminSettings';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Save, Building2, CreditCard, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/common/Toast';

const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR (₹) - Indian Rupee' },
  { value: 'USD', label: 'USD ($) - US Dollar' },
  { value: 'EUR', label: 'EUR (€) - European Euro' },
  { value: 'GBP', label: 'GBP (£) - British Pound' },
];

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
        platformCurrency: settings.platformCurrency || 'INR',
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

  const currencyOptions = CURRENCY_OPTIONS.some((c) => c.value === (settings.platformCurrency || 'INR'))
    ? CURRENCY_OPTIONS
    : [{ value: settings.platformCurrency!, label: settings.platformCurrency! }, ...CURRENCY_OPTIONS];

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Input
              id="platformName"
              name="platformName"
              label="Platform Name"
              value={settings.platformName || ''}
              onChange={handleChange}
              placeholder="e.g. CakeStore"
            />
            <Input
              id="supportEmail"
              name="supportEmail"
              label="Support Email"
              type="email"
              value={settings.supportEmail || ''}
              onChange={handleChange}
              placeholder="e.g. support@cakestore.com"
            />
            <Select
              id="platformCurrency"
              name="platformCurrency"
              label="Platform Currency"
              value={settings.platformCurrency || 'INR'}
              onChange={handleChange}
              options={currencyOptions}
            />
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
            <Input 
              id="razorpayKeyId"
              name="razorpayKeyId" 
              label="Razorpay Key ID"
              value={settings.razorpayKeyId || ''} 
              onChange={handleChange} 
              placeholder="rzp_live_... or rzp_test_..." 
              className="font-mono text-sm" 
            />
            
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="razorpayKeySecret" className="block text-sm font-medium text-brand-espresso">
                  Razorpay Key Secret
                </label>
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
                  id="razorpayKeySecret"
                  name="razorpayKeySecret" 
                  type={showSecret ? 'text' : 'password'} 
                  value={settings.razorpayKeySecret || ''} 
                  onChange={handleChange} 
                  placeholder={settings.razorpayKeySecretConfigured ? '•••••••• (Secret configured — leave blank to keep unchanged)' : 'Enter Secret Key'} 
                  className="font-mono text-sm pr-10" 
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  aria-label={showSecret ? 'Hide Razorpay key secret' : 'Show Razorpay key secret'}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-hidden"
                >
                  {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="razorpayWebhookSecret" className="block text-sm font-medium text-brand-espresso">
                  Webhook Secret
                </label>
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
                  id="razorpayWebhookSecret"
                  name="razorpayWebhookSecret" 
                  type={showWebhook ? 'text' : 'password'} 
                  value={settings.razorpayWebhookSecret || ''} 
                  onChange={handleChange} 
                  placeholder={settings.razorpayWebhookSecretConfigured ? '•••••••• (Webhook secret configured — leave blank to keep unchanged)' : 'Enter Webhook Secret'} 
                  className="font-mono text-sm pr-10" 
                />
                <button
                  type="button"
                  onClick={() => setShowWebhook(!showWebhook)}
                  aria-label={showWebhook ? 'Hide Razorpay webhook secret' : 'Show Razorpay webhook secret'}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-hidden"
                >
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
