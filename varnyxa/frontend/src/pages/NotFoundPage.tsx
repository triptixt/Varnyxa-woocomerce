import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-20 space-y-5">
      <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#C5A880]">Error 404</span>
      <h1 className="font-serif text-4xl sm:text-5xl font-extrabold text-[#121212]">
        Editorial Silhouette Not Found
      </h1>
      <p className="text-xs sm:text-sm text-[#8C887B] max-w-sm mx-auto">
        The garment or page you are seeking may have moved to an archival collection or never existed.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#121212] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-black transition shadow-lg"
      >
        <ArrowLeft className="w-4 h-4" /> Return to VARNYXA Home
      </Link>
    </div>
  );
};
