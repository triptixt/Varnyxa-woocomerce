import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Wishlist } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface WishlistContextType {
  wishlist: Wishlist | null;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<void>;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wishlist, setWishlist] = useState<Wishlist | null>(null);
  const { user } = useAuth();
  const { success, error, info } = useToast();

  const refreshWishlist = useCallback(async () => {
    if (!user) {
      setWishlist(null);
      return;
    }
    try {
      const data = await api.wishlist.getWishlist();
      setWishlist(data);
    } catch {
      // Wishlist fetch error silent
    }
  }, [user]);

  useEffect(() => {
    refreshWishlist();
  }, [user, refreshWishlist]);

  const isInWishlist = (productId: string) => {
    if (!wishlist || !wishlist.items) return false;
    return wishlist.items.some((item) => item.product_id === productId);
  };

  const toggleWishlist = async (productId: string) => {
    if (!user) {
      info('Please sign in to save items to your wishlist.');
      return;
    }
    try {
      const res = await api.wishlist.toggle(productId);
      await refreshWishlist();
      success(res.message);
    } catch (err: any) {
      error(err.message || 'Could not update wishlist.');
    }
  };

  return (
    <WishlistContext.Provider value={{ wishlist, isInWishlist, toggleWishlist, refreshWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
