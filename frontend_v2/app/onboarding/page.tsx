'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Cake,
  Store,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  MapPin,
  User,
  Mail,
  Lock,
  Phone,
  Building2,
  FileCheck,
  CreditCard,
  AlertCircle,
  Eye,
  EyeOff,
  Upload,
  Crosshair,
} from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import { ownerApi } from '@/lib/api/owner';
import { paymentsService } from '@/lib/services/payments';
import { useAuth } from '@/lib/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import CascadingLocationSelector from '@/components/owner/CascadingLocationSelector';
import { CascadingLocationValues } from '@/types/location';
import { plansApi, SubscriptionPlan } from '@/lib/api/plans';
import dynamic from 'next/dynamic';

const InteractiveLocationMap = dynamic(
  () => import('@/components/owner/InteractiveLocationMap'),
  { ssr: false, loading: () => <div className="h-64 rounded-2xl bg-neutral-100 flex items-center justify-center text-xs text-brand-muted">Loading interactive map...</div> }
);

export default function OnboardingPage() {

  const router = useRouter();
  const { login } = useAuth();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Field-specific validation errors for Step 1
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Password visibility & confirmation
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 4 Payment states
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Step 1: Personal & Account
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mobile, setMobile] = useState('');

  // Password strength helper
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { label: 'Weak', score: 0, color: 'bg-neutral-200', text: 'text-neutral-500' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/\d/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { label: 'Weak', score: 1, color: 'bg-red-500', text: 'text-red-600' };
    if (score <= 4) return { label: 'Medium', score: 2, color: 'bg-amber-500', text: 'text-amber-600' };
    return { label: 'Strong', score: 3, color: 'bg-emerald-500', text: 'text-emerald-600' };
  };

  // Step 2: Bakery Identity
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('HOME_BAKER');
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');

  // Step 3: Location & License
  const [addressLine1, setAddressLine1] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [pincode, setPincode] = useState('');
  const [fssaiRegistration, setFssaiRegistration] = useState('');
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationDetectNotice, setLocationDetectNotice] = useState<string | null>(null);
  const [locationErrors, setLocationErrors] = useState<Record<string, string>>({});

  const handleDetectLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsDetectingLocation(true);
    setLocationDetectNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setLatitude(lat);
        setLongitude(lng);
        setIsDetectingLocation(false);
        setLocationDetectNotice(`Coordinates locked: ${lat}, ${lng}`);
      },
      (err) => {
        setIsDetectingLocation(false);
        console.warn('Geolocation lookup failed:', err);
        alert('Could not detect location. Please allow browser location access or continue manually.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (step === 4) {
      setLoadingPlans(true);
      plansApi.getActivePlans().then(data => {
        setPlans(data);
        if (data.length > 0) setSelectedPlanId(data[0].planId);
      }).catch(err => console.error('Failed to load plans:', err))
        .finally(() => setLoadingPlans(false));
    }
  }, [step]);

  const handleLocationChange = (updated: Partial<CascadingLocationValues>) => {
    if ('state' in updated) setState(updated.state || '');
    if ('district' in updated) setDistrict(updated.district || '');
    if ('city' in updated) setCity(updated.city || '');
    if ('area' in updated) setArea(updated.area || '');
    if ('pincode' in updated) setPincode(updated.pincode || '');
    setLocationErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(updated)) {
        delete next[key];
      }
      return next;
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setEmailError(null);
    setPhoneError(null);

    // Canonical normalization before sending
    const normalizedEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');
    const cleanBusinessPhone = (businessPhone || mobile).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');

    try {
      await authApi.register({
        fullName: fullName.trim(),
        email: normalizedEmail,
        password,
        mobile: cleanMobile,
        businessName: businessName.trim(),
        businessType,
        businessDescription,
        businessPhone: cleanBusinessPhone,
        addressLine1,
        city,
        state,
        district: district || undefined,
        area: area || undefined,
        pincode,
        fssaiRegistration,
        verificationFile: verificationFile || undefined,
        latitude: isLocationConfirmed ? latitude : undefined,
        longitude: isLocationConfirmed ? longitude : undefined,
      });

      // Direct auto-login with credentials
      try {
        await login({ email: normalizedEmail, password });
        setStep(4);
      } catch {
        router.push('/login');
      }
    } catch (err: any) {
      const respData = err?.response?.data || {};
      const errorMessage = err?.message || err?.error || respData?.error || 'Registration failed. Please review your details.';
      
      const emailConflict = respData?.email || (errorMessage.toLowerCase().includes('email') ? 'This email is already registered. Please login or use another email.' : null);
      const phoneConflict = respData?.mobile || respData?.phone || (errorMessage.toLowerCase().includes('phone') || errorMessage.toLowerCase().includes('mobile') ? 'This phone number is already registered. Please use another number.' : null);

      if (emailConflict || phoneConflict) {
        if (emailConflict) setEmailError(emailConflict);
        if (phoneConflict) setPhoneError(phoneConflict);
        setError(errorMessage);
        setStep(1); // Return user to step 1 so they can resolve conflicting fields while keeping form data intact
      } else {
        const fieldErrors = respData?.fieldErrors || {};
        if (Object.keys(fieldErrors).length > 0) {
          setLocationErrors(fieldErrors);
        }
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaySubscription = async () => {
    if (!selectedPlanId) return;
    setIsPaying(true);
    setPaymentError(null);
    
    const selectedPlan = plans.find(p => p.planId === selectedPlanId);

    try {
      const orderData = await ownerApi.initiateSubscriptionPayment(selectedPlanId);
      const keyId = orderData.keyId;

      const isLoaded = await paymentsService.loadRazorpayScript();
      if (!isLoaded && keyId && !keyId.includes('placeholder')) {
        setPaymentError('Unable to load payment gateway. Please check your internet connection.');
        setIsPaying(false);
        return;
      }

      if (keyId && !keyId.includes('placeholder')) {
        const rzpOptions = {
          key: keyId,
          amount: orderData.amountPaise,
          currency: orderData.currency || 'INR',
          name: 'CakeStore',
          description: `Subscription for ${orderData.shopName || businessName || 'Bakery'}`,
          order_id: orderData.razorpayOrderId, // MUST pass order_id to get a signature back!
          prefill: {
            name: fullName || businessName || '',
            email: email || '',
            contact: mobile || businessPhone || '',
          },
          theme: {
            color: '#5C2434',
          },
          handler: async (response: any) => {
            try {
              if (!response.razorpay_order_id || !response.razorpay_payment_id || !response.razorpay_signature) {
                const errorMsg = `Incomplete payment details. Received -> order: ${response.razorpay_order_id || 'MISSING'}, payment: ${response.razorpay_payment_id || 'MISSING'}, sig: ${response.razorpay_signature ? 'PRESENT' : 'MISSING'}`;
                console.error(errorMsg, response);
                throw new Error(errorMsg);
              }

              await ownerApi.verifySubscriptionPayment({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                planId: selectedPlanId,
              });
              setPaymentSuccess(true);
            } catch (err: any) {
              setPaymentError(err?.message || 'Payment verification failed. Please try again.');
            } finally {
              setIsPaying(false);
            }
          },
          modal: {
            ondismiss: () => {
              setPaymentError('Payment was not completed. Please try again.');
              setIsPaying(false);
            },
          },
        };

        const rzp = new (window as any).Razorpay(rzpOptions);
        rzp.open();
      } else {
        // Sandbox simulation when test placeholder keys are active
        const simulatedPaymentId = `pay_test_${Date.now()}`;
        await ownerApi.verifySubscriptionPayment({
          razorpayOrderId: orderData.razorpayOrderId,
          razorpayPaymentId: simulatedPaymentId,
          razorpaySignature: 'simulated_test_sig',
          planId: selectedPlanId,
        });
        setPaymentSuccess(true);
        setIsPaying(false);
      }
    } catch (err: any) {
      setPaymentError(err?.message || 'Payment initiation failed. Please try again.');
      setIsPaying(false);
    }
  };

  const stepsInfo = [
    { num: 1, label: 'Account', icon: User },
    { num: 2, label: 'Bakery Details', icon: Store },
    { num: 3, label: 'Location & FSSAI', icon: MapPin },
    { num: 4, label: 'Subscription', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-brand-cream-light font-sans flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-brand-border/60 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-plum text-white flex items-center justify-center shadow-soft">
              <Cake className="w-5 h-5" />
            </div>
            <div>
              <span className="font-serif text-xl font-bold text-brand-espresso block leading-none">
                CakeStore
              </span>
              <span className="text-[10px] uppercase tracking-wider text-brand-muted font-medium">
                Baker Partner Program
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-brand-muted hidden sm:inline">Already registered?</span>
            <Link href="/login" className="font-bold text-brand-plum hover:underline">
              Owner Login &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10">
        {step < 4 && (
          <div className="text-center max-w-2xl mx-auto mb-8 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-blush border border-brand-blush-border text-brand-plum text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create Your Bakery Store</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-brand-espresso tracking-tight">
              Launch Your Bakery <span className="text-brand-plum italic">Online</span>
            </h1>

            <p className="text-xs sm:text-sm text-brand-muted max-w-lg mx-auto leading-relaxed">
              Create your custom digital storefront, showcase artisanal cakes, and accept customer orders in 3 simple steps.
            </p>

            {/* Visual Stepper */}
            <div className="flex items-center justify-center gap-2 sm:gap-4 pt-4">
              {stepsInfo.map((s, idx) => {
                const Icon = s.icon;
                const isCompleted = step > s.num;
                const isCurrent = step === s.num;

                return (
                  <React.Fragment key={s.num}>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isCompleted
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : isCurrent
                            ? 'bg-brand-plum text-white shadow-soft ring-4 ring-brand-plum/20'
                            : 'bg-white border border-brand-border text-brand-muted'
                        }`}
                      >
                        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                      </div>
                      <span
                        className={`text-xs font-semibold hidden sm:inline ${
                          isCurrent ? 'text-brand-espresso font-bold' : 'text-brand-muted'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                    {idx < stepsInfo.length - 1 && (
                      <div
                        className={`w-8 sm:w-12 h-0.5 transition-colors ${
                          step > s.num ? 'bg-emerald-600' : 'bg-brand-border'
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Card Container */}
        <div className="max-w-2xl mx-auto">
          <Card className="p-6 sm:p-10 shadow-soft border-brand-border/80">
            {error && <ErrorState message={error} className="mb-6" />}

            {/* STEP 1: Personal Credentials */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="pb-3 border-b border-brand-border/60">
                  <h2 className="text-lg font-serif font-bold text-brand-espresso">
                    Step 1: Account Credentials
                  </h2>
                  <p className="text-xs text-brand-muted mt-0.5">
                    Your login details for managing your bakery
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Your Full Name"
                    required
                    placeholder="Chef Anita Verma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                  <div>
                    <Input
                      label="Mobile Phone"
                      required
                      placeholder="9876543210"
                      value={mobile}
                      onChange={(e) => {
                        setMobile(e.target.value);
                        if (phoneError) setPhoneError(null);
                      }}
                      error={phoneError || undefined}
                      helperText="10-digit Indian mobile number"
                    />
                  </div>
                </div>

                <div>
                  <Input
                    label="Email Address"
                    type="email"
                    required
                    placeholder="anita@bakes.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    error={emailError || undefined}
                    helperText="Required for order notifications, store updates, and login"
                  />
                  {emailError && emailError.includes('already registered') && (
                    <p className="text-xs text-brand-plum font-semibold mt-1">
                      Already have an account?{' '}
                      <Link href="/login" className="underline font-bold">
                        Login instead &rarr;
                      </Link>
                    </p>
                  )}
                </div>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="w-full space-y-1.5">
                    <label className="block text-sm font-medium text-brand-espresso">
                      Create Password <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (passwordError) setPasswordError(null);
                        }}
                        className={`w-full px-3.5 py-2.5 pr-10 bg-white rounded-xl border ${
                          passwordError ? 'border-red-500' : 'border-brand-border'
                        } text-brand-espresso placeholder:text-brand-muted/60 text-sm focus:outline-none focus:ring-2 focus:ring-brand-plum/20 focus:border-brand-plum transition-colors`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-espresso transition-colors cursor-pointer"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password Strength Indicator */}
                    {password && (
                      <div className="pt-1 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-brand-muted">Strength:</span>
                          <span className={`font-bold ${getPasswordStrength(password).text}`}>
                            {getPasswordStrength(password).label}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden flex gap-1">
                          <div className={`h-full flex-1 rounded-full ${getPasswordStrength(password).score >= 1 ? getPasswordStrength(password).color : 'bg-transparent'}`} />
                          <div className={`h-full flex-1 rounded-full ${getPasswordStrength(password).score >= 2 ? getPasswordStrength(password).color : 'bg-transparent'}`} />
                          <div className={`h-full flex-1 rounded-full ${getPasswordStrength(password).score >= 3 ? getPasswordStrength(password).color : 'bg-transparent'}`} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-full space-y-1.5">
                    <label className="block text-sm font-medium text-brand-espresso">
                      Confirm Password <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (passwordError) setPasswordError(null);
                        }}
                        className={`w-full px-3.5 py-2.5 pr-10 bg-white rounded-xl border ${
                          passwordError ? 'border-red-500' : 'border-brand-border'
                        } text-brand-espresso placeholder:text-brand-muted/60 text-sm focus:outline-none focus:ring-2 focus:ring-brand-plum/20 focus:border-brand-plum transition-colors`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-espresso transition-colors cursor-pointer"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                {passwordError && <p className="text-xs text-red-600 font-medium -mt-2">{passwordError}</p>}

                <div className="pt-4 flex justify-between items-center border-t border-brand-border/60">
                  <Link href="/login" className="text-xs font-semibold text-brand-plum hover:underline">
                    Already have an account? Sign in
                  </Link>
                  <Button
                    onClick={() => {
                      setEmailError(null);
                      setPhoneError(null);
                      setPasswordError(null);
                      setError(null);

                      if (!fullName || !email || !password || !confirmPassword || !mobile) {
                        setError('Please complete all required fields before continuing.');
                        return;
                      }

                      // Validate Email format
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                        setEmailError('Please enter a valid email address.');
                        return;
                      }

                      // Validate Indian Phone format
                      const cleanPhone = mobile.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');
                      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
                        setPhoneError('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
                        return;
                      }

                      // Validate Password Length
                      if (password.length < 8) {
                        setPasswordError('Password must be at least 8 characters long.');
                        return;
                      }

                      // Validate Password Match
                      if (password !== confirmPassword) {
                        setPasswordError('Passwords do not match.');
                        return;
                      }

                      setStep(2);
                    }}
                    size="lg"
                  >
                    <span>Next: Bakery Details</span>
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Bakery Identity */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="pb-3 border-b border-brand-border/60">
                  <h2 className="text-lg font-serif font-bold text-brand-espresso">
                    Step 2: Bakery Brand & Concept
                  </h2>
                  <p className="text-xs text-brand-muted mt-0.5">
                    This information appears on your live customer storefront
                  </p>
                </div>

                <Input
                  label="Bakery / Brand Name"
                  required
                  placeholder="e.g. Vanilla Bean Confections"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />

                <Select
                  label="Bakery Business Type"
                  options={[
                    { value: 'HOME_BAKER', label: '🏠 Home Baker / Artisan Kitchen' },
                    { value: 'PASTRY_SHOP', label: '🏬 Pastry Boutique / Retail Shop' },
                    { value: 'CUSTOM_CAKE_STUDIO', label: '🎂 Custom Cake Studio' },
                    { value: 'COMMERCIAL_BAKERY', label: '🏭 Commercial Bakery' },
                  ]}
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                />

                <Input
                  label="Bakery Bio / Story (Optional)"
                  placeholder="Specializing in handcrafted Belgian chocolate gateaux, French entremets, and birthday cakes."
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                />

                <Input
                  label="Order WhatsApp / Contact Phone"
                  placeholder="9876543210 (Leave blank to use personal mobile)"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                />

                <div className="pt-4 flex justify-between items-center border-t border-brand-border/60">
                  <Button variant="ghost" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                  </Button>
                  <Button
                    onClick={() => {
                      if (!businessName) {
                        setError('Please enter your bakery or brand name.');
                        return;
                      }
                      setError(null);
                      setStep(3);
                    }}
                    size="lg"
                  >
                    <span>Next: Location Details</span>
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Location & License */}
            {step === 3 && (
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="pb-3 border-b border-brand-border/60">
                  <h2 className="text-lg font-serif font-bold text-brand-espresso">
                    Step 3: Location & License
                  </h2>
                  <p className="text-xs text-brand-muted mt-0.5">
                    Helps local customers find your bakery on the marketplace
                  </p>
                </div>

                <Input
                  label="Kitchen / Street Address"
                  required
                  placeholder="Flat 204, Rosewood Apts / Shop 14, MG Road"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                />

                <CascadingLocationSelector
                  values={{ state, district, city, area, pincode }}
                  onChange={handleLocationChange}
                  fieldErrors={locationErrors}
                  disabled={isLoading}
                />

                {/* Interactive Map Pin & Confirmation */}
                <div className="pt-2 border-t border-brand-border/60 space-y-2">
                  <div>
                    <h3 className="text-xs font-bold text-brand-espresso flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-brand-plum" />
                      Bakery Kitchen Map Pin & Location Confirmation
                    </h3>
                    <p className="text-[11px] text-brand-muted mt-0.5">
                      Confirm your bakery&apos;s exact location on the map so nearby customers can discover your kitchen and see accurate distance.
                    </p>
                  </div>

                  <InteractiveLocationMap
                    initialLatitude={latitude}
                    initialLongitude={longitude}
                    initialConfirmed={isLocationConfirmed}
                    addressContext={{
                      addressLine1,
                      area,
                      city,
                      state,
                      pincode,
                    }}
                    onChange={(coords) => {
                      setLatitude(coords.latitude);
                      setLongitude(coords.longitude);
                      setIsLocationConfirmed(coords.isConfirmed);
                    }}
                    disabled={isLoading}
                  />
                </div>


                <Input
                  label="FSSAI Registration No. (Optional)"
                  placeholder="11520000000000"
                  value={fssaiRegistration}
                  onChange={(e) => setFssaiRegistration(e.target.value)}
                  helperText="Recommended to display verified trust badge."
                />

                {/* FSSAI Certificate File Upload */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-brand-espresso">
                    FSSAI Certificate Document (Optional)
                  </label>
                  <div className="relative border-2 border-dashed border-brand-border hover:border-brand-plum/40 rounded-xl p-4 transition-colors bg-white text-center">
                    <input
                      type="file"
                      accept=".pdf,image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setVerificationFile(file);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center justify-center pointer-events-none">
                      <Upload className="w-6 h-6 text-brand-plum mb-1.5" />
                      {verificationFile ? (
                        <p className="text-xs font-semibold text-brand-plum">
                          Selected: {verificationFile.name} ({(verificationFile.size / 1024).toFixed(1)} KB)
                        </p>
                      ) : (
                        <>
                          <p className="text-xs font-semibold text-brand-espresso">
                            Upload FSSAI License or Kitchen Registration PDF / Image
                          </p>
                          <p className="text-[11px] text-brand-muted mt-0.5">
                            PDF, PNG, JPG up to 10MB. Fast-tracks your bakery verification badge.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  {verificationFile && (
                    <div className="flex justify-between items-center text-[11px] text-brand-muted px-1">
                      <span className="text-emerald-600 font-medium">Ready for upload upon registration</span>
                      <button
                        type="button"
                        onClick={() => setVerificationFile(null)}
                        className="text-rose-600 hover:underline cursor-pointer"
                      >
                        Remove file
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-4 flex justify-between items-center border-t border-brand-border/60">
                  <Button variant="ghost" type="button" onClick={() => setStep(2)}>
                    <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                  </Button>
                  <Button type="submit" size="lg" isLoading={isLoading} className="font-bold">
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Complete Registration
                  </Button>
                </div>
              </form>
            )}

            {/* STEP 4: Complete Subscription */}
            {step === 4 && (
              <div className="text-center py-8 space-y-6">
                {!paymentSuccess ? (
                  <>
                    <div className="w-20 h-20 rounded-3xl bg-brand-blush/60 border-2 border-brand-plum/20 text-brand-plum flex items-center justify-center mx-auto shadow-soft">
                      <CreditCard className="w-10 h-10" />
                    </div>

                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Registration Submitted Successfully</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-serif font-bold text-brand-espresso">
                        Activate Your Bakery
                      </h2>
                      <p className="text-sm text-brand-muted max-w-md mx-auto leading-relaxed">
                        Complete your subscription to activate your bakery and start receiving customer orders.
                      </p>
                    </div>

                    {paymentError && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs text-left max-w-md mx-auto flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{paymentError}</p>
                          <p className="text-rose-600 mt-0.5">Please try again to activate your bakery.</p>
                        </div>
                      </div>
                    )}

                    {loadingPlans ? (
                      <div className="p-5 text-sm text-brand-muted">Loading subscription plans...</div>
                    ) : plans.length === 0 ? (
                      <div className="p-5 text-sm text-brand-muted">No subscription plans available.</div>
                    ) : (
                      <div className="max-w-md mx-auto space-y-4">
                        {plans.map(plan => (
                          <div 
                            key={plan.planId}
                            onClick={() => setSelectedPlanId(plan.planId)}
                            className={`p-5 rounded-2xl border text-left space-y-3 shadow-2xs cursor-pointer transition-all ${
                              selectedPlanId === plan.planId ? 'border-brand-plum bg-brand-blush/20 ring-1 ring-brand-plum' : 'border-brand-border/80 bg-white hover:border-brand-plum/50'
                            }`}
                          >
                            <div className="flex justify-between items-center pb-3 border-b border-brand-border/60">
                              <div>
                                <p className="font-bold text-brand-espresso">{plan.name}</p>
                                <p className="text-xs text-brand-muted capitalize">{plan.billingCycle} billing cycle</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold text-brand-plum font-serif">₹{plan.price}</p>
                                <p className="text-[10px] text-brand-muted">/ {plan.billingCycle === 'monthly' ? 'month' : 'year'}</p>
                              </div>
                            </div>

                            <div className="space-y-1.5 text-xs text-brand-muted">
                              {(() => {
                                let parsedFeatures: string[] = [];
                                try {
                                  parsedFeatures = JSON.parse(plan.features);
                                } catch (e) {
                                  // fallback if it's not a JSON string
                                  parsedFeatures = [plan.description];
                                }
                                return parsedFeatures.map((feature, idx) => (
                                  <div key={idx} className="flex items-start gap-2">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                    <span>{feature}</span>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                      <Button
                        size="lg"
                        className="w-full font-bold shadow-soft gap-2 text-sm"
                        onClick={handlePaySubscription}
                        isLoading={isPaying}
                        disabled={!selectedPlanId || loadingPlans}
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Pay {selectedPlanId ? `₹${plans.find(p => p.planId === selectedPlanId)?.price}` : ''}</span>
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-3xl bg-emerald-50 border-2 border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-soft">
                      <Sparkles className="w-10 h-10" />
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-2xl sm:text-3xl font-serif font-bold text-brand-espresso">
                        Payment Successful! 🎉
                      </h2>
                      <p className="text-sm font-semibold text-emerald-700">
                        Your bakery is now active.
                      </p>
                      <p className="text-xs text-brand-muted max-w-md mx-auto leading-relaxed">
                        Your bakery is available on CakeStore while our team completes verification. You can now configure your delivery slots, add signature cakes, and customize your storefront.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-brand-blush/60 border border-brand-blush-border max-w-md mx-auto text-left space-y-2 text-xs">
                      <p className="font-bold text-brand-espresso">Next Steps:</p>
                      <p className="text-brand-muted">1. Configure your daily delivery slots & radius</p>
                      <p className="text-brand-muted">2. Add your signature cakes & eggless options</p>
                      <p className="text-brand-muted">3. Share your custom storefront link with customers!</p>
                    </div>

                    <div className="pt-2 flex justify-center">
                      <Link href="/dashboard/owner">
                        <Button size="lg" className="font-bold shadow-soft">
                          <span>Continue to Owner Dashboard</span>
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* Footer Perks Bar */}
      <footer className="border-t border-brand-border/60 bg-white/60 py-4 text-center text-xs text-brand-muted">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>0% Commission on all orders</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Razorpay Test Mode checkout</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Store className="w-4 h-4 text-brand-plum" />
            <span>Instant custom storefront link</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
