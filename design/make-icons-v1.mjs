import sharp from "sharp";
import fs from "node:fs";

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

// Palette = the app theme
const C = { bg: "#070711", violet: "#8e51ff", glow: "#b675ff", cyan: "#21d3ee", fg: "#f1f1fa", ink: "#0b0a1c" };

const FLOPPY =
  "M 232 276 Q 232 232 276 232 L 682 232 L 792 342 L 792 748 Q 792 792 748 792 L 276 792 Q 232 792 232 748 Z";

const defs = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.violet}"/><stop offset="0.5" stop-color="${C.glow}"/><stop offset="1" stop-color="${C.cyan}"/>
    </linearGradient>
    <radialGradient id="bg" cx="50%" cy="36%" r="80%">
      <stop offset="0" stop-color="#2b1560"/><stop offset="0.55" stop-color="#0e0c22"/><stop offset="1" stop-color="${C.bg}"/>
    </radialGradient>
    <filter id="blur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="40"/></filter>
  </defs>`;

/** The mark: a floppy disk (the universal "save") whose label shows a gamepad (d-pad + two buttons). */
const mark = (k = 1, glow = true) => `
  <g transform="translate(512 512) scale(${k}) translate(-512 -512)">
    ${glow ? `<path d="${FLOPPY}" fill="${C.violet}" opacity="0.55" filter="url(#blur)"/>` : ""}
    <path d="${FLOPPY}" fill="url(#g)"/>
    <rect x="332" y="232" width="300" height="168" rx="20" fill="${C.ink}"/>
    <rect x="552" y="262" width="56" height="108" rx="12" fill="url(#g)"/>
    <rect x="312" y="470" width="400" height="260" rx="26" fill="${C.ink}"/>
    <g fill="${C.fg}"><rect x="360" y="577" width="140" height="46" rx="12"/><rect x="407" y="530" width="46" height="140" rx="12"/></g>
    <circle cx="600" cy="570" r="27" fill="${C.cyan}"/><circle cx="652" cy="624" r="27" fill="${C.glow}"/>
  </g>`;

/** Single-colour version for Android "themed icons": holes are transparent, the system tints the white. */
const monoMark = (k = 1) => `
  <defs><mask id="holes"><rect width="1024" height="1024" fill="white"/>
    <rect x="332" y="232" width="300" height="168" rx="20" fill="black"/>
    <rect x="312" y="470" width="400" height="260" rx="26" fill="black"/></mask></defs>
  <g transform="translate(512 512) scale(${k}) translate(-512 -512)">
    <path d="${FLOPPY}" fill="white" mask="url(#holes)"/>
    <rect x="552" y="262" width="56" height="108" rx="12" fill="white"/>
    <g fill="white"><rect x="360" y="577" width="140" height="46" rx="12"/><rect x="407" y="530" width="46" height="140" rx="12"/>
    <circle cx="600" cy="570" r="27"/><circle cx="652" cy="624" r="27"/></g>
  </g>`;

const svg = (body, withBg) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}${withBg ? `<rect width="1024" height="1024" fill="url(#bg)"/>` : ""}${body}</svg>`);

const files = {
  "icon.png": { svg: svg(mark(1.2), true), opaque: true },
  "android-icon-foreground.png": { svg: svg(mark(0.84), false) }, // inside the 66% safe zone
  "android-icon-background.png": { svg: svg("", true), opaque: true },
  "android-icon-monochrome.png": { svg: svg(monoMark(0.84), false) },
  "splash-icon.png": { svg: svg(mark(1.3), false) },
};

for (const [name, f] of Object.entries(files)) {
  let img = sharp(f.svg, { density: 72 }).resize(1024, 1024);
  if (f.opaque) img = img.removeAlpha();
  await img.png().toFile(`${OUT}/${name}`);
}
await sharp(`${OUT}/icon.png`).resize(48, 48).png().toFile(`${OUT}/favicon.png`);
fs.writeFileSync(`${OUT}/logo.svg`, svg(mark(1.2), true));
console.log("gerado:", fs.readdirSync(OUT).join(", "));
