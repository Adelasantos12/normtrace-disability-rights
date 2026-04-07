import React from 'react';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-6 bg-white border border-neutral-200 rounded-lg shadow-sm ${className}`}>
      {children}
    </div>
  );
}
