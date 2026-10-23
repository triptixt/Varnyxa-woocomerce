import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/common/Navbar';
import { Footer } from '../components/common/Footer';
import { CartDrawer } from '../components/cart/CartDrawer';

export const MainLayout: React.FC = () => {
  return (
    <div
      className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden transition-colors duration-300"
      style={{
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      <Navbar />
      <CartDrawer />
      <main className="flex-1 w-full max-w-full">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
