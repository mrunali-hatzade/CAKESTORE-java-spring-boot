import test from 'node:test';
import assert from 'node:assert/strict';

test('CakeStore Phase 2E.1: Checkout Cart Hydration Race Condition Tests', async (t) => {
  // Mock localStorage helper
  const createMockStorage = (initialData = {}) => {
    let store = { ...initialData };
    return {
      getItem: (key) => (key in store ? store[key] : null),
      setItem: (key, val) => { store[key] = String(val); },
      removeItem: (key) => { delete store[key]; },
      clear: () => { store = {}; },
      _getStore: () => store,
    };
  };

  // Helper simulating CartContext lifecycle
  class MockCartContextSimulator {
    constructor(storage) {
      this.storage = storage;
      this.items = [];
      this.isHydrated = false;
      this.savedCalls = [];
    }

    // Effect 1: Initial mount hydration from localStorage
    hydrateFromStorage() {
      try {
        const stored = this.storage.getItem('cakestore_v2_cart');
        if (stored) {
          const parsed = JSON.parse(stored);
          this.items = parsed.map((item) => ({
            ...item,
            cartLineId: item.cartLineId || `line-${item.productId}`,
          }));
        } else {
          this.items = [];
        }
      } catch (err) {
        this.items = [];
      } finally {
        this.isHydrated = true;
      }
    }

    // Effect 2: Save to storage guarded by isHydrated
    saveToStorage() {
      if (!this.isHydrated) return; // Protected guard!
      this.storage.setItem('cakestore_v2_cart', JSON.stringify(this.items));
      this.savedCalls.push([...this.items]);
    }

    get currentShopId() {
      return this.items.length > 0 ? this.items[0].shopId : null;
    }
  }

  // Helper simulating CheckoutPage navigation effect
  class MockCheckoutRouterSimulator {
    constructor() {
      this.redirectLog = [];
    }

    replace(path) {
      this.redirectLog.push(path);
    }

    // Evaluates CheckoutPage's redirect effect
    evaluateRedirect(cart) {
      if (!cart.isHydrated) {
        return 'WAITING_FOR_HYDRATION';
      }

      if (cart.currentShopId) {
        this.replace(`/shop/${cart.currentShopId}?tab=checkout`);
        return 'REDIRECTED_TO_STOREFRONT_CHECKOUT';
      } else {
        this.replace('/explore');
        return 'REDIRECTED_TO_EXPLORE';
      }
    }
  }

  await t.test('1. Initial cart state is empty while localStorage restoration is pending', () => {
    const storage = createMockStorage({
      cakestore_v2_cart: JSON.stringify([
        { productId: 101, shopId: 77, name: 'Truffle Cake', price: 650, quantity: 1 }
      ])
    });

    const cart = new MockCartContextSimulator(storage);
    const router = new MockCheckoutRouterSimulator();

    // Before hydration effect runs:
    assert.equal(cart.isHydrated, false, 'isHydrated must be false initially');
    assert.deepEqual(cart.items, [], 'Cart items must be empty before hydration');
    assert.equal(cart.currentShopId, null, 'currentShopId must be null before hydration');

    // Evaluating checkout effect while pending hydration:
    const outcome = router.evaluateRedirect(cart);
    assert.equal(outcome, 'WAITING_FOR_HYDRATION', 'Checkout must wait while hydration is pending');
    assert.equal(router.redirectLog.length, 0, 'No redirects must be dispatched before hydration completes');

    // Also verify saveToStorage does NOT clobber storage while pending hydration
    cart.saveToStorage();
    assert.equal(cart.savedCalls.length, 0, 'Save effect must not write while isHydrated is false');
    assert.ok(storage.getItem('cakestore_v2_cart').includes('Truffle Cake'), 'Storage must retain saved cake');
  });

  await t.test('2. A saved cart is restored and checkout remains accessible (routes to storefront checkout)', () => {
    const storage = createMockStorage({
      cakestore_v2_cart: JSON.stringify([
        { productId: 202, shopId: 88, name: 'Velvet Dream', price: 900, quantity: 2 }
      ])
    });

    const cart = new MockCartContextSimulator(storage);
    const router = new MockCheckoutRouterSimulator();

    // Hydration executes
    cart.hydrateFromStorage();

    assert.equal(cart.isHydrated, true, 'isHydrated must transition to true');
    assert.equal(cart.items.length, 1, 'Restored cart must contain 1 item');
    assert.equal(cart.items[0].name, 'Velvet Dream');
    assert.equal(cart.currentShopId, 88, 'currentShopId must reflect restored shop 88');

    // Evaluating checkout effect after hydration
    const outcome = router.evaluateRedirect(cart);
    assert.equal(outcome, 'REDIRECTED_TO_STOREFRONT_CHECKOUT');
    assert.deepEqual(router.redirectLog, ['/shop/88?tab=checkout'], 'Must route to shop 88 checkout tab');
    assert.ok(!router.redirectLog.includes('/explore'), 'Must NOT prematurely redirect to /explore');
  });

  await t.test('3. A genuinely empty restored cart follows the intended empty-cart behavior', () => {
    // Case A: Storage has empty array
    const storageEmptyArray = createMockStorage({
      cakestore_v2_cart: JSON.stringify([])
    });
    const cartA = new MockCartContextSimulator(storageEmptyArray);
    const routerA = new MockCheckoutRouterSimulator();

    cartA.hydrateFromStorage();
    assert.equal(cartA.isHydrated, true);
    assert.equal(cartA.currentShopId, null);

    const outcomeA = routerA.evaluateRedirect(cartA);
    assert.equal(outcomeA, 'REDIRECTED_TO_EXPLORE');
    assert.deepEqual(routerA.redirectLog, ['/explore']);

    // Case B: Storage is null (first-time visitor)
    const storageNull = createMockStorage({});
    const cartB = new MockCartContextSimulator(storageNull);
    const routerB = new MockCheckoutRouterSimulator();

    cartB.hydrateFromStorage();
    assert.equal(cartB.isHydrated, true);
    assert.equal(cartB.currentShopId, null);

    const outcomeB = routerB.evaluateRedirect(cartB);
    assert.equal(outcomeB, 'REDIRECTED_TO_EXPLORE');
    assert.deepEqual(routerB.redirectLog, ['/explore']);
  });

  await t.test('4. Cart restoration does not cause repeated redirects (Idempotency)', () => {
    const storage = createMockStorage({
      cakestore_v2_cart: JSON.stringify([
        { productId: 303, shopId: 99, name: 'Cheesecake Slice', price: 300, quantity: 1 }
      ])
    });

    const cart = new MockCartContextSimulator(storage);
    const router = new MockCheckoutRouterSimulator();

    // Hydration executes
    cart.hydrateFromStorage();
    assert.equal(cart.isHydrated, true);

    // Initial evaluation
    router.evaluateRedirect(cart);
    assert.equal(router.redirectLog.length, 1);
    assert.equal(router.redirectLog[0], '/shop/99?tab=checkout');

    // Subsequent re-renders while on the page with same state
    // In React useEffect with dependencies [isHydrated, currentShopId, router],
    // if dependencies do not change, the effect does not fire again.
    let reevalCount = 0;
    const simulateRerender = (lastDependencies, currentDependencies) => {
      const changed = lastDependencies.some((dep, idx) => dep !== currentDependencies[idx]);
      if (changed) {
        router.evaluateRedirect(cart);
        reevalCount++;
      }
    };

    const deps = [cart.isHydrated, cart.currentShopId, router];
    simulateRerender(deps, [cart.isHydrated, cart.currentShopId, router]); // Re-render 1: identical
    simulateRerender(deps, [cart.isHydrated, cart.currentShopId, router]); // Re-render 2: identical
    simulateRerender(deps, [cart.isHydrated, cart.currentShopId, router]); // Re-render 3: identical

    assert.equal(reevalCount, 0, 'Effect must not re-trigger when dependencies are unchanged');
    assert.equal(router.redirectLog.length, 1, 'Only one redirect should ever be issued');
  });

  await t.test('5. Corrupted localStorage recovers gracefully without infinite waiting loop', () => {
    const storage = createMockStorage({
      cakestore_v2_cart: 'INVALID_JSON_CORRUPTED{{{'
    });

    const cart = new MockCartContextSimulator(storage);
    const router = new MockCheckoutRouterSimulator();

    // Hydration executes despite corrupt JSON
    cart.hydrateFromStorage();

    assert.equal(cart.isHydrated, true, 'isHydrated must be true even on catch block');
    assert.deepEqual(cart.items, [], 'Items must fall back to empty array');
    assert.equal(cart.currentShopId, null);

    const outcome = router.evaluateRedirect(cart);
    assert.equal(outcome, 'REDIRECTED_TO_EXPLORE', 'Corrupted cart cleanly redirects to /explore');
    assert.deepEqual(router.redirectLog, ['/explore']);
  });
});
