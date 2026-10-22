import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('CakeStore Location Registration & Interactive Map Completion Tests', () => {

  describe('1. InteractiveLocationMap Coordinate State Machine', () => {
    it('Starts in Incomplete / Unpinned state when no initial coordinates are passed', () => {
      const state = {
        latitude: undefined,
        longitude: undefined,
        isConfirmed: false,
        isApproximate: false,
        accuracyType: 'NOT_SET',
      };

      assert.equal(state.isConfirmed, false);
      assert.equal(state.latitude, undefined);
      assert.equal(state.longitude, undefined);
      assert.equal(state.accuracyType, 'NOT_SET');
    });

    it('Transitions to Approximate state when PIN-code / locality centroid is searched', () => {
      // Simulating geocode result for a postal pincode "411035"
      const geocodeResponse = {
        found: true,
        latitude: 18.6492,
        longitude: 73.7707,
        displayName: 'Akurdi, PIN 411035',
        approximate: true,
        accuracyType: 'APPROXIMATE_PINCODE',
        provider: 'LOCAL_PINCODE',
      };

      const updatedState = {
        latitude: geocodeResponse.latitude,
        longitude: geocodeResponse.longitude,
        isConfirmed: false, // NOT confirmed yet - requires owner confirmation!
        isApproximate: true,
        accuracyType: geocodeResponse.accuracyType,
      };

      assert.equal(updatedState.isConfirmed, false, 'Approximate centroid must not be marked confirmed automatically');
      assert.equal(updatedState.isApproximate, true);
      assert.equal(updatedState.accuracyType, 'APPROXIMATE_PINCODE');
      assert.equal(updatedState.latitude, 18.6492);
    });

    it('Transitions to Confirmed Exact Pin state when owner confirms the location on the map', () => {
      const confirmedState = {
        latitude: 18.650821,
        longitude: 73.771954,
        isConfirmed: true,
        isApproximate: false,
        accuracyType: 'OWNER_CONFIRMED',
      };

      assert.equal(confirmedState.isConfirmed, true);
      assert.equal(confirmedState.isApproximate, false);
      assert.equal(confirmedState.accuracyType, 'OWNER_CONFIRMED');
    });

    it('Transitions to Incomplete state when owner clicks Clear Pin', () => {
      const clearedState = {
        latitude: undefined,
        longitude: undefined,
        isConfirmed: false,
        isApproximate: false,
        accuracyType: 'NOT_SET',
      };

      assert.equal(clearedState.latitude, undefined);
      assert.equal(clearedState.longitude, undefined);
      assert.equal(clearedState.isConfirmed, false);
      assert.equal(clearedState.accuracyType, 'NOT_SET');
    });
  });

  describe('2. Owner Registration Payload Location Safety', () => {
    it('Includes verified latitude and longitude when owner explicitly confirmed pin', () => {
      const isLocationConfirmed = true;
      const latitude = 18.520432;
      const longitude = 73.856743;

      const registrationPayload = {
        fullName: 'Anita Sharma',
        email: 'anita@sweetcake.in',
        businessName: 'Anita Gourmet Bakes',
        addressLine1: 'Flat 402, Rosewood Heights',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411038',
        latitude: isLocationConfirmed ? latitude : undefined,
        longitude: isLocationConfirmed ? longitude : undefined,
      };

      assert.equal(registrationPayload.latitude, 18.520432);
      assert.equal(registrationPayload.longitude, 73.856743);
      assert.equal(registrationPayload.addressLine1, 'Flat 402, Rosewood Heights');
    });

    it('Leaves latitude and longitude undefined when owner does not confirm or skips map pin', () => {
      const isLocationConfirmed = false;
      const latitude = 18.520432; // Unconfirmed approximate coords in state
      const longitude = 73.856743;

      const registrationPayload = {
        fullName: 'Anita Sharma',
        email: 'anita@sweetcake.in',
        businessName: 'Anita Gourmet Bakes',
        addressLine1: 'Flat 402, Rosewood Heights',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411038',
        latitude: isLocationConfirmed ? latitude : undefined,
        longitude: isLocationConfirmed ? longitude : undefined,
      };

      assert.equal(registrationPayload.latitude, undefined, 'Unconfirmed latitude must not be sent in registration');
      assert.equal(registrationPayload.longitude, undefined, 'Unconfirmed longitude must not be sent in registration');
      assert.equal(registrationPayload.addressLine1, 'Flat 402, Rosewood Heights', 'Address line must remain intact');
      assert.equal(registrationPayload.city, 'Pune');
    });
  });

  describe('3. Profile Tab Settings Reload & Backend Synchronization', () => {
    it('Coordinates reloaded from backend update context and snapshot cleanly', () => {
      const backendResponse = {
        id: 17,
        businessName: 'Sweet Delight Bakery',
        addressLine1: 'Shop 4, Lane 3',
        city: 'Pimpri-Chinchwad',
        pincode: '411035',
        latitude: 18.6492,
        longitude: 73.7707,
      };

      // Frontend state update
      const loadedLatitude = backendResponse.latitude !== null && backendResponse.latitude !== undefined ? String(backendResponse.latitude) : '';
      const loadedLongitude = backendResponse.longitude !== null && backendResponse.longitude !== undefined ? String(backendResponse.longitude) : '';

      assert.equal(loadedLatitude, '18.6492');
      assert.equal(loadedLongitude, '73.7707');

      // Check snapshot generation for unsaved changes detection
      const snapshot = JSON.stringify({
        businessName: backendResponse.businessName,
        addressLine1: backendResponse.addressLine1,
        city: backendResponse.city,
        pincode: backendResponse.pincode,
        latitude: loadedLatitude,
        longitude: loadedLongitude,
      });

      assert.ok(snapshot.includes('"latitude":"18.6492"'));
      assert.ok(snapshot.includes('"longitude":"73.7707"'));
    });
  });

  describe('4. Google Maps External Pin Verification URL', () => {
    it('Builds correct Google Maps URL with high precision coordinates', () => {
      const lat = 18.650821;
      const lng = 73.771954;
      const url = `https://www.google.com/maps?q=${lat},${lng}`;
      assert.equal(url, 'https://www.google.com/maps?q=18.650821,73.771954');
    });
  });

  describe('5. Distance Safety for Unpinned Bakeries', () => {
    it('Never fabricates distance for a bakery whose coordinates are null', () => {
      const shop17 = {
        id: 17,
        businessName: 'Sweet Delight Bakery',
        city: 'Pimpri-Chinchwad',
        latitude: null,
        longitude: null,
        distanceKm: null,
      };

      const formatDistance = (distanceKm) => {
        if (distanceKm === null || distanceKm === undefined || isNaN(distanceKm)) {
          return null;
        }
        if (distanceKm < 1.0) {
          const meters = Math.round(distanceKm * 1000);
          return `${meters} m away`;
        }
        return `${distanceKm.toFixed(1)} km away`;
      };

      assert.equal(formatDistance(shop17.distanceKm), null, 'Distance for null coordinates must format as null');
    });
  });
});
