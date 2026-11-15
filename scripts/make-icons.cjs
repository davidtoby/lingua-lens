const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A84FF"/>
      <stop offset="100%" stop-color="#5B5BD6"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="128" height="128" rx="30" fill="url(#g)"/>
  <rect x="24" y="70" width="80" height="11" rx="5.5" fill="#FFFFFF" opacity="0.95"/>
  <rect x="36" y="89" width="56" height="8" rx="4" fill="#FFFFFF" opacity="0.6"/>
  <path d="M32 44 h40 M52 32 v14 c0 14 -8 22 -18 26" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" fill="none"/>
  <path d="M44 46 c6 12 16 18 28 20" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" fill="none"/>
</svg>`;

(async () => {
  const outDir = path.resolve(__dirname, '../public/extension/icons');
  fs.mkdirSync(outDir, { recursive: true });
  for (const size of [16, 48, 128]) {
    await sharp(Buffer.from(svg(size)))
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, `icon${size}.png`));
  }
  await sharp(Buffer.from(svg(512))).resize(512, 512).png().toFile(path.resolve(__dirname, '../public/extension-icon.png'));
  console.log('icons generated');
})();
