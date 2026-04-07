import React from 'react';

export function Button({
  children,
  onClick,
  disabled,
  className = '',
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 font-medium bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:opacity-50 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
