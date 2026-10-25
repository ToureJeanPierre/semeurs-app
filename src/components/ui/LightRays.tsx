/**
 * Motif signature : éventail de rayons de lumière partant du haut,
 * en écho au logo (docs/03-design.md §1.4). Purement décoratif.
 */
export function LightRays({ className = "" }: { className?: string }) {
  const rays = Array.from({ length: 11 }, (_, i) => -50 + i * 10);
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 260"
      preserveAspectRatio="xMidYMin slice"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    >
      <defs>
        <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform="translate(200 -20)">
        {rays.map((angle) => (
          <polygon
            key={angle}
            points="-7,0 7,0 34,300 -34,300"
            fill="url(#ray)"
            transform={`rotate(${angle})`}
          />
        ))}
      </g>
    </svg>
  );
}
