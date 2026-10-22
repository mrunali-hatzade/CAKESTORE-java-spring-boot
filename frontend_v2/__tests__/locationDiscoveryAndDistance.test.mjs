import test from 'node:test';
import assert from 'node:assert/strict';

test('CakeStore Location Discovery & Distance Unit Tests', async (t) => {

  await t.test('1. Distance Formatting: Converts km to meters under 1km, preserves 1 decimal place above 1km', () => {
    const formatDistance = (distanceKm) => {
      if (distanceKm == null || isNaN(distanceKm)) return null;
      if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)} m away`;
      }
      return `${distanceKm.toFixed(1)} km away`;
    };

    assert.equal(formatDistance(0.85), '850 m away');
    assert.equal(formatDistance(0.05), '50 m away');
    assert.equal(formatDistance(2.43), '2.4 km away');
    assert.equal(formatDistance(12.78), '12.8 km away');
    assert.equal(formatDistance(null), null);
    assert.equal(formatDistance(undefined), null);
  });

  await t.test('2. Straight-line (aerial) distance indicator: Distinguishes straight-line distance from driving distance', () => {
    const getDistanceBadge = (distanceKm) => {
      if (distanceKm == null || isNaN(distanceKm)) return null;
      const text = distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m away` : `${distanceKm.toFixed(1)} km away`;
      const title = 'Calculated straight-line (aerial) distance. Driving distance may vary.';
      const badgeSuffix = '(direct)';
      return { text, title, badgeSuffix };
    };

    const badge = getDistanceBadge(1.8);
    assert.ok(badge);
    assert.equal(badge.text, '1.8 km away');
    assert.ok(badge.title.includes('straight-line'));
    assert.ok(badge.title.includes('Driving distance may vary'));
    assert.equal(badge.badgeSuffix, '(direct)');
  });

  await t.test('3. Google Maps Directions URL Generation: Uses precise lat/long coordinates when available', () => {
    const getDirectionsUrl = (shop) => {
      if (shop.latitude && shop.longitude && !isNaN(shop.latitude) && !isNaN(shop.longitude)) {
        return `https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`;
      }
      const fullAddr = [shop.addressLine1 || shop.address, shop.area, shop.city, shop.state, shop.pincode]
        .filter(Boolean)
        .join(', ');
      if (fullAddr.trim()) {
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddr)}`;
      }
      return null;
    };

    const shopWithCoords = {
      id: 1,
      businessName: 'The Cake Room',
      latitude: 18.5204,
      longitude: 73.8567,
      city: 'Pune',
      state: 'Maharashtra',
    };
    assert.equal(
      getDirectionsUrl(shopWithCoords),
      'https://www.google.com/maps/dir/?api=1&destination=18.5204,73.8567'
    );

    const shopWithoutCoords = {
      id: 2,
      businessName: 'Sweet Street',
      addressLine1: 'Shop 5, Main Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    };
    assert.equal(
      getDirectionsUrl(shopWithoutCoords),
      'https://www.google.com/maps/dir/?api=1&destination=Shop%205%2C%20Main%20Road%2C%20Mumbai%2C%20Maharashtra%2C%20400001'
    );
  });

  await t.test('4. Sort by Distance (Nearest First): Orders bakeries by distance ascending and handles missing distance', () => {
    const shops = [
      { id: 1, businessName: 'Bakery C', distanceKm: 8.5 },
      { id: 2, businessName: 'Bakery A', distanceKm: 0.9 },
      { id: 3, businessName: 'Bakery D', distanceKm: null },
      { id: 4, businessName: 'Bakery B', distanceKm: 3.2 },
    ];

    const sorted = [...shops].sort((a, b) => {
      const distA = a.distanceKm != null ? a.distanceKm : Infinity;
      const distB = b.distanceKm != null ? b.distanceKm : Infinity;
      return distA - distB;
    });

    assert.equal(sorted[0].id, 2); // 0.9 km
    assert.equal(sorted[1].id, 4); // 3.2 km
    assert.equal(sorted[2].id, 1); // 8.5 km
    assert.equal(sorted[3].id, 3); // null distance placed last
  });

  await t.test('5. Distance Radius Selection: Updates radius and keeps customer coordinates', () => {
    let geoParams = { latitude: 18.5204, longitude: 73.8567, radiusKm: 10 };

    const updateRadius = (newRadius) => {
      geoParams = { ...geoParams, radiusKm: newRadius };
    };

    updateRadius(20);
    assert.equal(geoParams.radiusKm, 20);
    assert.equal(geoParams.latitude, 18.5204);
    assert.equal(geoParams.longitude, 73.8567);

    updateRadius(5);
    assert.equal(geoParams.radiusKm, 5);
  });

  await t.test('6. Location Clearing: Clears coordinates and resets geoParams', () => {
    let locationQuery = 'Current Location';
    let locationFilters = { city: 'Pune' };
    let geoParams = { latitude: 18.5204, longitude: 73.8567, radiusKm: 10 };

    const handleClearLocation = () => {
      locationQuery = '';
      locationFilters = {};
      geoParams = {};
    };

    handleClearLocation();
    assert.equal(locationQuery, '');
    assert.deepEqual(locationFilters, {});
    assert.deepEqual(geoParams, {});
  });
});
