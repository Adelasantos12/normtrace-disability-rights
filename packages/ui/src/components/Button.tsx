import React from 'react';

export function Button({
  children,
  onClick,
  disabled,
  className = '',
  type = 'button',
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary';
}) {
  const baseStyles = "font-medium rounded-md disabled:opacity-50 transition-colors shadow-sm";
  const primaryStyles = "bg-[#171717] text-white hover:bg-[#262626]";
  const secondaryStyles = "bg-white text-neutral-900 border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50";

  const appliedStyles = variant === 'secondary' ? secondaryStyles : primaryStyles;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 ${baseStyles} ${appliedStyles} ${className}`}
    >
      {children}
    </button>
  );
}
