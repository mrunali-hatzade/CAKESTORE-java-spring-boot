import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Helper mirroring the dirty-state snapshot calculation from OwnerWebsitePage (page.tsx)
function computeBatchSnapshot(state) {
  return JSON.stringify({
    logoUrl: state.logoUrl,
    coverImageUrl: state.coverImageUrl,
    businessName: state.businessName,
    aboutStory: state.aboutStory,
    aboutImageUrl: state.aboutImageUrl,
    showAboutImage: state.showAboutImage,
    whatsappNumber: state.whatsappNumber,
    phone: state.phone,
    email: state.email,
    address: state.address,
    mapLocationUrl: state.mapLocationUrl,
    deliveryConfig: state.deliveryConfig,
    storefrontSettings: state.storefrontSettings,
  });
}

function createInitialState() {
  return {
    // Batch-persisted shop profile
    logoUrl: 'https://example.com/logo.png',
    coverImageUrl: 'https://example.com/cover.png',
    businessName: 'Original Bakery',
    aboutStory: 'Our delicious bakery story',
    aboutImageUrl: 'https://example.com/about.png',
    showAboutImage: true,
    whatsappNumber: '9876543210',
    phone: '9876543210',
    email: 'bakery@example.com',
    address: '123 Bakery Lane',
    mapLocationUrl: 'https://maps.google.com/?q=bakery',

    // Batch-persisted delivery config
    deliveryConfig: {
      deliveryChargeType: 'FIXED',
      fixedChargeAmount: 50,
      minOrderForFreeDelivery: 1000,
    },

    // Batch-persisted storefront settings
    storefrontSettings: {
      heroBannerEnabled: true,
      topRatedEnabled: true,
      reviewsEnabled: true,
      bakeryInfoEnabled: true,
      categoriesEnabled: true,
      filtersEnabled: true,
      ratingsEnabled: true,
      aboutStoryEnabled: true,
      aboutImageEnabled: true,
      fulfillmentEnabled: true,
      leadTimeDays: 2,
      leadTimeMessage: 'Orders require 2 days advance booking.',
      customCakesEnabled: true,
      whatsappEnabled: true,
      phoneEnabled: true,
      emailEnabled: true,
      addressEnabled: true,
      mapEnabled: true,
      businessHoursEnabled: true,
    },

    // Instant-saved entities
    banners: [
      { id: 1, title: 'Summer Sale', imageUrl: 'https://example.com/banner1.png', isActive: true, displayOrder: 0 }
    ],
    businessHours: [
      { id: 10, dayOfWeek: 'MONDAY', isOpen: true, openTime: '09:00:00', closeTime: '21:00:00' }
    ],
    customFields: [
      { id: 100, fieldKey: 'flavor', fieldLabel: 'Preferred Flavor', fieldType: 'TEXT', isRequired: true }
    ],
  };
}

describe('Owner Storefront Website - Dirty-State Tracking', () => {

  test('Instant-saved banners, hours, and custom fields do not trigger false global dirty state', () => {
    const state = createInitialState();
    const initialSnapshot = computeBatchSnapshot(state);

    // 1. Add / modify instant-saved banner
    state.banners.push({
      id: 2,
      title: 'New Autumn Cake',
      imageUrl: 'https://example.com/banner2.png',
      isActive: true,
      displayOrder: 1,
    });
    assert.equal(computeBatchSnapshot(state), initialSnapshot, 'Adding a banner must not change the batch snapshot');

    // 2. Modify instant-saved business hours
    state.businessHours[0].openTime = '10:00:00';
    assert.equal(computeBatchSnapshot(state), initialSnapshot, 'Updating business hours must not change the batch snapshot');

    // 3. Add instant-saved custom cake field
    state.customFields.push({
      id: 101,
      fieldKey: 'eggless',
      fieldLabel: 'Eggless Option',
      fieldType: 'CHECKBOX',
      isRequired: false,
    });
    assert.equal(computeBatchSnapshot(state), initialSnapshot, 'Adding a custom field must not change the batch snapshot');

    // Check dirty calculation
    const isDirty = computeBatchSnapshot(state) !== initialSnapshot;
    assert.equal(isDirty, false, 'Global form must remain clean (not dirty) after instant saves');
  });

  test('Batch-persisted settings still trigger the dirty state when modified', () => {
    const state = createInitialState();
    const initialSnapshot = computeBatchSnapshot(state);

    // 1. Modify business name in shop profile
    state.businessName = 'Renamed Sweet Bakery';
    let isDirty = computeBatchSnapshot(state) !== initialSnapshot;
    assert.equal(isDirty, true, 'Editing shop profile must trigger dirty state');

    // Revert back
    state.businessName = 'Original Bakery';
    isDirty = computeBatchSnapshot(state) !== initialSnapshot;
    assert.equal(isDirty, false, 'Reverting shop profile must restore clean state');

    // 2. Modify delivery config
    state.deliveryConfig = { ...state.deliveryConfig, fixedChargeAmount: 75 };
    isDirty = computeBatchSnapshot(state) !== initialSnapshot;
    assert.equal(isDirty, true, 'Editing delivery config must trigger dirty state');

    // Revert back
    state.deliveryConfig = { ...state.deliveryConfig, fixedChargeAmount: 50 };
    isDirty = computeBatchSnapshot(state) !== initialSnapshot;
    assert.equal(isDirty, false, 'Reverting delivery config must restore clean state');

    // 3. Modify storefront settings (e.g., lead time days)
    state.storefrontSettings = { ...state.storefrontSettings, leadTimeDays: 3 };
    isDirty = computeBatchSnapshot(state) !== initialSnapshot;
    assert.equal(isDirty, true, 'Editing storefront settings must trigger dirty state');
  });

  test('Successful batch save resets dirty state', () => {
    const state = createInitialState();
    let initialSnapshot = computeBatchSnapshot(state);

    // Make batch modifications
    state.businessName = 'Published Bakery Brand';
    state.deliveryConfig = { ...state.deliveryConfig, minOrderForFreeDelivery: 1500 };
    state.storefrontSettings = { ...state.storefrontSettings, topRatedEnabled: false };

    let isDirty = computeBatchSnapshot(state) !== initialSnapshot;
    assert.equal(isDirty, true, 'State should be dirty before save');

    // Simulate successful batch save
    initialSnapshot = computeBatchSnapshot(state);
    isDirty = computeBatchSnapshot(state) !== initialSnapshot;
    assert.equal(isDirty, false, 'Dirty state must be reset to clean after successful batch save');
  });

  test('Failed batch save does not incorrectly discard unsaved changes', () => {
    const state = createInitialState();
    const initialSnapshot = computeBatchSnapshot(state);

    // Make batch modifications
    state.businessName = 'Unpublished Bakery';
    state.storefrontSettings = { ...state.storefrontSettings, leadTimeDays: 5 };

    let isDirty = computeBatchSnapshot(state) !== initialSnapshot;
    assert.equal(isDirty, true, 'State should be dirty before save');

    // Simulate batch save failure (network error or validation error)
    // When an error occurs, setInitialSnapshot is NOT called, so initialSnapshot remains unchanged
    isDirty = computeBatchSnapshot(state) !== initialSnapshot;
    assert.equal(isDirty, true, 'Failed save must preserve dirty state so user does not lose unsaved warning');
  });
});
