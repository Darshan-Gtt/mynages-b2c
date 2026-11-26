import { useId } from 'react';

export function MynagesMark({ size = 28, light = false }: { size?: number; light?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2DD4BF" /><stop offset="1" stopColor="#0E9384" /></linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5EEAD4" /><stop offset="1" stopColor="#14B8A6" /></linearGradient>
      </defs>
      <path d="M11 20 L24 33 L37 20" fill="none" stroke={`url(#${id}b)`} strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="5" y="15" width="10" height="28" rx="5" fill={`url(#${id}a)`} />
      <rect x="33" y="15" width="10" height="28" rx="5" fill={light ? '#FFFFFF' : '#0F2D3D'} />
      <circle cx="24" cy="9" r="5" fill="#F4C76B" />
    </svg>
  );
}
