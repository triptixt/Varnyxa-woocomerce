import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  ShoppingBag,
  Heart,
  User as UserIcon,
  Menu,
  X,
  ChevronDown,
  ShieldCheck,
  LogOut,
  Package,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { ThemeSwitcher } from './ThemeSwitcher';

export const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user, isAdmin, logout } = useAuth();
  const { cart, openCart } = useCart();
  const { wishlist } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    setIsSearchOpen(false);
  }, [location.pathname]);

  // Click outside listener for user menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
    }
  };

  const navLinks = [
    { name: 'All Editions', path: '/shop' },
    { name: 'Men', path: '/shop?gender=men' },
    { name: 'Women', path: '/shop?gender=women' },
    { name: 'Unisex', path: '/shop?gender=unisex' },
    { name: 'Boys', path: '/shop?gender=boys' },
    { name: 'Girls', path: '/shop?gender=girls' },
    { name: 'Baby', path: '/shop?gender=baby' },
    { name: 'Membership', path: '/membership' },
  ];

  return (
    <header
      className="sticky top-0 z-40 w-full transition-colors duration-300 backdrop-blur-md border-b shadow-2xs"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* Top Announcement Bar */}
      <div className="bg-[#121212] text-[#FAF9F6] text-[10px] sm:text-[11px] font-medium tracking-wider sm:tracking-widest py-1.5 sm:py-2 px-2 sm:px-4 text-center uppercase flex items-center justify-center gap-2 sm:gap-3">
        <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#C5A880] animate-pulse shrink-0" />
        <span className="truncate sm:overflow-visible">Complimentary Express Delivery over ₹1,499 | Code: <strong>WELCOME500</strong></span>
        <Sparkles className="w-3.5 h-3.5 text-[#C5A880] animate-pulse hidden sm:inline shrink-0" />
      </div>

      {/* Main Header Container */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Mobile menu trigger */}
          <div className="flex items-center lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1.5 transition rounded-lg hover:bg-black/5"
              style={{ color: 'var(--text-primary)' }}
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Logo Branding */}
          <div className="flex-1 lg:flex-none text-center lg:text-left px-1">
            <Link to="/" className="inline-block group">
              <span
                className="font-serif text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-[0.2em] sm:tracking-[0.22em] transition-colors"
                style={{ color: 'var(--text-primary)' }}
              >
                VARNYXA
              </span>
              <span
                className="block text-[7px] sm:text-[8px] tracking-[0.3em] sm:tracking-[0.35em] -mt-1 uppercase text-center font-sans font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                Haute Couture & Essentials
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-5 xl:space-x-7">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className="text-[12px] xl:text-[13px] font-medium tracking-wider transition relative py-1 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[1.5px] after:bg-[var(--accent-primary)] hover:after:w-full after:transition-all uppercase whitespace-nowrap"
                style={{ color: 'var(--text-primary)' }}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Action Icons */}
          <div className="flex items-center space-x-1 sm:space-x-2.5">
            {/* Multi-Color Theme Switcher */}
            <ThemeSwitcher />

            {/* Search Toggle */}
            <div className="relative">
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="p-2 transition rounded-full hover:bg-black/5"
                style={{ color: 'var(--text-primary)' }}
                aria-label="Search clothing"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Search popup bar - Mobile responsive */}
              {isSearchOpen && (
                <>
                  {/* Backdrop for mobile */}
                  <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 sm:hidden" onClick={() => setIsSearchOpen(false)} />
                  <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-16 sm:top-12 w-auto sm:w-96 bg-white border border-[#E8E6E1] rounded-2xl shadow-2xl p-3 z-50 animate-fade-in">
                    <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                      <Search className="w-4 h-4 text-[#8C887B] absolute left-3" />
                      <input
                        type="text"
                        placeholder="Search silk, coats, shirts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                        className="w-full pl-9 pr-20 py-2.5 text-xs sm:text-sm bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl focus:outline-none focus:border-[#121212]"
                      />
                      <div className="absolute right-1.5 flex items-center gap-1">
                        <button
                          type="submit"
                          className="px-3 py-1 bg-[#121212] text-white text-xs font-semibold rounded-lg hover:bg-black transition"
                        >
                          Find
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsSearchOpen(false)}
                          className="sm:hidden p-1 text-[#8C887B] hover:text-black"
                          aria-label="Close search"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              )}
            </div>

            {/* Wishlist Icon */}
            <Link
              to={user ? "/account?tab=wishlist" : "/login"}
              className="p-2 text-[#1A1A1A] hover:text-[#C5A880] transition relative rounded-full hover:bg-black/5"
              aria-label="Wishlist"
            >
              <Heart className="w-5 h-5" />
              {wishlist && wishlist.item_count > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#C5A880] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {wishlist.item_count}
                </span>
              )}
            </Link>

            {/* Shopping Cart Bag Button */}
            <button
              onClick={openCart}
              className="p-2 text-[#1A1A1A] hover:text-[#C5A880] transition relative rounded-full hover:bg-black/5"
              aria-label="Shopping Cart Bag"
            >
              <ShoppingBag className="w-5 h-5" />
              {cart && cart.item_count > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#121212] text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {cart.item_count}
                </span>
              )}
            </button>

            {/* Customer Account / Sign In Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-1.5 p-1.5 text-[#1A1A1A] hover:text-[#C5A880] transition rounded-full hover:bg-black/5"
                aria-label="User Account"
              >
                <div className="w-7 h-7 rounded-full bg-[#E8E6E1] flex items-center justify-center text-xs font-semibold text-[#121212]">
                  {user ? user.full_name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4 text-[#555]" />}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#888] hidden sm:block" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 top-12 w-64 bg-white border border-[#E8E6E1] rounded-2xl shadow-2xl py-2 z-50 animate-fade-in text-sm">
                  {user ? (
                    <>
                      <div className="px-4 py-3 border-b border-[#F0EFEA]">
                        <p className="font-semibold text-[#121212] truncate">{user.full_name}</p>
                        <p className="text-xs text-[#8C887B] truncate">{user.email}</p>
                        {isAdmin && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-[#121212] text-[#C5A880]">
                            <ShieldCheck className="w-3 h-3" /> Administrator
                          </span>
                        )}
                      </div>

                      <div className="py-1">
                        {isAdmin && (
                          <Link
                            to="/admin"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-[#121212] hover:bg-[#FAF9F6] font-medium"
                          >
                            <ShieldCheck className="w-4 h-4 text-[#C5A880]" />
                            Admin Console
                          </Link>
                        )}
                        <Link
                          to="/account?tab=orders"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-[#4A4A4A] hover:bg-[#FAF9F6]"
                        >
                          <Package className="w-4 h-4 text-[#8C887B]" />
                          My Orders & Tracking
                        </Link>
                        <Link
                          to="/account?tab=addresses"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-[#4A4A4A] hover:bg-[#FAF9F6]"
                        >
                          <MapPin className="w-4 h-4 text-[#8C887B]" />
                          Saved Addresses
                        </Link>
                        <Link
                          to="/account?tab=wishlist"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-[#4A4A4A] hover:bg-[#FAF9F6]"
                        >
                          <Heart className="w-4 h-4 text-[#8C887B]" />
                          Saved Wishlist
                        </Link>
                      </div>

                      <div className="border-t border-[#F0EFEA] pt-1">
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-[#D9534F] hover:bg-[#FFF5F5] text-left"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 space-y-3">
                      <p className="text-xs text-[#8C887B]">Sign in to access your bespoke orders, wishlist, and exclusive drops.</p>
                      <Link
                        to="/login"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="block w-full py-2.5 bg-[#121212] text-white text-center text-xs font-semibold uppercase tracking-wider rounded-xl hover:bg-black transition"
                      >
                        Sign In
                      </Link>
                      <Link
                        to="/register"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="block w-full py-2 border border-[#E8E6E1] text-[#121212] text-center text-xs font-semibold uppercase tracking-wider rounded-xl hover:bg-[#FAF9F6] transition"
                      >
                        Create Account
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden border-t px-4 pt-3 pb-8 pb-safe space-y-4 animate-fade-in max-h-[calc(100vh-4.5rem)] overflow-y-auto shadow-2xl transition-colors duration-300"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          {/* Mobile Color Theme Experience */}
          <div
            className="p-3 border rounded-xl flex items-center justify-between shadow-2xs"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                Theme Experience
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Curated aesthetic palettes
              </span>
            </div>
            <ThemeSwitcher />
          </div>

          <form onSubmit={handleSearchSubmit} className="relative flex items-center mb-1">
            <Search className="w-4 h-4 text-[#8C887B] absolute left-3" />
            <input
              type="text"
              placeholder="Search clothing..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-[#E8E6E1] rounded-xl focus:outline-none"
            />
          </form>

          {/* Account status for mobile */}
          <div className="p-3 bg-white border border-[#E8E6E1] rounded-xl">
            {user ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#121212]">{user.full_name}</span>
                  {isAdmin && (
                    <span className="text-[10px] bg-[#121212] text-[#C5A880] px-2 py-0.5 rounded font-bold uppercase">
                      Admin
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <Link
                    to="/account"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 bg-[#FAF9F6] text-center font-medium rounded-lg text-[#121212]"
                  >
                    My Profile
                  </Link>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      logout();
                    }}
                    className="p-2 bg-red-50 text-red-600 font-medium rounded-lg text-center"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 py-2 bg-[#121212] text-white text-center text-xs font-semibold rounded-lg uppercase tracking-wider"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 py-2 border border-[#E8E6E1] text-[#121212] text-center text-xs font-semibold rounded-lg uppercase tracking-wider hover:bg-[#FAF9F6]"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-semibold tracking-wider text-[#121212] hover:bg-[#E8E6E1] rounded-lg uppercase"
              >
                {link.name}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-bold tracking-wider text-[#C5A880] bg-[#121212] rounded-lg flex items-center gap-2 uppercase"
              >
                <ShieldCheck className="w-4 h-4" /> Admin Console
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
