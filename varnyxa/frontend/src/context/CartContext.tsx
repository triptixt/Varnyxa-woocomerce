import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Cart } from '../types';
import { api } from '../services/api';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';

interface CartContextType {
  cart: Cart | null;
  loading: boolean;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (variantId: string, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const { success, error } = useToast();
  const { user } = useAuth();

  const refreshCart = useCallback(async (couponCode?: string) => {
    try {
      const currentCart = await api.cart.getCart(couponCode || cart?.coupon_code || undefined);
      setCart(currentCart);
    } catch {
      // Cart fetch fail graceful
    }
  }, [cart?.coupon_code]);

  useEffect(() => {
    refreshCart();
  }, [user, refreshCart]);

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  const addToCart = async (variantId: string, quantity = 1) => {
    setLoading(true);
    try {
      const updatedCart = await api.cart.addItem(variantId, quantity);
      setCart(updatedCart);
      success('Added garment to shopping bag.');
      setIsCartOpen(true);
    } catch (err: any) {
      error(err.message || 'Could not add to bag.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    setLoading(true);
    try {
      const updatedCart = await api.cart.updateItem(itemId, quantity);
      setCart(updatedCart);
    } catch (err: any) {
      error(err.message || 'Could not update quantity.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (itemId: string) => {
    setLoading(true);
    try {
      const updatedCart = await api.cart.removeItem(itemId);
      setCart(updatedCart);
      success('Item removed from shopping bag.');
    } catch (err: any) {
      error(err.message || 'Could not remove item.');
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async () => {
    setLoading(true);
    try {
      const clearedCart = await api.cart.clearCart();
      setCart(clearedCart);
    } catch (err: any) {
      error(err.message || 'Could not clear shopping bag.');
    } finally {
      setLoading(false);
    }
  };

  const applyCoupon = async (code: string) => {
    if (!cart || cart.subtotal <= 0) {
      error('Shopping bag is empty.');
      return;
    }
    setLoading(true);
    try {
      const validation = await api.coupons.validate(code, cart.subtotal);
      if (validation.valid) {
        await refreshCart(validation.code);
        success(validation.message);
      }
    } catch (err: any) {
      error(err.message || 'Invalid or expired coupon.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        isCartOpen,
        openCart,
        closeCart,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        applyCoupon,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
