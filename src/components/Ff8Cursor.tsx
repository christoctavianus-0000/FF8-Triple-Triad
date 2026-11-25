import React from 'react';

interface Ff8CursorProps {
  className?: string;
  size?: number;
}

export const Ff8Cursor: React.FC<Ff8CursorProps> = ({ className = '', size = 22 }) => (
  <svg
    className={`ff8-cursor ${className}`}
    width={size}
    height={Math.round(size * 0.72)}
    viewBox="0 0 36 26"
    aria-hidden="true"
  >
    <path
      d="M2 10 L18 10 L18 4 L25 4 L25 9 L33 9 C34.6 9 35 12.6 33 12.6 L25 12.6 L25 16 L29 16 C30.5 16 30.5 19 29 19 L23 19 L23 22 L11 22 L7 17 L2 17 Z"
      fill="#f8fbff"
      stroke="#111622"
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
    <line x1="15" y1="13" x2="24" y2="13" stroke="#64748b" strokeWidth="1.4" />
    <line x1="15" y1="16.5" x2="22" y2="16.5" stroke="#64748b" strokeWidth="1.4" />
  </svg>
);
