import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { cartAPI } from '../api';

const CartContext = createContext(null);
const getHoldKey = (item) => `${item.menuItem?._id || ''}:${item.holdExpiresAt || ''}`;

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};

export function CartProvider({ children }) {
  const suppressExpiryToastRef = useRef(new Set());
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem('unifeast_cart');
      if (!saved) return [];
      const now = Date.now();
      return JSON.parse(saved).filter((item) => item.holdExpiresAt && item.holdExpiresAt > now);
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('unifeast_cart', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let expiredItems = [];
      setItems((prev) => {
        const expired = prev.filter((item) => item.holdExpiresAt && item.holdExpiresAt <= now);
        expiredItems = expired;
        return prev.filter((item) => item.holdExpiresAt && item.holdExpiresAt > now);
      });

      if (expiredItems.length) {
        const visibleExpired = expiredItems.filter((item) => !suppressExpiryToastRef.current.has(getHoldKey(item)));
        expiredItems.forEach((item) => {
          const holdKey = getHoldKey(item);
          if (suppressExpiryToastRef.current.has(holdKey)) {
            suppressExpiryToastRef.current.delete(holdKey);
            return;
          }
          cartAPI.releaseItem(item.menuItem._id).catch(() => {});
        });
        if (visibleExpired.length) {
          toast.error('Cart hold expired. Released reserved stock.');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const upsertLocalItem = useCallback((menuItem, quantity, holdExpiresAt) => {
    setItems(prev => {
      const existing = prev.find(i => i.menuItem._id === menuItem._id);
      if (existing) {
        return prev.map(i =>
          i.menuItem._id === menuItem._id
            ? { ...i, menuItem: { ...i.menuItem, ...menuItem }, quantity, holdExpiresAt }
            : i
        ).filter(i => i.quantity > 0);
      }
      return [...prev, { menuItem, quantity, holdExpiresAt }];
    });
  }, []);

  const reserveItem = useCallback(async (menuItem, quantity) => {
    if (quantity <= 0) {
      await cartAPI.releaseItem(menuItem._id);
      setItems(prev => prev.filter(i => i.menuItem._id !== menuItem._id));
      return null;
    }

    const { data } = await cartAPI.holdItem(menuItem._id, quantity);
    const reservation = data.data?.reservation;
    const holdMs = Number(data.data?.holdMs || 120000);
    const holdExpiresAt = reservation?.expiresAt
      ? new Date(reservation.expiresAt).getTime()
      : Date.now() + holdMs;
    const freshMenuItem = data.data?.menuItem || menuItem;
    upsertLocalItem(freshMenuItem, quantity, holdExpiresAt);
    return { menuItem: freshMenuItem, quantity, holdExpiresAt };
  }, [upsertLocalItem]);

  const addItem = async (menuItem, quantity = 1) => {
    const existing = items.find(i => i.menuItem._id === menuItem._id);
    const nextQuantity = Math.max(0, Number(existing?.quantity || 0) + Number(quantity || 0));
    return reserveItem(menuItem, nextQuantity);
  };

  const removeItem = async (menuItemId) => {
    const existing = items.find(i => i.menuItem._id === menuItemId);
    setItems(prev => prev.filter(i => i.menuItem._id !== menuItemId));
    if (existing) {
      await cartAPI.releaseItem(menuItemId).catch(() => {});
    }
  };

  const updateQuantity = async (menuItemId, quantity) => {
    const existing = items.find(i => i.menuItem._id === menuItemId);
    if (!existing) return null;
    if (quantity <= 0) {
      return removeItem(menuItemId);
    }
    return reserveItem(existing.menuItem, quantity);
  };

  const clearCart = async ({ releaseHolds = true } = {}) => {
    const currentItems = items;
    if (!releaseHolds) {
      currentItems.forEach((item) => suppressExpiryToastRef.current.add(getHoldKey(item)));
    }
    setItems([]);
    if (releaseHolds && currentItems.length) {
      await cartAPI.clearHolds().catch(() => {});
    }
  };

  const totalAmount = items.reduce(
    (sum, item) => sum + item.menuItem.price * item.quantity,
    0
  );

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalAmount, totalItems }}>
      {children}
    </CartContext.Provider>
  );
}
