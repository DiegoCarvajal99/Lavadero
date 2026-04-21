import React from 'react';

export const MotorcycleIcon = ({ className = "w-4 h-4", size }: { className?: string, size?: number }) => (
  <svg 
    width={size || 24} 
    height={size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="5" cy="18" r="3" />
    <circle cx="19" cy="18" r="3" />
    <path d="M10 18v-4l2-7h3.5l1.5 3h2.5" />
    <path d="M12 14h5" />
    <path d="M4.5 15.5l3.5-3h4" />
  </svg>
);
