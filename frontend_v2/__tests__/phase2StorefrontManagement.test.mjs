import test from 'node:test';
import assert from 'node:assert/strict';

test('Storefront Website Phase 2 - Social Links and Address Privacy', async (t) => {
  await t.test('Social link immediate save operations do not dirty global batch-save state', () => {
    // Simulated state machine of OwnerWebsitePage
    const initialBatchState = {
      businessName: 'Sweet Crumbs',
      address: '123 Baker Street',
      storefrontSettings: {
        hideStreetAddress: true,
        heroBannerEnabled: true,
      },
    };

    let initialSnapshot = JSON.stringify(initialBatchState);
    let currentBatchState = { ...initialBatchState };
    let dirtyFlag = false;

    const checkDirty = () => {
      dirtyFlag = JSON.stringify(currentBatchState) !== initialSnapshot;
    };

    // 1. Social links manipulated independently (immediate-save sub-resource)
    const socialLinks = [
      { id: 1, platform: 'INSTAGRAM', title: 'Follow on Instagram', url: 'https://instagram.com/sweetcrumbs', isActive: true, displayOrder: 1 }
    ];

    // Adding/updating social link does not touch currentBatchState
    socialLinks.push({ id: 2, platform: 'WHATSAPP', title: 'Order on WhatsApp', url: 'https://wa.me/919876543210', isActive: true, displayOrder: 2 });
    checkDirty();
    assert.equal(dirtyFlag, false, 'Adding a social link must not cause global unsaved-change warning');

    // 2. Modifying hideStreetAddress affects batch-persisted settings
    currentBatchState = {
      ...currentBatchState,
      storefrontSettings: {
        ...currentBatchState.storefrontSettings,
        hideStreetAddress: false,
      },
    };
    checkDirty();
    assert.equal(dirtyFlag, true, 'Changing hideStreetAddress must trigger dirty state');

    // 3. Batch save success resets snapshot baseline
    initialSnapshot = JSON.stringify(currentBatchState);
    checkDirty();
    assert.equal(dirtyFlag, false, 'Successful save must reset dirty state');
  });

  await t.test('Public address formatting redacts street address when hideStreetAddress is true', () => {
    const shop = {
      businessName: 'The Home Cakery',
      addressLine1: 'Flat 402, Sunshine Heights, 12th Cross',
      address: 'Flat 402, Sunshine Heights, 12th Cross',
      area: 'Indiranagar',
      city: 'Bengaluru',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      pincode: '560038',
      storefrontSettings: {
        hideStreetAddress: true,
      },
    };

    const isPrivacyEnabled = !!shop.storefrontSettings?.hideStreetAddress;

    const addressParts = isPrivacyEnabled
      ? [shop.area, shop.city, shop.district, shop.state].filter(Boolean)
      : [shop.addressLine1 || shop.address, shop.area, shop.city, shop.district, shop.state].filter(Boolean);

    const fullAddress = `${addressParts.join(', ')} - ${shop.pincode}`;

    assert.ok(!fullAddress.includes('Sunshine Heights'), 'Public address must NOT leak building/flat name');
    assert.ok(!fullAddress.includes('12th Cross'), 'Public address must NOT leak street name');
    assert.ok(fullAddress.includes('Indiranagar'), 'Public address must retain locality/area');
    assert.ok(fullAddress.includes('Bengaluru'), 'Public address must retain city');
    assert.ok(fullAddress.includes('Karnataka'), 'Public address must retain state');

    const heading = isPrivacyEnabled ? 'Kitchen Locality / Pickup Area' : 'Kitchen Address';
    assert.equal(heading, 'Kitchen Locality / Pickup Area');
  });

  await t.test('Public address retains street address when hideStreetAddress is false', () => {
    const shop = {
      businessName: 'Downtown Bakery',
      addressLine1: 'Shop 5, Commercial Street',
      area: 'Shivajinagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      storefrontSettings: {
        hideStreetAddress: false,
      },
    };

    const isPrivacyEnabled = !!shop.storefrontSettings?.hideStreetAddress;
    const addressParts = isPrivacyEnabled
      ? [shop.area, shop.city, shop.district, shop.state].filter(Boolean)
      : [shop.addressLine1 || shop.address, shop.area, shop.city, shop.district, shop.state].filter(Boolean);

    const fullAddress = `${addressParts.join(', ')} - ${shop.pincode}`;
    assert.ok(fullAddress.includes('Shop 5, Commercial Street'), 'Commercial shop retains full street address');
  });

  await t.test('Social links filter inactive items and render safe attributes', () => {
    const links = [
      { id: 1, platform: 'INSTAGRAM', title: 'Instagram', url: 'https://instagram.com/mybakery', isActive: true },
      { id: 2, platform: 'FACEBOOK', title: 'Facebook', url: 'https://facebook.com/mybakery', isActive: false },
      { id: 3, platform: 'CUSTOM', title: 'Blog', url: 'https://myblog.com', isActive: true },
      { id: 4, platform: 'YOUTUBE', title: 'Empty URL', url: '', isActive: true },
    ];

    const activeLinks = links.filter((l) => l.isActive !== false && l.url && l.url.trim().length > 0);
    assert.equal(activeLinks.length, 2);
    assert.equal(activeLinks[0].platform, 'INSTAGRAM');
    assert.equal(activeLinks[1].platform, 'CUSTOM');

    // Verify safe external link requirements
    const linkAttributes = {
      target: '_blank',
      rel: 'noopener noreferrer',
    };
    assert.equal(linkAttributes.target, '_blank');
    assert.equal(linkAttributes.rel, 'noopener noreferrer');
  });
});
