'use client';

import React, { useState } from 'react';
import { Mail, Phone, Clock, Send, CheckCircle2, Sparkles, MessageSquare } from 'lucide-react';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { communicationApi } from '@/lib/api/communication';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'Order Assistance',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await communicationApi.submitContactEnquiry({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        subject: form.subject,
        message: form.message,
      });
      setSubmitted(true);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to submit enquiry. Please check your information and try again.';
      setErrorMessage(errorMsg);
      // Form inputs are preserved in state
    } finally {
      setIsSubmitting(false);
    }
  };

  const channels = [
    {
      icon: MessageSquare,
      label: 'WhatsApp Support',
      value: '+91 98231 00000',
      sub: 'Mon-Sat, 9 AM to 9 PM IST',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      icon: Mail,
      label: 'Email Us',
      value: 'support@cakestore.in',
      sub: 'Replies within 4 hours',
      color: 'text-brand-plum',
      bg: 'bg-brand-blush',
    },
    {
      icon: Phone,
      label: 'Call Us',
      value: '+91 98231 00001',
      sub: 'Mon-Fri, 10 AM to 6 PM IST',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
  ];

  return (
    <div className="min-h-screen bg-brand-cream-light font-sans flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-blush border border-brand-blush-border text-brand-plum text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>We are here to help</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif text-brand-espresso tracking-tight">
            Get in Touch with <span className="text-brand-plum italic">CakeStore</span>
          </h1>
          <p className="text-base sm:text-lg text-brand-muted leading-relaxed">
            Have a question about a cake order, want to partner your bakery, or need technical help? Our team responds within a few hours.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {channels.map((c, i) => {
            const Icon = c.icon;
            return (
              <Card key={i} className="p-6 flex items-start gap-4">
                <div className={`w-11 h-11 rounded-2xl ${c.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${c.color}`} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-muted mb-0.5">{c.label}</p>
                  <p className="text-sm font-bold text-brand-espresso">{c.value}</p>
                  <p className="text-xs text-brand-muted mt-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />{c.sub}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="max-w-2xl mx-auto">
          <Card className="p-8">
            {submitted ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold font-serif text-brand-espresso">Message Sent!</h2>
                <p className="text-sm text-brand-muted">Thank you for reaching out. Our team will respond to your message within a few hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold font-serif text-brand-espresso">Send Us a Message</h2>
                  <p className="text-xs text-brand-muted mt-1">Fill in the form and we will get back to you shortly</p>
                </div>
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
                    <span>{errorMessage}</span>
                    <button
                      type="button"
                      onClick={() => setErrorMessage(null)}
                      className="text-red-500 hover:text-red-700 font-bold ml-2 text-sm leading-none"
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Your Name"
                    required
                    placeholder="Priya Deshmukh"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    required
                    placeholder="priya@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Phone Number"
                    placeholder="+91 98231 00000"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-brand-espresso">Subject</label>
                    <select
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-brand-border text-sm text-brand-espresso bg-white focus:outline-none focus:ring-2 focus:ring-brand-plum/20"
                    >
                      <option>Order Assistance</option>
                      <option>Baker Registration</option>
                      <option>Technical Support</option>
                      <option>Billing Query</option>
                      <option>Partnership</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <Textarea
                  label="Your Message"
                  required
                  rows={5}
                  placeholder="Tell us how we can help you..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  <Send className="w-4 h-4 mr-2" />
                  {isSubmitting ? 'Sending Message...' : 'Send Message'}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
