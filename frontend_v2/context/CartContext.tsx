'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CartItem {
  cartLineId?: string;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  isEggless: boolean;
  customMessage?: string;
  shopId: number;
  shopName: string;
  variantId?: number;
  variantName?: string;
  weight?: string | number;
  dietaryPreference?: string;
  addonIds?: number[];
  deliveryDate?: string;
  deliverySlotId?: number;
  deliverySlotName?: string;
  deliveryTime?: string;
  deliveryTimeType?: 'SLOT' | 'CUSTOM';
}

export interface AppliedCouponInfo {
  code: string;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  discountAmount: number;
}

export const generateCartLineId = (item: CartItem): string => {
  const dietary = item.dietaryPreference || (item.isEggless ? 'EGGLESS' : 'REGULAR');
  const customMsg = item.customMessage?.trim().toLowerCase() || '';
  const addons = Array.isArray(item.addonIds) && item.addonIds.length > 0 
    ? Array.from(new Set(item.addonIds)).sort((a, b) => a - b).join(',') 
    : '';
  const date = item.deliveryDate ? `-${item.deliveryDate}` : '';
  const slot = item.deliverySlotId ? `-slot-${item.deliverySlotId}` : '';
  const time = item.deliveryTime ? `-time-${item.deliveryTime.replace(/[\s:]/g, '')}` : '';
  return `${item.productId}-${item.variantId || 0}-${dietary}-${customMsg}-${addons}${date}${slot}${time}`;
};

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => { success: boolean; conflict?: boolean };
  removeItem: (cartLineId: string) => void;
  updateQuantity: (cartLineId: string, quantity: number) => void;
  clearCart: () => void;
  totalPrice: number;
  totalItems: number;
  currentShopId: number | null;
  currentShopName: string | null;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  appliedCoupon: AppliedCouponInfo | null;
  setAppliedCoupon: (coupon: AppliedCouponInfo | null) => void;
  isHydrated: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCouponInfo | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cakestore_v2_cart');
      if (stored) {
        const parsedItems: CartItem[] = JSON.parse(stored);
        // Ensure all loaded items have a cartLineId
        const hydratedItems = parsedItems.map(item => ({
          ...item,
          cartLineId: item.cartLineId || generateCartLineId(item),
        }));
        setItems(hydratedItems);
      }
    } catch (e) {
      console.error('Failed to load cart from storage', e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Save to localStorage only after initial hydration completes
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem('cakestore_v2_cart', JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save cart to storage', e);
    }
  }, [items, isHydrated]);

  const currentShopId = items.length > 0 ? items[0].shopId : null;
  const currentShopName = items.length > 0 ? items[0].shopName : null;

  const addItem = (newItem: CartItem): { success: boolean; conflict?: boolean } => {
    // If cart contains items from a different shop, flag conflict
    if (items.length > 0 && items[0].shopId !== newItem.shopId) {
      return { success: false, conflict: true };
    }

    const newLineId = generateCartLineId(newItem);
    const itemWithId = { ...newItem, cartLineId: newLineId };

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.cartLineId === newLineId);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += newItem.quantity;
        return updated;
      }
      return [...prev, itemWithId];
    });

    return { success: true };
  };

  const removeItem = (cartLineId: string) => {
    setItems((prev) => prev.filter((i) => i.cartLineId !== cartLineId));
  };

  const updateQuantity = (cartLineId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cartLineId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.cartLineId === cartLineId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
  };

  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalPrice,
        totalItems,
        currentShopId,
        currentShopName,
        isCartOpen,
        setIsCartOpen,
        appliedCoupon,
        setAppliedCoupon,
        isHydrated,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
