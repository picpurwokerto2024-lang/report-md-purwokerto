import fs from 'fs';
import { Resvg } from '@resvg/resvg-js';

// SVG Definition: Standard Corporate App Icon (Rounded Squircle for Standalone & Web)
function generateCorporateSvg(isMaskable = false) {
  // If maskable, safe zone requires emblem to be within 80% circle (scale 0.76)
  // Background must bleed fully to edge (no rounded corner clipping)
  const bgRx = isMaskable ? 0 : 112;
  const transform = isMaskable
    ? 'transform="translate(61, 56) scale(0.76)"'
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Corporate Luxury Navy Gradient -->
    <linearGradient id="corpBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#07172E" />
      <stop offset="45%" stop-color="#0D2E63" />
      <stop offset="85%" stop-color="#124894" />
      <stop offset="100%" stop-color="#175BB5" />
    </linearGradient>

    <!-- Inner Radial Glow -->
    <radialGradient id="centerGlow" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#00D2FF" stop-opacity="0.22" />
      <stop offset="50%" stop-color="#1E88E5" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#0D2E63" stop-opacity="0" />
    </radialGradient>

    <!-- Shield Face Gradients (3D Bevel) -->
    <linearGradient id="shieldLeft" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1B4D94" />
      <stop offset="100%" stop-color="#0A2552" />
    </linearGradient>

    <linearGradient id="shieldRight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#256FD6" />
      <stop offset="100%" stop-color="#113A78" />
    </linearGradient>

    <!-- Cyan Pulse Accent -->
    <linearGradient id="cyanAccent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00F5FF" />
      <stop offset="100%" stop-color="#0088FF" />
    </linearGradient>

    <!-- Gold / Amber Executive Accent -->
    <linearGradient id="goldAccent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFE082" />
      <stop offset="50%" stop-color="#FFB300" />
      <stop offset="100%" stop-color="#FF8F00" />
    </linearGradient>

    <!-- Monogram Metallic White -->
    <linearGradient id="monoGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="60%" stop-color="#F0F8FF" />
      <stop offset="100%" stop-color="#D0E3FF" />
    </linearGradient>

    <!-- Card Rim Highlight -->
    <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.35" />
      <stop offset="50%" stop-color="#00D2FF" stop-opacity="0.20" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.05" />
    </linearGradient>

    <!-- Drop Shadows -->
    <filter id="shieldShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#020B17" flood-opacity="0.65" />
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#0044AA" flood-opacity="0.30" />
    </filter>

    <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#031124" flood-opacity="0.60" />
    </filter>

    <filter id="glowCyan" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- 1. Background Surface -->
  <rect width="512" height="512" rx="${bgRx}" fill="url(#corpBg)" />

  <!-- 2. Subtle Geometric Grid & Ambient Glow -->
  <rect width="512" height="512" rx="${bgRx}" fill="url(#centerGlow)" />
  
  <!-- Subtle Elegant Corner Accent Arc -->
  <circle cx="256" cy="-80" r="320" fill="none" stroke="url(#rimGrad)" stroke-width="1.5" stroke-opacity="0.4" />
  <circle cx="256" cy="592" r="320" fill="none" stroke="url(#rimGrad)" stroke-width="1.5" stroke-opacity="0.2" />

  <!-- 3. Main Emblem Container -->
  <g ${transform} filter="url(#shieldShadow)">
    <!-- Outer Shield Halo Ring -->
    <path d="M 256,70 L 396,145 L 396,310 C 396,375 336,425 256,448 C 176,425 116,375 116,310 L 116,145 Z"
          fill="none" stroke="url(#cyanAccent)" stroke-width="2.5" stroke-opacity="0.35" />

    <!-- Left Shield Facet (Darker Dimension) -->
    <path d="M 256,74 L 120,147 L 120,308 C 120,370 178,418 256,442 Z"
          fill="url(#shieldLeft)" />

    <!-- Right Shield Facet (Lit Dimension) -->
    <path d="M 256,74 L 392,147 L 392,308 C 392,370 334,418 256,442 Z"
          fill="url(#shieldRight)" />

    <!-- Center Facet Spine Highlight -->
    <line x1="256" y1="74" x2="256" y2="442" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="2" />

    <!-- Shield Border Trim -->
    <path d="M 256,74 L 392,147 L 392,308 C 392,370 334,418 256,442 C 178,418 120,370 120,308 L 120,147 Z"
          fill="none" stroke="url(#rimGrad)" stroke-width="3" />

    <!-- Inner Data Analytics Chart / Upward Growth Matrix -->
    <g opacity="0.35">
      <!-- Grid Lines -->
      <line x1="160" y1="210" x2="352" y2="210" stroke="#00D2FF" stroke-width="1" stroke-dasharray="3 3" />
      <line x1="160" y1="250" x2="352" y2="250" stroke="#00D2FF" stroke-width="1" stroke-dasharray="3 3" />
      <line x1="160" y1="290" x2="352" y2="290" stroke="#00D2FF" stroke-width="1" stroke-dasharray="3 3" />
    </g>

    <!-- Upward Trend Gradient Wave behind Letters -->
    <path d="M 160,285 Q 215,270 256,230 T 352,175"
          fill="none" stroke="url(#cyanAccent)" stroke-width="4" stroke-linecap="round" opacity="0.8" />
    
    <!-- Pulse Dots on Trend -->
    <circle cx="256" cy="230" r="4" fill="#00F5FF" />
    <circle cx="352" cy="175" r="5" fill="#FFE082" filter="url(#glowCyan)" />

    <!-- ============================================== -->
    <!-- MONOGRAM "MD" (Sharp, Corporate, Precision-Cut) -->
    <!-- ============================================== -->
    <g filter="url(#textShadow)">
      <!-- Letter 'M' -->
      <!-- Left leg -->
      <path d="M 162,170 L 186,170 L 186,295 L 162,295 Z" fill="url(#monoGrad)" />
      <!-- Center V strokes -->
      <path d="M 186,170 L 216,252 L 234,252 L 210,170 Z" fill="url(#monoGrad)" />
      <path d="M 234,170 L 208,252 L 222,252 L 254,170 Z" fill="#E1EFFF" />
      <!-- Right leg of M -->
      <path d="M 234,170 L 256,170 L 256,295 L 234,295 Z" fill="url(#monoGrad)" />

      <!-- Letter 'D' (Interlocked Corporate Style) -->
      <!-- Vertical stem of D -->
      <path d="M 276,170 L 300,170 L 300,295 L 276,295 Z" fill="url(#monoGrad)" />
      <!-- D Outer Bowl with dynamic cut -->
      <path d="M 296,170 L 328,170 C 356,170 372,188 372,232.5 C 372,277 356,295 328,295 L 296,295 L 296,272 L 324,272 C 339,272 347,260 347,232.5 C 347,205 339,193 324,193 L 296,193 Z"
            fill="url(#monoGrad)" />
      <!-- Accent Slash inside D (Dynamic Gold Chevron) -->
      <path d="M 314,212 L 334,232.5 L 314,253"
            fill="none" stroke="url(#goldAccent)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    </g>

    <!-- Micro-label Pill: "REPORT PORTAL" / "PURWOKERTO" -->
    <g transform="translate(166, 335)">
      <!-- Pill Container -->
      <rect x="0" y="0" width="180" height="34" rx="17" fill="#061A38" stroke="url(#cyanAccent)" stroke-width="1.8" />
      <!-- Gold star indicator -->
      <circle cx="20" cy="17" r="4.5" fill="url(#goldAccent)" />
      <!-- Text label -->
      <text x="32" y="22" font-family="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-size="12.5" font-weight="900" letter-spacing="2.2" fill="#FFFFFF">
        PURWOKERTO
      </text>
    </g>

    <!-- Subtitle: KAO PEDULI INOVASI -->
    <text x="256" y="394" text-anchor="middle"
          font-family="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          font-size="9" font-weight="700" letter-spacing="2" fill="#90CAF9" opacity="0.9">
      PORTAL REPORT MD
    </text>

    <!-- Executive Gold Crest Star at Top of Shield -->
    <g transform="translate(256, 74)">
      <circle cx="0" cy="0" r="14" fill="#0D2E63" stroke="url(#goldAccent)" stroke-width="2" />
      <!-- Star polygon -->
      <polygon points="0,-8 2.5,-2.5 8,-2.5 3.5,1.5 5.5,7 0,3.5 -5.5,7 -3.5,1.5 -8,-2.5 -2.5,-2.5"
               fill="url(#goldAccent)" />
    </g>
  </g>

  <!-- 4. Top Glass Sheen (Subtle diagonal executive gloss) -->
  <path d="M 0,0 L 512,0 C 512,0 350,180 0,240 Z"
        fill="url(#rimGrad)" opacity="0.08" rx="${bgRx}" />
</svg>`;
}

// Generate files
console.log('Building Modern Corporate App Icons...');

const standardSvg = generateCorporateSvg(false);
const maskableSvg = generateCorporateSvg(true);

fs.writeFileSync('./public/icon.svg', standardSvg);
console.log('Wrote ./public/icon.svg');

// Render PNGs with @resvg/resvg-js
function renderToPng(svgString, size, outputPath) {
  const resvg = new Resvg(svgString, {
    fitTo: {
      mode: 'width',
      value: size,
    },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  fs.writeFileSync(outputPath, pngBuffer);
  console.log(`Rendered ${outputPath} (${size}x${size}, ${pngBuffer.length} bytes)`);
}

renderToPng(standardSvg, 512, './public/pwa-512x512.png');
renderToPng(maskableSvg, 512, './public/pwa-maskable-512x512.png');
renderToPng(standardSvg, 192, './public/pwa-192x192.png');
renderToPng(standardSvg, 180, './public/apple-touch-icon.png');
renderToPng(standardSvg, 64, './public/favicon.png');

console.log('All Modern Professional Corporate Icons Generated Successfully!');
