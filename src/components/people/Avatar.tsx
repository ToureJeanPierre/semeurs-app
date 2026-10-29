import Image from "next/image";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Photo de profil ronde, ou les initiales quand il n'y a pas (encore) de photo. */
export function Avatar({ name, url, size = 44, className = "bg-royal/10 text-night" }: { name: string; url?: string | null; size?: number; className?: string }) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full font-display font-semibold ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {url ? <Image src={url} alt="" fill sizes={`${size}px`} unoptimized className="object-cover" /> : initials(name)}
    </span>
  );
}
