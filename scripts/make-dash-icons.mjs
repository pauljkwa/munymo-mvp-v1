#!/usr/bin/env node
/**
 * Generates the four owner-dashboard icons into client/public/dash/
 * (references/owner-dashboard-spec.md §8):
 *
 *   icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png (180)
 *
 * The art is the Mo avatar the game's own icons were cut from
 * (references/social/munymo-avatar-1080.png), with its dark-green background
 * recoloured to the dashboard navy (#0b1f3a) and a small white three-bar chart
 * glyph added bottom-right, so the two home-screen tiles read differently at a
 * glance.
 *
 * Tooling: `sharp` is not a dependency of this repo, so this uses what the
 * server already ships for share cards: @resvg/resvg-js to compose and resize,
 * plus a small PNG reader/writer on node:zlib to recolour the background (resvg
 * renders pixels but cannot hand them back). No new dependency.
 *
 * Run from the repo root:  node scripts/make-dash-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "references/social/munymo-avatar-1080.png");
const OUT_DIR = path.join(ROOT, "client/public/dash");

const NAVY = [0x0b, 0x1f, 0x3a];
const WHITE = [255, 255, 255];
const NAVY_HEX = "#0b1f3a";

// ─── Minimal PNG reader (8-bit RGB or RGBA, not interlaced) ──────────────────

function readPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("Not a PNG");
  let pos = 8;
  let width = 0, height = 0, channels = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8], colorType = data[9], interlace = data[12];
      if (depth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
        throw new Error(`Unsupported PNG (depth ${depth}, color type ${colorType}, interlace ${interlace})`);
      }
      channels = colorType === 2 ? 3 : 4;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 255;
    }
  }
  return { width, height, channels, px };
}

// ─── Minimal PNG writer (8-bit RGB) ──────────────────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function writePngRgb(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── Recolour: dark-green background -> navy, keeping anti-aliased edges ─────

/**
 * Each pixel is a blend of the background and (at most) one foreground colour
 * along the line from background to that colour. Find the foreground colour
 * and the blend amount that best explain the pixel, then re-blend the same
 * amount over navy. A pixel no such blend explains (white meeting green inside
 * the mark, no background involved) is left as it was.
 */
function recolor({ width, height, channels, px }) {
  const bg = [px[0], px[1], px[2]];
  // The mark's green: the most common colour that is neither background nor white.
  const counts = new Map();
  for (let i = 0; i < width * height; i++) {
    const r = px[i * channels], g = px[i * channels + 1], b = px[i * channels + 2];
    const dBg = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]);
    const dWhite = Math.abs(r - 255) + Math.abs(g - 255) + Math.abs(b - 255);
    if (dBg < 60 || dWhite < 60) continue;
    const key = (r << 16) | (g << 8) | b;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const green = [(top >> 16) & 255, (top >> 8) & 255, top & 255];

  const fgs = [WHITE, green].map((f) => {
    const u = f.map((v, k) => v - bg[k]);
    return { f, u, uu: u[0] * u[0] + u[1] * u[1] + u[2] * u[2] };
  });

  const out = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const p = [px[i * channels], px[i * channels + 1], px[i * channels + 2]];
    const v = p.map((x, k) => x - bg[k]);
    let best = null;
    for (const { f, u, uu } of fgs) {
      const t = Math.min(1, Math.max(0, (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / uu));
      const resid = Math.hypot(v[0] - t * u[0], v[1] - t * u[1], v[2] - t * u[2]);
      if (!best || resid < best.resid) best = { t, resid, f };
    }
    const rgb = best.resid <= 24 ? NAVY.map((n, k) => Math.round(n + best.t * (best.f[k] - n))) : p;
    out[i * 3] = rgb[0];
    out[i * 3 + 1] = rgb[1];
    out[i * 3 + 2] = rgb[2];
  }
  return { width, height, green, rgb: out };
}

// ─── Compose and render ──────────────────────────────────────────────────────

/** Three ascending white bars, lower-right quarter, in a 1000 x 1000 canvas. */
const BARS = [
  { x: 640, h: 70 },
  { x: 724, h: 115 },
  { x: 808, h: 165 },
].map(({ x, h }) => `<rect x="${x}" y="${880 - h}" width="56" height="${h}" rx="9" fill="#ffffff"/>`).join("");

function svgFor(imageB64, scale) {
  // Scaling about the centre keeps the whole composition (mark and glyph) inside
  // the maskable safe zone: the central circle of 80% of the width.
  const transform = scale === 1 ? "" : ` transform="translate(500 500) scale(${scale}) translate(-500 -500)"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1000 1000" width="1000" height="1000">` +
    `<rect width="1000" height="1000" fill="${NAVY_HEX}"/>` +
    `<g${transform}>` +
    `<image x="0" y="0" width="1000" height="1000" xlink:href="data:image/png;base64,${imageB64}"/>` +
    BARS +
    `</g></svg>`
  );
}

const TARGETS = [
  { file: "icon-192.png", size: 192, scale: 1 },
  { file: "icon-512.png", size: 512, scale: 1 },
  { file: "icon-maskable-512.png", size: 512, scale: 0.74 },
  { file: "apple-touch-icon.png", size: 180, scale: 1 },
];

const source = readPng(fs.readFileSync(SOURCE));
const recolored = recolor(source);
const imageB64 = writePngRgb(recolored.width, recolored.height, recolored.rgb).toString("base64");

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const { file, size, scale } of TARGETS) {
  const png = new Resvg(svgFor(imageB64, scale), { fitTo: { mode: "width", value: size } }).render().asPng();
  fs.writeFileSync(path.join(OUT_DIR, file), png);
  console.log(`wrote client/public/dash/${file} (${size}x${size}, ${png.length} bytes)`);
}
console.log(`green detected as rgb(${recolored.green.join(", ")})`);
