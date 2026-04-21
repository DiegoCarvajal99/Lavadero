import React from 'react';

interface Props {
  className?: string;
  size?: number;
  color?: string;
}

export const CyberLoader: React.FC<Props> = ({ className = '', size = 24, color = '#00f7ff' }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* Outer Rotating Dashed Ring */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full animate-[spin_3s_linear_infinite]"
      >
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray="10 20"
          opacity="0.3"
        />
      </svg>

      {/* Inner Fast Rotating Ring */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full animate-[spin_1s_linear_infinite]"
      >
        <path
          d="M50 10 A40 40 0 0 1 90 50"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M50 90 A40 40 0 0 1 10 50"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>

      {/* Core Pulsing Dot */}
      <div 
        className="w-1/4 h-1/4 rounded-full animate-pulse shadow-[0_0_10px_rgba(0,247,255,0.8)]"
        style={{ backgroundColor: color }}
      />
    </div>
  );
};
