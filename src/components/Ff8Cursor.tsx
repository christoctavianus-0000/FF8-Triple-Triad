import React from 'react';

interface Ff8CursorProps {
  className?: string;
  size?: number;
}

export const Ff8Cursor: React.FC<Ff8CursorProps> = ({ className = '', size = 14 }) => (
  <svg
    className={`ff8-cursor ${className}`}
    width={size}
    height={size}
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
    <path
      d="M3 2.5 L13.5 8 L3 13.5 L5.4 8 Z"
      fill="#C89D54"
      stroke="#14243B"
      strokeWidth="1.1"
      strokeLinejoin="round"
    />
  </svg>
);
