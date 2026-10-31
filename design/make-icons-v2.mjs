import sharp from "sharp";
import fs from "node:fs";

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

// Palette = the app theme
const C = { bg: "#070711", violet: "#8e51ff", glow: "#b675ff", cyan: "#21d3ee", fg: "#f1f1fa", ink: "#0b0a1c" };

// Controller body, symmetric around x = 512 (grips curve down on both sides).
const BODY =
  "M 512 330 L 720 330 Q 790 330 815 385 L 905 600 Q 925 690 860 725 Q 800 750 765 690 L 735 640 Q 722 610 680 610 " +
  "L 344 610 Q 302 610 289 640 L 259 690 Q 224 750 164 725 Q 99 690 119 600 L 209 385 Q 234 330 304 330 Z";

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

const bumpers = (fill) =>
  `<rect x="318" y="296" width="150" height="40" rx="20" fill="${fill}"/><rect x="556" y="296" width="150" height="40" rx="20" fill="${fill}"/>`;

const dpad = (fill) =>
  `<g fill="${fill}"><rect x="295" y="410" width="120" height="40" rx="12"/><rect x="335" y="370" width="40" height="120" rx="12"/></g>`;
const buttons = (fill) =>
  `<g fill="${fill}"><circle cx="669" cy="386" r="25"/><circle cx="669" cy="474" r="25"/><circle cx="625" cy="430" r="25"/><circle cx="713" cy="430" r="25"/></g>`;
const sticks = (ring, cap) =>
  `<g><circle cx="430" cy="548" r="40" fill="${ring}"/><circle cx="594" cy="548" r="40" fill="${ring}"/>${cap ? `<circle cx="430" cy="548" r="20" fill="${cap}"/><circle cx="594" cy="548" r="20" fill="${cap}"/>` : ""}</g>`;

const place = (k, inner) =>
  `<g transform="translate(512 512) scale(${k}) translate(-512 -525)">${inner}</g>`;

/** The mark: a gamepad. Gradient body, dark recesses for the buttons, one cyan accent in the middle. */
const mark = (k = 1, glow = true) =>
  place(
    k,
    `${glow ? `<path d="${BODY}" fill="${C.violet}" opacity="0.55" filter="url(#blur)"/>` : ""}
     ${bumpers("url(#g)")}
     <path d="${BODY}" fill="url(#g)"/>
     ${dpad(C.ink)}${buttons(C.ink)}${sticks(C.ink, "url(#g)")}
     <circle cx="512" cy="430" r="17" fill="${C.cyan}"/>`,
  );

/** Single-colour version for Android "themed icons": holes are transparent, the system tints the white. */
const monoMark = (k = 1) =>
  place(
    k,
    `<defs><mask id="holes"><rect width="1024" height="1024" fill="white"/>
       ${dpad("black")}${buttons("black")}${sticks("black", "")}<circle cx="512" cy="430" r="17" fill="black"/></mask></defs>
     ${bumpers("white")}
     <path d="${BODY}" fill="white" mask="url(#holes)"/>`,
  );

const svg = (body, withBg) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}${withBg ? `<rect width="1024" height="1024" fill="url(#bg)"/>` : ""}${body}</svg>`);

const files = {
  "icon.png": { svg: svg(mark(1.06), true), opaque: true },
  "android-icon-foreground.png": { svg: svg(mark(0.7), false) }, // inside the 66% safe zone
  "android-icon-background.png": { svg: svg("", true), opaque: true },
  "android-icon-monochrome.png": { svg: svg(monoMark(0.7), false) },
  "splash-icon.png": { svg: svg(mark(1.1), false) },
};

for (const [name, f] of Object.entries(files)) {
  let img = sharp(f.svg, { density: 72 }).resize(1024, 1024);
  if (f.opaque) img = img.removeAlpha();
  await img.png().toFile(`${OUT}/${name}`);
}
await sharp(`${OUT}/icon.png`).resize(48, 48).png().toFile(`${OUT}/favicon.png`);
fs.writeFileSync(`${OUT}/logo.svg`, svg(mark(1.06), true));
console.log("gerado:", fs.readdirSync(OUT).join(", "));
