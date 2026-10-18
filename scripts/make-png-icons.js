import fs from 'fs';
import zlib from 'zlib';

// Helper to write a basic PNG file using pure Node.js
function createPng(width, height, getPixel) {
  // CRC table for chunk checksums
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);
    const crcBuf = Buffer.alloc(4 + len);
    crcBuf.write(type, 0);
    data.copy(crcBuf, 4);
    const checksum = crc32(crcBuf);
    buf.writeUInt32BE(checksum, 8 + len);
    return buf;
  }

  // PNG header
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth 8
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Scanlines: (1 filter byte + width * 4 bytes) per row
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const offset = y * rowBytes;
    rawData[offset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = offset + 1 + x * 4;
      const [r, g, b, a] = getPixel(x, y, width, height);
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// Drawing function for Report MD Purwokerto icon
function renderAppIcon(x, y, w, h, isMaskable) {
  const nx = x / w; // 0 to 1
  const ny = y / h; // 0 to 1

  // Base background: Royal blue gradient
  const rBg = Math.round(25 + nx * 5 - ny * 15);
  const gBg = Math.round(101 + nx * 10 - ny * 25);
  const bBg = Math.round(192 - ny * 30);

  // For non-maskable or apple-touch-icon, we can do rounded corners
  if (!isMaskable) {
    const cornerRadius = w * 0.22;
    const dx = Math.min(x, w - 1 - x);
    const dy = Math.min(y, h - 1 - y);
    if (dx < cornerRadius && dy < cornerRadius) {
      const dist = Math.hypot(cornerRadius - dx, cornerRadius - dy);
      if (dist > cornerRadius) {
        return [0, 0, 0, 0]; // Transparent outside rounded corner
      }
    }
  }

  // Safe inner coordinates (scaled inside safe zone for maskable)
  const scale = isMaskable ? 0.75 : 0.85;
  const cx = 0.5;
  const cy = 0.5;
  const px = (nx - cx) / scale + cx;
  const py = (ny - cy) / scale + cy;

  // Clipboard Card in center:
  // Card bounds: px in [0.26, 0.74], py in [0.24, 0.82]
  const inCard = px >= 0.26 && px <= 0.74 && py >= 0.24 && py <= 0.82;

  // Top clip:
  const inClip = px >= 0.38 && px <= 0.62 && py >= 0.18 && py <= 0.28;

  // Badge bottom-right:
  const bdx = px - 0.72;
  const bdy = py - 0.75;
  const inBadge = Math.hypot(bdx, bdy) <= 0.14;

  if (inBadge) {
    // Amber / Gold checkmark badge
    const badgeDist = Math.hypot(bdx, bdy);
    if (badgeDist > 0.13) {
      return [255, 255, 255, 255]; // White border
    }
    // Simple checkmark shape inside badge
    // line 1: (-0.05, 0) to (0, 0.05)
    // line 2: (0, 0.05) to (0.06, -0.05)
    const checkD1 = Math.abs((bdx + 0.02) - bdy);
    const checkD2 = Math.abs((bdx - 0.03) + bdy);
    if ((checkD1 < 0.02 && bdx >= -0.05 && bdx <= 0 && bdy >= -0.02 && bdy <= 0.05) ||
        (checkD2 < 0.02 && bdx >= 0 && bdx <= 0.06 && bdy >= -0.05 && bdy <= 0.05)) {
      return [255, 255, 255, 255]; // Checkmark white
    }
    return [255, 179, 0, 255]; // Amber
  }

  if (inClip) {
    return [255, 183, 77, 255]; // Clip gold
  }

  if (inCard) {
    // Card header bar
    if (py >= 0.32 && py <= 0.36 && px >= 0.33 && px <= 0.67) {
      return [21, 101, 192, 255]; // Navy header line
    }
    // Sub-line
    if (py >= 0.40 && py <= 0.43 && px >= 0.33 && px <= 0.58) {
      return [144, 202, 249, 255]; // Soft blue line
    }

    // Bar 1
    if (px >= 0.33 && px <= 0.38 && py >= 0.64 && py <= 0.75) return [66, 165, 245, 255];
    // Bar 2
    if (px >= 0.41 && px <= 0.46 && py >= 0.54 && py <= 0.75) return [30, 136, 229, 255];
    // Bar 3
    if (px >= 0.49 && px <= 0.54 && py >= 0.47 && py <= 0.75) return [21, 101, 192, 255];
    // Bar 4
    if (px >= 0.57 && px <= 0.62 && py >= 0.58 && py <= 0.75) return [3, 169, 244, 255];
    // Bar 5 (gold highest)
    if (px >= 0.65 && px <= 0.70 && py >= 0.44 && py <= 0.75) return [255, 167, 38, 255];

    return [255, 255, 255, 255]; // Clean white card body
  }

  // Subtle circular ambient highlight in background
  const distCenter = Math.hypot(nx - 0.5, ny - 0.5);
  if (distCenter < 0.45) {
    const glow = Math.round((0.45 - distCenter) * 40);
    return [
      Math.min(255, rBg + glow),
      Math.min(255, gBg + glow),
      Math.min(255, bBg + glow),
      255
    ];
  }

  return [rBg, gBg, bBg, 255];
}

// Generate PNGs
console.log('Generating PWA icons...');

const pwa192 = createPng(192, 192, (x, y, w, h) => renderAppIcon(x, y, w, h, false));
fs.writeFileSync('./public/pwa-192x192.png', pwa192);

const pwa512 = createPng(512, 512, (x, y, w, h) => renderAppIcon(x, y, w, h, false));
fs.writeFileSync('./public/pwa-512x512.png', pwa512);

const pwaMaskable512 = createPng(512, 512, (x, y, w, h) => renderAppIcon(x, y, w, h, true));
fs.writeFileSync('./public/pwa-maskable-512x512.png', pwaMaskable512);

const appleTouch = createPng(180, 180, (x, y, w, h) => renderAppIcon(x, y, w, h, false));
fs.writeFileSync('./public/apple-touch-icon.png', appleTouch);

const favicon = createPng(64, 64, (x, y, w, h) => renderAppIcon(x, y, w, h, false));
fs.writeFileSync('./public/favicon.png', favicon);

console.log('Successfully generated all PWA icons!');
