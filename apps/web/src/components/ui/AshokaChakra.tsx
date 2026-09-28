/** Ashoka Chakra (24 spokes), drawn in navy. Decorative only. */
export default function AshokaChakra({ className = '', spin = true }: { className?: string; spin?: boolean }) {
  const spokes = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <svg viewBox="-100 -100 200 200" className={`${spin ? 'animate-chakra' : ''} ${className}`} aria-hidden="true" focusable="false">
      <circle r="92" fill="none" stroke="#1E3A8A" strokeWidth="8" />
      <circle r="16" fill="#1E3A8A" />
      {spokes.map((deg) => (
        <g key={deg} transform={`rotate(${deg})`}>
          <path d="M0 -16 L4 -52 L0 -88 L-4 -52 Z" fill="#1E3A8A" />
          <circle cy="-88" r="3.2" fill="#1E3A8A" transform="rotate(7.5)" />
        </g>
      ))}
    </svg>
  );
}
