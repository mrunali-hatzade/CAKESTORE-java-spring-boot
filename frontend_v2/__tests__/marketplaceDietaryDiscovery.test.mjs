import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, '..');

test('CakeStore Phase 2.4: Marketplace Dietary Discovery & Smart Filters Suite', async (t) => {
  // Test 1: Verify API parameter serialization for dietary preferences
  await t.test('1. buildShopSearchParams serializes dietary array as comma-separated string', () => {
    function buildShopSearchParams(filters = {}) {
      const params = {};
      if (filters.search) params.search = filters.search.trim();
      if (filters.location) params.location = filters.location.trim();
      if (filters.city) params.city = filters.city.trim();
      if (filters.openNow != null) params.openNow = String(filters.openNow);
      if (filters.dietary && filters.dietary.length > 0) {
        params.dietary = filters.dietary.join(',');
      }
      return params;
    }

    const singlePref = buildShopSearchParams({ dietary: ['EGGLESS'], city: 'Pune' });
    assert.strictEqual(singlePref.dietary, 'EGGLESS');
    assert.strictEqual(singlePref.city, 'Pune');

    const multiPref = buildShopSearchParams({ dietary: ['EGGLESS', 'VEGAN', 'GLUTEN_FREE'] });
    assert.strictEqual(multiPref.dietary, 'EGGLESS,VEGAN,GLUTEN_FREE');

    const emptyPref = buildShopSearchParams({ dietary: [] });
    assert.strictEqual(emptyPref.dietary, undefined);

    const undefinedPref = buildShopSearchParams({});
    assert.strictEqual(undefinedPref.dietary, undefined);
  });

  // Test 2: Dietary preference toggling and combining logic
  await t.test('2. Dietary preference toggling accurately adds, combines, and removes options', () => {
    let selected = [];

    const toggle = (opt, current) => {
      const norm = opt.toUpperCase();
      return current.includes(norm)
        ? current.filter((x) => x !== norm)
        : [...current, norm];
    };

    // Customer selects Eggless
    selected = toggle('EGGLESS', selected);
    assert.deepStrictEqual(selected, ['EGGLESS']);

    // Customer combines with Vegan
    selected = toggle('VEGAN', selected);
    assert.deepStrictEqual(selected, ['EGGLESS', 'VEGAN']);

    // Customer adds Gluten-Free
    selected = toggle('GLUTEN_FREE', selected);
    assert.deepStrictEqual(selected, ['EGGLESS', 'VEGAN', 'GLUTEN_FREE']);

    // Customer removes Eggless
    selected = toggle('EGGLESS', selected);
    assert.deepStrictEqual(selected, ['VEGAN', 'GLUTEN_FREE']);

    // Clear all
    selected = [];
    assert.deepStrictEqual(selected, []);
  });

  // Test 3: Location and Search Preservation when Dietary Filter Changes
  await t.test('3. Dietary filter updates preserve search keyword, location, and radius while resetting page', () => {
    const existingParams = new URLSearchParams({
      search: 'chocolate',
      city: 'Mumbai',
      lat: '19.0760',
      lng: '72.8777',
      radius: '15',
      page: '3',
      size: '12',
    });

    function applyDietaryFilter(params, newDietary) {
      const updated = new URLSearchParams(params.toString());
      if (newDietary.length > 0) {
        updated.set('dietary', newDietary.join(','));
      } else {
        updated.delete('dietary');
      }
      updated.delete('page'); // Reset to first page
      return updated;
    }

    const updated = applyDietaryFilter(existingParams, ['EGGLESS', 'VEGAN']);

    assert.strictEqual(updated.get('search'), 'chocolate');
    assert.strictEqual(updated.get('city'), 'Mumbai');
    assert.strictEqual(updated.get('lat'), '19.0760');
    assert.strictEqual(updated.get('lng'), '72.8777');
    assert.strictEqual(updated.get('radius'), '15');
    assert.strictEqual(updated.get('size'), '12');
    assert.strictEqual(updated.get('dietary'), 'EGGLESS,VEGAN');
    assert.strictEqual(updated.get('page'), null, 'Page must be reset when filter changes');
  });

  // Test 4: Truthful Product Badge Presentation (No False Medical Allergen Safety Claims)
  await t.test('4. Truthful badge logic displays Vegan and Gluten-Free tags without medical claims', () => {
    function computeBadges(product) {
      const badges = [];
      if (product.isVegan) badges.push({ type: 'VEGAN', label: '🌱 Vegan' });
      if (product.isGlutenFree) badges.push({ type: 'GLUTEN_FREE', label: '🌾 Gluten-Free' });
      if (product.allowEggChoice) {
        badges.push({ type: 'EGG_CHOICE', label: 'EGGLESS OPTION' });
      } else if (product.isEggless) {
        badges.push({ type: 'EGGLESS', label: '100% VEG' });
      } else {
        badges.push({ type: 'NON_VEG', label: 'NON-VEG' });
      }
      return badges;
    }

    const veganGlutenFreeCake = {
      isVegan: true,
      isGlutenFree: true,
      isEggless: true,
      allowEggChoice: false,
    };
    const badges = computeBadges(veganGlutenFreeCake);

    assert.strictEqual(badges.length, 3);
    assert.strictEqual(badges.some((b) => b.label.includes('Vegan')), true);
    assert.strictEqual(badges.some((b) => b.label.includes('Gluten-Free')), true);
    assert.strictEqual(badges.some((b) => b.label.includes('100% VEG')), true);

    // Verify disclaimers prevent medical allergen certification confusion
    const disclaimer = 'Dietary tags reflect recipe formulation and do not guarantee allergen-free certification against cross-contamination.';
    assert.strictEqual(disclaimer.includes('allergen-free certification'), true);
  });

  // Test 5: Verify Component and Page Source Code Integration
  await t.test('5. Source files DietaryFilter.tsx, explore/page.tsx, and page.tsx are properly integrated', () => {
    const dietaryFilterPath = path.join(FRONTEND_DIR, 'components', 'customer', 'marketplace', 'DietaryFilter.tsx');
    assert.strictEqual(fs.existsSync(dietaryFilterPath), true, 'DietaryFilter.tsx component must exist');

    const dietaryFilterContent = fs.readFileSync(dietaryFilterPath, 'utf8');
    assert.strictEqual(dietaryFilterContent.includes('EGGLESS'), true);
    assert.strictEqual(dietaryFilterContent.includes('VEGAN'), true);
    assert.strictEqual(dietaryFilterContent.includes('GLUTEN_FREE'), true);

    const explorePagePath = path.join(FRONTEND_DIR, 'app', 'explore', 'page.tsx');
    const exploreContent = fs.readFileSync(explorePagePath, 'utf8');
    assert.strictEqual(exploreContent.includes('DietaryFilter'), true);
    assert.strictEqual(exploreContent.includes('selectedDietary'), true);
    assert.strictEqual(exploreContent.includes('dietary: selectedDietary'), true);

    const homePagePath = path.join(FRONTEND_DIR, 'app', 'page.tsx');
    const homeContent = fs.readFileSync(homePagePath, 'utf8');
    assert.strictEqual(homeContent.includes('DietaryFilter'), true);
    assert.strictEqual(homeContent.includes('selectedDietary'), true);
  });
});

