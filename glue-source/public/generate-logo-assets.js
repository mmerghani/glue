import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(currentDir, 'glue logo white.png');
const outputs = [
  ['logo-32.png', 32],
  ['logo-64.png', 64],
  ['logo-128.png', 128],
  ['logo-256.png', 256],
  ['logo-512.png', 512],
  ['favicon.png', 32],
  ['icons/icon-72x72.png', 72],
  ['icons/icon-96x96.png', 96],
  ['icons/icon-128x128.png', 128],
  ['icons/icon-144x144.png', 144],
  ['icons/icon-152x152.png', 152],
  ['icons/icon-192x192.png', 192],
  ['icons/icon-384x384.png', 384],
  ['icons/icon-512x512.png', 512],
];

async function writeAsset(relativeOutputPath, size) {
  const outputPath = path.join(currentDir, relativeOutputPath);
  const outputDir = path.dirname(outputPath);

  await fs.mkdir(outputDir, { recursive: true });
  await sharp(source)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toFile(outputPath);
}

await Promise.all(outputs.map(([relativeOutputPath, size]) => writeAsset(relativeOutputPath, size)));

console.log(`Generated ${outputs.length} logo assets from ${path.basename(source)}`);
