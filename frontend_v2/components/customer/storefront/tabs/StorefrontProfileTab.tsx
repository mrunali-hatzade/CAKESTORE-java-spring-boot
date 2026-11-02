'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCircle,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Phone,
  ArrowLeft,
  KeyRound,
  Check,
  Home,
  Briefcase,
  Building2,
} from 'lucide-react';
import { Shop } from '@/types/shop';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/common/Toast';
import { useCustomerAuth } from '@/lib/auth/CustomerAuthContext';
import { customerProfileApi, CustomerProfile, CustomerAddress } from '@/lib/api/customerProfile';
import { Modal } from '@/components/ui/Modal';

interface StorefrontProfileTabProps {
  shop: Shop;
}

export const StorefrontProfileTab: React.FC<StorefrontProfileTabProps> = ({ shop }) => {
  const toast = useToast();
  const customerAuth = useCustomerAuth();
  
  const [step, setStep] = useState<'PHONE' | 'OTP' | 'PROFILE'>('PHONE');
  const [phoneInput, setPhoneInput] = useState('');
  const [otp, setOtp] = useState('');
  
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ fullName: '', email: '' });
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'OTP' && resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);
  
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [addressForm, setAddressForm] = useState({
    addressType: 'HOME' as 'HOME' | 'WORK' | 'OTHER',
    label: 'Home',
    recipientName: '',
    recipientPhone: '',
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    deliveryAddress: '',
    default: false,
  });

  const loadProfileData = useCallback(async (token: string) => {
    try {
      setIsLoading(true);
      const [profData, addrData] = await Promise.all([
        customerProfileApi.getProfile(token),
        customerProfileApi.getAddresses(token)
      ]);
      setProfile(profData);
      setAddresses(addrData);
      setProfileForm({ fullName: profData.fullName || '', email: profData.email || '' });
      setStep('PROFILE');
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        customerAuth.logout();
        setStep('PHONE');
        toast.error('Session expired. Please verify your phone number again.');
      } else {
        toast.error('Failed to load profile data.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [customerAuth, toast]);

  useEffect(() => {
    if (customerAuth.isAuthenticated && customerAuth.token) {
      loadProfileData(customerAuth.token);
    } else {
      setStep('PHONE');
    }
  }, [customerAuth.isAuthenticated, customerAuth.token, loadProfileData]);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phoneInput || phoneInput.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    
    setIsLoading(true);
    try {
      await customerAuth.requestOtp(phoneInput);
      toast.success('OTP sent successfully!');
      setStep('OTP');
      setResendTimer(60);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || '';
      if (msg.includes('Please wait') && msg.includes('seconds')) {
        setStep('OTP');
        const match = msg.match(/wait (\d+) seconds/);
        if (match) {
          setResendTimer(parseInt(match[1]));
        } else {
          setResendTimer(60);
        }
        toast.info('You recently requested an OTP. Please enter it below.');
      } else {
        toast.error(msg || 'Failed to send OTP');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    
    setIsLoading(true);
    try {
      await customerAuth.verifyOtp(phoneInput, otp);
      toast.success('Verified successfully!');
      // useEffect will trigger loadProfileData when isAuthenticated becomes true
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerAuth.token) return;
    
    if (!profileForm.fullName.trim()) {
      toast.error('Full name is required');
      return;
    }
    
    setIsLoading(true);
    try {
      const updated = await customerProfileApi.updateProfile({
        fullName: profileForm.fullName,
        email: profileForm.email.trim() ? profileForm.email : null
      }, customerAuth.token);
      setProfile(updated);
      setIsEditingProfile(false);
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddressModal = (address?: CustomerAddress) => {
    if (address) {
      setEditingAddressId(address.id);
      const addrType = address.addressType || (address.label?.toUpperCase() as any) || 'HOME';
      setAddressForm({
        addressType: addrType === 'WORK' ? 'WORK' : addrType === 'OTHER' ? 'OTHER' : 'HOME',
        label: address.label || (addrType === 'WORK' ? 'Work' : addrType === 'OTHER' ? 'Other' : 'Home'),
        recipientName: address.recipientName || address.fullName || '',
        recipientPhone: address.recipientPhone || address.mobileNumber || '',
        addressLine1: address.addressLine1 || '',
        addressLine2: address.addressLine2 || '',
        landmark: address.landmark || '',
        city: address.city || '',
        state: address.state || '',
        pincode: address.pincode || '',
        deliveryAddress: address.formattedAddress || address.deliveryAddress || '',
        default: address.default || address.isDefault || false,
      });
    } else {
      setEditingAddressId(null);
      setAddressForm({
        addressType: 'HOME',
        label: 'Home',
        recipientName: profile?.fullName || '',
        recipientPhone: profile?.mobile || '',
        addressLine1: '',
        addressLine2: '',
        landmark: '',
        city: shop.city || '',
        state: '',
        pincode: '',
        deliveryAddress: '',
        default: addresses.length === 0,
      });
    }
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerAuth.token) return;
    
    if (
      !addressForm.recipientName.trim() ||
      !addressForm.recipientPhone.trim() ||
      !addressForm.addressLine1.trim() ||
      !addressForm.city.trim() ||
      !addressForm.pincode.trim()
    ) {
      toast.error('Please fill in recipient name, phone, address line 1, city, and PIN code.');
      return;
    }

    if (!/^[1-9][0-9]{5}$/.test(addressForm.pincode.trim())) {
      toast.error('Please enter a valid 6-digit Indian PIN code (e.g. 560001).');
      return;
    }

    const cleanRecipientPhone = addressForm.recipientPhone.trim().replace(/^0+/, '');
    if (!cleanRecipientPhone || !/^\+?[1-9]\d{9,14}$/.test(cleanRecipientPhone)) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }

    const composedAddress = [
      addressForm.addressLine1.trim(),
      addressForm.addressLine2.trim() || null,
      addressForm.landmark.trim() ? `Near ${addressForm.landmark.trim()}` : null,
      addressForm.city.trim(),
      addressForm.state.trim() || null,
      addressForm.pincode.trim(),
    ].filter(Boolean).join(', ');

    const payload = {
      fullName: addressForm.recipientName.trim(),
      recipientName: addressForm.recipientName.trim(),
      mobileNumber: cleanRecipientPhone,
      recipientPhone: cleanRecipientPhone,
      addressLine1: addressForm.addressLine1.trim(),
      addressLine2: addressForm.addressLine2.trim() || undefined,
      landmark: addressForm.landmark.trim() || undefined,
      city: addressForm.city.trim(),
      state: addressForm.state.trim() || undefined,
      pincode: addressForm.pincode.trim(),
      addressType: addressForm.addressType,
      label: addressForm.label || (addressForm.addressType === 'HOME' ? 'Home' : addressForm.addressType === 'WORK' ? 'Work' : 'Other'),
      deliveryAddress: composedAddress,
      default: addressForm.default,
      isDefault: addressForm.default,
    };
    
    setIsLoading(true);
    try {
      if (editingAddressId) {
        await customerProfileApi.updateAddress(editingAddressId, payload, customerAuth.token);
        toast.success('Address updated successfully!');
      } else {
        await customerProfileApi.addAddress(payload, customerAuth.token);
        toast.success('Address added successfully!');
      }
      setIsAddressModalOpen(false);
      loadProfileData(customerAuth.token);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to save address');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAddress = async (id: number) => {
    if (!customerAuth.token) return;
    if (!confirm('Are you sure you want to delete this address?')) return;
    
    try {
      await customerProfileApi.deleteAddress(id, customerAuth.token);
      toast.success('Address deleted successfully');
      loadProfileData(customerAuth.token);
    } catch (err: any) {
      toast.error('Failed to delete address');
    }
  };

  const handleSetDefaultAddress = async (id: number) => {
    if (!customerAuth.token) return;
    try {
      await customerProfileApi.setDefaultAddress(id, customerAuth.token);
      toast.success('Default address updated');
      loadProfileData(customerAuth.token);
    } catch (err: any) {
      toast.error('Failed to set default address');
    }
  };

  if (step === 'PHONE' || step === 'OTP') {
    return (
      <div className="max-w-md mx-auto mt-10">
        <Card className="p-8 shadow-soft border-brand-border/60 relative overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-xl">
              <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCircle className="w-8 h-8 text-brand-primary" />
            </div>
            <h2 className="text-2xl font-bold text-brand-text mb-2">My Profile</h2>
            <p className="text-brand-muted">
              {step === 'PHONE' ? 'Enter your phone number to access your profile' : 'Verify your phone number'}
            </p>
          </div>

          {step === 'PHONE' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <Input
                label="Mobile Number"
                placeholder="10-digit mobile number"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                required
              />
              <Button type="submit" variant="primary" className="w-full h-12 text-base">
                Request OTP
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-sm font-medium text-brand-text">Sent to +91 {phoneInput}</span>
                <button
                  type="button"
                  onClick={() => setStep('PHONE')}
                  className="text-sm text-brand-primary hover:underline font-medium"
                >
                  Change
                </button>
              </div>
              <Input
                label="Enter OTP"
                placeholder="6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
              />
              <div className="flex justify-end items-center mt-1 mb-2">
                {resendTimer > 0 ? (
                  <span className="text-xs text-brand-muted font-medium">
                    Resend OTP in {resendTimer}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => handleRequestOtp()}
                    disabled={isLoading}
                    className="text-xs font-bold text-brand-primary hover:text-brand-primary-hover transition-colors"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
              <Button type="submit" variant="primary" className="w-full h-12 text-base">
                Verify & Proceed
              </Button>
            </form>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-brand-text">My Profile</h1>
        <Button variant="outline" size="sm" onClick={() => customerAuth.logout()}>
          Logout
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <Card className="p-6 border border-brand-border/60 shadow-soft">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-16 h-16 bg-brand-cream rounded-full flex items-center justify-center">
                <UserCircle className="w-8 h-8 text-brand-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-brand-text">
                  {profile?.fullName || 'CakeStore Customer'}
                </h3>
                <p className="text-brand-muted text-sm">{profile?.mobile}</p>
              </div>
            </div>

            {isEditingProfile ? (
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <Input
                  label="Full Name"
                  required
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                />
                <Input
                  label="Email Address (Optional)"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                />
                <div className="flex space-x-2 pt-2">
                  <Button type="submit" variant="primary" className="flex-1" isLoading={isLoading}>
                    Save
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsEditingProfile(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1">Full Name</p>
                  <p className="text-brand-text font-medium">{profile?.fullName || <span className="text-brand-muted italic">Not provided</span>}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1">Email</p>
                  <p className="text-brand-text font-medium">{profile?.email || <span className="text-brand-muted italic">Not provided</span>}</p>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-4" 
                  onClick={() => {
                    setProfileForm({ fullName: profile?.fullName || '', email: profile?.email || '' });
                    setIsEditingProfile(true);
                  }}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            )}
          </Card>
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-brand-text flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-brand-primary" />
              Saved Addresses
            </h2>
            <Button variant="primary" size="sm" onClick={() => handleOpenAddressModal()}>
              <Plus className="w-4 h-4 mr-1" />
              Add New
            </Button>
          </div>

          {addresses.length === 0 ? (
            <Card className="p-8 text-center border border-dashed border-brand-border/80 shadow-none bg-brand-cream/30">
              <MapPin className="w-12 h-12 text-brand-muted/50 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-brand-text mb-1">No saved addresses</h3>
              <p className="text-brand-muted text-sm mb-4">Add a delivery address for faster checkout.</p>
              <Button variant="outline" onClick={() => handleOpenAddressModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Address
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {addresses.map((address) => {
                const isDef = address.default || address.isDefault;
                const addrType = address.addressType || (address.label?.toUpperCase() as any) || 'HOME';
                return (
                  <Card key={address.id} className={`p-5 border transition-all duration-200 ${isDef ? 'border-brand-primary shadow-md' : 'border-brand-border/60 shadow-soft'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant={isDef ? 'info' : 'default'} className="uppercase text-[10px] flex items-center gap-1">
                          {addrType === 'WORK' && <Briefcase className="w-3 h-3" />}
                          {addrType === 'OTHER' && <Building2 className="w-3 h-3" />}
                          {addrType === 'HOME' && <Home className="w-3 h-3" />}
                          <span>{address.label || addrType}</span>
                        </Badge>
                        {isDef && (
                          <span className="flex items-center text-xs text-brand-primary font-medium">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Default
                          </span>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <button onClick={() => handleOpenAddressModal(address)} className="p-1.5 text-brand-muted hover:text-brand-primary hover:bg-brand-cream rounded-md transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteAddress(address.id)} className="p-1.5 text-brand-muted hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-1 mb-4 text-xs">
                      <p className="font-bold text-brand-text text-sm">{address.recipientName || address.fullName}</p>
                      <p className="text-brand-muted">{address.recipientPhone || address.mobileNumber}</p>
                      <p className="text-brand-text mt-1.5 line-clamp-3 leading-relaxed">{address.formattedAddress || address.deliveryAddress}</p>
                      {address.pincode && (
                        <p className="text-[11px] text-brand-muted">
                          PIN: <span className="font-medium text-brand-text">{address.pincode}</span>
                        </p>
                      )}
                    </div>

                    {!isDef && (
                      <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={() => handleSetDefaultAddress(address.id)}>
                        Set as Default
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        title={editingAddressId ? 'Edit Address' : 'Add New Address'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveAddress} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(['HOME', 'WORK', 'OTHER'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={`py-2 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  addressForm.addressType === type
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' 
                    : 'border-brand-border/60 text-brand-muted hover:border-brand-border'
                }`}
                onClick={() =>
                  setAddressForm({
                    ...addressForm,
                    addressType: type,
                    label: type === 'HOME' ? 'Home' : type === 'WORK' ? 'Work' : 'Other',
                  })
                }
              >
                {type === 'HOME' && <Home className="w-3.5 h-3.5" />}
                {type === 'WORK' && <Briefcase className="w-3.5 h-3.5" />}
                {type === 'OTHER' && <Building2 className="w-3.5 h-3.5" />}
                <span>{type === 'HOME' ? 'Home' : type === 'WORK' ? 'Work' : 'Other'}</span>
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Recipient Name"
              required
              value={addressForm.recipientName}
              onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })}
            />
            <Input
              label="Recipient Phone"
              required
              value={addressForm.recipientPhone}
              onChange={(e) => setAddressForm({ ...addressForm, recipientPhone: e.target.value.replace(/\D/g, '') })}
            />
          </div>
          
          <Input
            label="House / Flat / Building / Street (Line 1)"
            required
            placeholder="Flat 302, Palm Heights, 5th Cross"
            value={addressForm.addressLine1}
            onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Area / Locality (Line 2)"
              placeholder="Indiranagar (optional)"
              value={addressForm.addressLine2}
              onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
            />
            <Input
              label="Landmark"
              placeholder="Near Metro Station (optional)"
              value={addressForm.landmark}
              onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="City"
              required
              value={addressForm.city}
              onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
            />
            <Input
              label="State"
              value={addressForm.state}
              onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
            />
            <Input
              label="PIN Code"
              required
              maxLength={6}
              value={addressForm.pincode}
              onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
            />
          </div>

          {!addressForm.default && (
            <label className="flex items-center space-x-2 cursor-pointer pt-2">
              <input
                type="checkbox"
                className="w-4 h-4 text-brand-primary border-brand-border rounded focus:ring-brand-primary cursor-pointer"
                checked={addressForm.default}
                onChange={(e) => setAddressForm({ ...addressForm, default: e.target.checked })}
              />
              <span className="text-sm text-brand-text">Make this my default address</span>
            </label>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-brand-border/30">
            <Button type="button" variant="outline" onClick={() => setIsAddressModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              Save Address
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
