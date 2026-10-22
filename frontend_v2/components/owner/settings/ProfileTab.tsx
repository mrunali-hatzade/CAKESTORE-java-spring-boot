import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Save, Store, FileText, Clock, FileCheck, Eye, AlertCircle, ShieldCheck, ShieldAlert, Upload, RefreshCw, ExternalLink, Leaf, MapPin, Navigation } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { ownerApi } from '@/lib/api/owner';
import { mediaApi } from '@/lib/api/media';
import { ShopSettings } from '@/types/owner';
import CascadingLocationSelector from '@/components/owner/CascadingLocationSelector';
import { useUnsavedChanges } from '@/context/UnsavedChangesContext';
import dynamic from 'next/dynamic';

const InteractiveLocationMap = dynamic(
  () => import('@/components/owner/InteractiveLocationMap'),
  { ssr: false, loading: () => <div className="h-64 rounded-2xl bg-neutral-100 flex items-center justify-center text-xs text-brand-muted">Loading interactive map...</div> }
);

interface ProfileTabProps {
  initialProfile: ShopSettings | null;
  verificationInfo: any | null;
  isAdminWithoutShop: boolean;
  onUpdate: () => void;
  updateShopContext: (shop: ShopSettings) => void;
}

export default function ProfileTab({
  initialProfile,
  verificationInfo,
  isAdminWithoutShop,
  onUpdate,
  updateShopContext
}: ProfileTabProps) {
  const [businessName, setBusinessName] = useState(initialProfile?.businessName || '');
  const [description, setDescription] = useState(initialProfile?.description || '');
  const [phone, setPhone] = useState(initialProfile?.phone || '');
  const [email, setEmail] = useState(initialProfile?.email || '');
  const [addressLine1, setAddressLine1] = useState(initialProfile?.addressLine1 || initialProfile?.address || '');
  const [addressLine2, setAddressLine2] = useState(initialProfile?.addressLine2 || '');
  const [state, setState] = useState(initialProfile?.state || '');
  const [district, setDistrict] = useState(initialProfile?.district || '');
  const [city, setCity] = useState(initialProfile?.city || '');
  const [area, setArea] = useState(initialProfile?.area || '');
  const [pincode, setPincode] = useState(initialProfile?.pincode || '');
  const [latitude, setLatitude] = useState<string>(
    initialProfile?.latitude !== undefined && initialProfile?.latitude !== null ? String(initialProfile.latitude) : ''
  );
  const [longitude, setLongitude] = useState<string>(
    initialProfile?.longitude !== undefined && initialProfile?.longitude !== null ? String(initialProfile.longitude) : ''
  );
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);
  const [fssaiRegistration, setFssaiRegistration] = useState(initialProfile?.fssaiRegistration || '');

  const [locationErrors, setLocationErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // FSSAI Document Certificate state
  const [fssaiFile, setFssaiFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docUploadSuccess, setDocUploadSuccess] = useState<string | null>(null);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const { setDirty } = useUnsavedChanges();

  // Snapshot for dirty state tracking
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  const currentSnapshot = JSON.stringify({
    businessName, description, phone, email, addressLine1, addressLine2,
    state, district, city, area, pincode, fssaiRegistration, latitude, longitude
  });

  useEffect(() => {
    if (initialSnapshot === null) {
      setInitialSnapshot(currentSnapshot);
    } else {
      setDirty('settings-profile', currentSnapshot !== initialSnapshot);
    }
  }, [currentSnapshot, initialSnapshot, setDirty]);

  useEffect(() => {
    return () => setDirty('settings-profile', false);
  }, [setDirty]);

  // Sync state if initialProfile updates
  useEffect(() => {
    if (initialProfile) {
      setBusinessName(initialProfile.businessName || '');
      setDescription(initialProfile.description || '');
      setPhone(initialProfile.phone || '');
      setEmail(initialProfile.email || '');
      setAddressLine1(initialProfile.addressLine1 || initialProfile.address || '');
      setAddressLine2(initialProfile.addressLine2 || '');
      setState(initialProfile.state || '');
      setDistrict(initialProfile.district || '');
      setCity(initialProfile.city || '');
      setArea(initialProfile.area || '');
      setPincode(initialProfile.pincode || '');
      setLatitude(initialProfile.latitude !== undefined && initialProfile.latitude !== null ? String(initialProfile.latitude) : '');
      setLongitude(initialProfile.longitude !== undefined && initialProfile.longitude !== null ? String(initialProfile.longitude) : '');
      setFssaiRegistration(initialProfile.fssaiRegistration || '');
    }
  }, [initialProfile]);

  const fssaiDoc = verificationInfo?.documents?.find(
    (d: any) => d.documentType === 'FSSAI_CERTIFICATE'
  );

  const handleUploadFssaiDoc = async () => {
    if (!fssaiFile || isAdminWithoutShop) return;
    setIsUploadingDoc(true);
    setDocUploadError(null);
    setDocUploadSuccess(null);

    try {
      const { url } = await mediaApi.uploadImage(fssaiFile, 'documents');
      await ownerApi.uploadVerificationDocument({
        documentType: 'FSSAI_CERTIFICATE',
        fileUrl: url,
      });

      setDocUploadSuccess('FSSAI Certificate uploaded and submitted for review!');
      setFssaiFile(null);
      setFileInputKey(Date.now()); // React way to reset uncontrolled input
      onUpdate();
    } catch (err: any) {
      setDocUploadError(err?.message || 'Failed to upload FSSAI document. Ensure file is under 5MB (PDF/JPG/PNG).');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDetectGps = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsNotice('Geolocation is not supported by your browser.');
      return;
    }
    setIsDetectingGps(true);
    setGpsNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingGps(false);
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setLatitude(lat);
        setLongitude(lng);
        setGpsNotice(`GPS pin acquired: ${lat}, ${lng}`);
      },
      (err) => {
        setIsDetectingGps(false);
        let msg = 'Failed to retrieve location.';
        if (err.code === 1) msg = 'Location access was denied. Please allow permission or enter coordinates manually.';
        else if (err.code === 2) msg = 'Position unavailable. Please enter coordinates manually.';
        else if (err.code === 3) msg = 'Location request timed out.';
        setGpsNotice(msg);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdminWithoutShop) return;
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const parsedLat = latitude.trim() !== '' ? parseFloat(latitude.trim()) : undefined;
    const parsedLng = longitude.trim() !== '' ? parseFloat(longitude.trim()) : undefined;

    try {
      const updated = await ownerApi.updateShopSettings({
        businessName,
        description,
        phone,
        email,
        addressLine1,
        addressLine2,
        city,
        state,
        district: district || undefined,
        area: area || undefined,
        pincode,
        latitude: parsedLat,
        longitude: parsedLng,
        fssaiRegistration,
      });

      if (fssaiFile) {
        try {
          const { url } = await mediaApi.uploadImage(fssaiFile, 'documents');
          await ownerApi.uploadVerificationDocument({
            documentType: 'FSSAI_CERTIFICATE',
            fileUrl: url,
          });
          setFssaiFile(null);
          setFileInputKey(Date.now());
          onUpdate();
        } catch (docErr: any) {
          console.warn('FSSAI document upload warning:', docErr);
        }
      }

      updateShopContext(updated);
      setInitialSnapshot(currentSnapshot);
      setDirty('settings-profile', false);
      setSuccessMsg('Bakery profile settings saved successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
      onUpdate();
    } catch (err: any) {
      const respData = err?.response?.data || {};
      const fieldErrors = respData?.fieldErrors || {};
      if (Object.keys(fieldErrors).length > 0) {
        setLocationErrors(fieldErrors);
      }
      setErrorMsg(err?.message || respData?.error || 'Failed to save bakery profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSaveProfile} className="space-y-6">
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <Card className="p-6 space-y-4">
        <h2 className="font-serif font-bold text-base text-owner-heading">Identity & Commercials</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Bakery Registered Name"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            disabled={isAdminWithoutShop || isSaving}
          />
          <Input
            label="FSSAI License / Registration #"
            placeholder="e.g. 11521000000000"
            value={fssaiRegistration}
            onChange={(e) => setFssaiRegistration(e.target.value)}
            disabled={isAdminWithoutShop || isSaving}
          />
        </div>

        {/* FSSAI Certificate Document Verification Block */}
        <div className="pt-3 border-t border-owner-border/70 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-plum" />
              <div>
                <h3 className="text-xs font-bold text-owner-heading">
                  FSSAI Food License / Registration Certificate
                </h3>
                <p className="text-[11px] text-owner-muted">
                  Official document required to activate verified status on your storefront.
                </p>
              </div>
            </div>

            <div>
              {fssaiDoc ? (
                fssaiDoc.status === 'VERIFIED' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Verified by Admin
                  </span>
                ) : fssaiDoc.status === 'REJECTED' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    Action Required
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Under Review
                  </span>
                )
              ) : (
                <span className="text-[11px] font-medium text-owner-muted px-2.5 py-1 rounded-lg bg-owner-canvas border border-owner-border">
                  Certificate Not Uploaded
                </span>
              )}
            </div>
          </div>

          {/* Current Attached Document Card if exists */}
          {fssaiDoc && (
            <div className="p-3.5 rounded-xl bg-owner-canvas/70 border border-owner-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-brand-blush text-brand-plum flex items-center justify-center shrink-0">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-owner-heading truncate">
                    Attached FSSAI Certificate
                  </p>
                  <p className="text-[11px] text-owner-muted">
                    Submitted: {new Date(fssaiDoc.createdAt || fssaiDoc.updatedAt || Date.now()).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              {fssaiDoc.fileUrl && (
                <a
                  href={fssaiDoc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-owner-border text-brand-plum hover:bg-brand-cream hover:text-brand-espresso transition-colors shrink-0 shadow-2xs cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Current Document</span>
                </a>
              )}
            </div>
          )}

          {/* Rejection / Note banner if rejected */}
          {(fssaiDoc?.status === 'REJECTED' || verificationInfo?.verificationStatus === 'REJECTED') && verificationInfo?.rejectionReason && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Admin Review Feedback:</span>
              </p>
              <p className="text-[11px] text-rose-700 pl-5 leading-relaxed">
                &ldquo;{verificationInfo.rejectionReason}&rdquo;
              </p>
            </div>
          )}

          {/* Upload Dropzone */}
          {!isAdminWithoutShop && (
            <div className="relative border-2 border-dashed border-owner-border hover:border-brand-plum/50 rounded-xl p-4 transition-colors bg-white text-center">
              <input
                key={fileInputKey}
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setFssaiFile(file);
                  setDocUploadError(null);
                  setDocUploadSuccess(null);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center pointer-events-none">
                <Upload className="w-5 h-5 text-brand-plum mb-1.5" />
                {fssaiFile ? (
                  <p className="text-xs font-semibold text-brand-plum">
                    Selected: {fssaiFile.name} ({(fssaiFile.size / 1024).toFixed(1)} KB)
                  </p>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-owner-heading">
                      {fssaiDoc ? 'Click or drag to upload a replacement certificate' : 'Upload FSSAI License or Registration Certificate'}
                    </p>
                    <p className="text-[11px] text-owner-muted mt-0.5">
                      Supports PDF, PNG, JPG up to 5MB. Fast-tracks your bakery verification badge.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Selected File Action Buttons */}
          {fssaiFile && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setFssaiFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
              >
                Cancel selection
              </button>

              <Button
                type="button"
                size="sm"
                disabled={isUploadingDoc || isAdminWithoutShop}
                onClick={handleUploadFssaiDoc}
                className="gap-1.5 shadow-2xs"
              >
                {isUploadingDoc ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading Certificate...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Submit Certificate for Verification</span>
                  </>
                )}
              </Button>
            </div>
          )}

          {docUploadSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{docUploadSuccess}</span>
            </div>
          )}

          {docUploadError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{docUploadError}</span>
            </div>
          )}
        </div>

        <Textarea
          label="Bakery Story & Customer Bio"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tell cake lovers what makes your bakes unique..."
          disabled={isAdminWithoutShop || isSaving}
        />
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="font-serif font-bold text-base text-owner-heading">Contact & Kitchen Location</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Kitchen Phone / Order Hotline"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isAdminWithoutShop || isSaving}
          />
          <Input
            label="Official Notification Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isAdminWithoutShop || isSaving}
          />
        </div>

        <Input
          label="Address Line 1"
          required
          placeholder="Shop No. 4, Ground Floor, Lane 3"
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          disabled={isAdminWithoutShop || isSaving}
        />

        <Input
          label="Address Line 2 / Landmark"
          placeholder="Near Datta Mandir, Akurdi"
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
          disabled={isAdminWithoutShop || isSaving}
        />

        <CascadingLocationSelector
          values={{ state, district, city, area, pincode }}
          onChange={(updated) => {
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
          }}
          fieldErrors={locationErrors}
          disabled={isSaving || isAdminWithoutShop}
        />

        {/* Interactive Map Pin & Confirmation */}
        <div className="pt-4 border-t border-owner-border/70 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand-plum shrink-0" />
            <div>
              <h3 className="text-xs font-bold text-owner-heading">
                Interactive Bakery Kitchen Map Pin
              </h3>
              <p className="text-[11px] text-owner-muted">
                Search your address, drag the pin to your exact kitchen doorway, or click on the map to confirm your bakery&apos;s exact location.
              </p>
            </div>
          </div>

          <InteractiveLocationMap
            initialLatitude={latitude && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : undefined}
            initialLongitude={longitude && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : undefined}
            initialConfirmed={Boolean(latitude && longitude && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude)))}
            addressContext={{
              addressLine1,
              area,
              city,
              state,
              pincode,
            }}
            onChange={(coords) => {
              setLatitude(coords.latitude !== undefined ? String(coords.latitude) : '');
              setLongitude(coords.longitude !== undefined ? String(coords.longitude) : '');
            }}
            disabled={isAdminWithoutShop || isSaving}
          />
        </div>

      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-serif font-bold text-base text-owner-heading">Operating Hours & Dietary Preferences</h2>
          <p className="text-xs text-owner-muted mt-0.5">
            Kitchen schedule and menu dietary configurations are managed in dedicated studio modules.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-2xl bg-brand-cream-light/60 border border-brand-border/60 flex flex-col justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-brand-blush text-brand-plum flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-owner-heading">7-Day Operating & Baking Schedule</h3>
                <p className="text-[11px] text-owner-muted mt-0.5">
                  Configure open/closed status and custom business hours for each day of the week.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/owner/website"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-plum hover:text-brand-espresso transition-colors"
            >
              <span>Manage Weekly Schedule</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/60 flex flex-col justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Leaf className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-emerald-950">Dietary & Eggless Preferences</h3>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Set 100% Pure Veg (eggless) or customizable egg choices individually per cake product.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/owner/products"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 transition-colors"
            >
              <span>Manage Product Catalog</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </Card>

      <Button type="submit" size="lg" className="w-full" isLoading={isSaving} disabled={isAdminWithoutShop}>
        <Save className="w-4 h-4 mr-2" />
        {isAdminWithoutShop ? 'Preview Mode (Read-Only for Admin)' : 'Save Bakery Profile Settings'}
      </Button>
    </form>
  );
}
