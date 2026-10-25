// Génère les icônes de l'application à partir du logo officiel.
// Usage : node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SOURCE = "assets/logo-semeurs.jpeg";
const OUT = "public/icons";
const CLOUD = { r: 245, g: 248, b: 253, alpha: 1 };
const ROYAL = { r: 21, g: 70, b: 184, alpha: 1 };

await mkdir(OUT, { recursive: true });

// Le logo est un disque : on le découpe en rond sur fond transparent.
async function roundLogo(size) {
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`,
  );
  return sharp(SOURCE)
    .resize(size, size)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function iconOn(background, canvas, logoSize, file) {
  await sharp({ create: { width: canvas, height: canvas, channels: 4, background } })
    .composite([{ input: await roundLogo(logoSize), gravity: "center" }])
    // Palette réduite : icônes bien plus légères pour les connexions 3G.
    .png({ palette: true, quality: 85, compressionLevel: 9 })
    .toFile(`${OUT}/${file}`);
}

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
await iconOn(transparent, 192, 192, "icon-192.png");
await iconOn(transparent, 512, 512, "icon-512.png");
// « Maskable » : Android peut rogner jusqu'à 20 % du bord, on garde une marge.
await iconOn(ROYAL, 512, 400, "icon-maskable-512.png");
await iconOn(CLOUD, 180, 164, "apple-touch-icon.png");
await iconOn(transparent, 48, 48, "favicon-48.png");

// Logo pour l'écran de connexion (léger, format WebP).
await sharp(SOURCE).resize(320, 320).webp({ quality: 82 }).toFile("public/logo-semeurs.webp");

console.log("Icônes générées dans", OUT);
