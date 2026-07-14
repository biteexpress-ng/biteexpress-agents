/**
 * Client-side canvas renderers for the two marketing artifacts. Everything is
 * drawn in the browser from the agent's own referral code and first name. No
 * network calls (the QR is generated offline by the `qrcode` package), no
 * numbers or claims on the artifacts except the code itself.
 *
 *  - Poster: A5 portrait at 300dpi (1748x2480). Light paper, black ink, code in
 *    huge type, generous QR quiet zone. Designed to still read when photocopied
 *    in black and white at a business centre.
 *  - Status image: 1080x1920 for WhatsApp status. Dark brand surface (the
 *    ReferralCodeCard identity), code as the hero, QR on a white tile so it
 *    scans against the dark background.
 *
 * The QR encodes https://bite.express/?ref={CODE}. The `ref` param is inert on
 * the marketing site today (capture is backlog); the printed code is the
 * mechanism, so the code is always also shown in large type.
 */

import QRCode from "qrcode";
import { SITE_URL } from "@/lib/marketing/templates";

export const POSTER_SIZE = { width: 1748, height: 2480 } as const;
export const STATUS_SIZE = { width: 1080, height: 1920 } as const;

/** Logo wordmark intrinsic aspect (width / height), matching Logo component. */
const LOGO_RATIO = 6273 / 2276;

const LOGO_LIGHT_BG = "/brand/biteexpress_logo_light_bg.png"; // dark wordmark, for light surfaces
const LOGO_DARK_BG = "/brand/biteexpress_logo_dark_bg.png"; // light wordmark, for dark surfaces

function qrTarget(code: string): string {
  return `${SITE_URL}/?ref=${encodeURIComponent(code)}`;
}

/* ── shared helpers ──────────────────────────────────────────────────────── */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/** Resolve a CSS font stack (with var() references) to the concrete family
 *  string the browser will use, so canvas draws with the app's real fonts. */
function resolveFamily(cssFontFamily: string): string {
  const el = document.createElement("span");
  el.style.fontFamily = cssFontFamily;
  el.style.position = "absolute";
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  document.body.appendChild(el);
  const resolved = getComputedStyle(el).fontFamily;
  el.remove();
  return resolved || cssFontFamily;
}

interface Fonts {
  sans: string;
  serif: string;
  mono: string;
}

async function ensureFonts(): Promise<Fonts> {
  const sans = resolveFamily("var(--font-sans)");
  const serif = resolveFamily("var(--font-serif)");
  // Mono is a system stack (no web font to load); a robust cross-device list.
  const mono =
    'ui-monospace, "SF Mono", "Roboto Mono", "JetBrains Mono", Menlo, Consolas, monospace';

  try {
    await Promise.all([
      document.fonts.load(`700 120px ${sans}`),
      document.fonts.load(`600 120px ${sans}`),
      document.fonts.load(`500 120px ${sans}`),
      document.fonts.load(`400 120px ${sans}`),
      document.fonts.load(`400 120px ${serif}`),
    ]);
    await document.fonts.ready;
  } catch {
    // If font loading hiccups, drawing still proceeds with whatever is ready;
    // the fallback stacks keep the artifact legible.
  }

  return { sans, serif, mono };
}

/** Render the QR to its own crisp canvas (pixel art, no smoothing). */
async function renderQrCanvas(
  code: string,
  sizePx: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, qrTarget(code), {
    errorCorrectionLevel: "M",
    margin: 4, // quiet zone, in modules
    width: sizePx,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas export failed"));
    }, "image/png");
  });
}

interface TextOpts {
  weight?: number | string;
  color?: string;
  family?: string;
  align?: CanvasTextAlign;
  letterSpacing?: string;
}

/** Draw a single line with textBaseline "top"; returns the y just below it. */
function drawLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  sizePx: number,
  fonts: Fonts,
  opts: TextOpts = {},
): number {
  const {
    weight = 400,
    color = "#000000",
    family = fonts.sans,
    align = "center",
    letterSpacing,
  } = opts;
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = color;
  ctx.font = `${weight} ${sizePx}px ${family}`;
  // letterSpacing is progressively enhanced; ignored where unsupported.
  if (letterSpacing !== undefined) {
    try {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        letterSpacing;
    } catch {
      /* older Android Chrome: fall back to default spacing */
    }
  }
  ctx.fillText(text, x, y);
  ctx.restore();
  return y + sizePx;
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  top: number,
  height: number,
): number {
  const width = height * LOGO_RATIO;
  ctx.drawImage(img, cx - width / 2, top, width, height);
  return top + height;
}

/** Rounded-rect path helper (broad browser support without roundRect). */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/* ── poster ──────────────────────────────────────────────────────────────── */

export async function renderPoster(
  code: string,
  firstName: string,
): Promise<Blob> {
  const { width, height } = POSTER_SIZE;
  const cx = width / 2;
  const INK = "#0d0d0f";
  const MUTED = "#52525b";
  const RED = "#de1600";

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const [fonts, logo, qr] = await Promise.all([
    ensureFonts(),
    loadImage(LOGO_LIGHT_BG),
    renderQrCanvas(code, 760),
  ]);

  // Warm paper background.
  ctx.fillStyle = "#fafaf7";
  ctx.fillRect(0, 0, width, height);

  // Logo + a short red rule beneath it.
  drawLogo(ctx, logo, cx, 190, 128);
  ctx.fillStyle = RED;
  roundRectPath(ctx, cx - 110, 400, 220, 8, 4);
  ctx.fill();

  // Headline (serif, brand-print moment) + supporting line.
  let y = 520;
  y = drawLine(ctx, "Food and groceries,", cx, y, 104, fonts, {
    family: fonts.serif,
    color: INK,
  });
  y = drawLine(ctx, "delivered fast.", cx, y + 8, 104, fonts, {
    family: fonts.serif,
    color: INK,
  });
  y = drawLine(ctx, "Scan the code to start ordering.", cx, y + 44, 44, fonts, {
    weight: 500,
    color: MUTED,
  });

  // QR on a bright white tile (guaranteed quiet zone on the warm paper).
  const tile = 860;
  const tileX = cx - tile / 2;
  const tileY = 900;
  ctx.save();
  ctx.shadowColor = "rgba(17,17,17,0.10)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = "#ffffff";
  roundRectPath(ctx, tileX, tileY, tile, tile, 40);
  ctx.fill();
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
  const qrDrawn = 760;
  ctx.drawImage(qr, cx - qrDrawn / 2, tileY + (tile - qrDrawn) / 2, qrDrawn, qrDrawn);
  ctx.imageSmoothingEnabled = true;

  // Code label + huge code inside a bordered box (the mechanism).
  y = tileY + tile + 70;
  y = drawLine(ctx, "USE CODE", cx, y, 40, fonts, {
    weight: 700,
    color: MUTED,
    letterSpacing: "0.28em",
  });
  y += 26;
  const codeSize = 168;
  ctx.font = `700 ${codeSize}px ${fonts.mono}`;
  const codeWidth = ctx.measureText(code).width;
  const boxW = Math.min(width - 200, codeWidth + 160);
  const boxH = codeSize + 72;
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  roundRectPath(ctx, cx - boxW / 2, y, boxW, boxH, 28);
  ctx.stroke();
  drawLine(ctx, code, cx, y + 36, codeSize, fonts, {
    weight: 700,
    color: INK,
    family: fonts.mono,
  });
  y += boxH + 60;

  // Mechanism line + agent attribution + site.
  y = drawLine(
    ctx,
    "Use this code when you sign up at bite.express",
    cx,
    y,
    40,
    fonts,
    { weight: 500, color: INK },
  );
  y += 40;
  const agentLine = firstName
    ? `Your BiteExpress agent: ${firstName}`
    : "Your BiteExpress agent";
  y = drawLine(ctx, agentLine, cx, y, 38, fonts, { weight: 500, color: MUTED });

  return canvasToBlob(canvas);
}

/* ── status image ────────────────────────────────────────────────────────── */

export async function renderStatusImage(
  code: string,
  firstName: string,
): Promise<Blob> {
  const { width, height } = STATUS_SIZE;
  const cx = width / 2;
  const WHITE = "#ffffff";
  const INK300 = "#d4d4d8";
  const INK400 = "#a1a1aa";

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const [fonts, logo, qr] = await Promise.all([
    ensureFonts(),
    loadImage(LOGO_DARK_BG),
    renderQrCanvas(code, 420),
  ]);

  // Obsidian base with brand neon orbs (the ReferralCodeCard identity).
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);
  const glowA = ctx.createRadialGradient(
    width * 0.82, height * 0.1, 0,
    width * 0.82, height * 0.1, width * 0.9,
  );
  glowA.addColorStop(0, "rgba(255,42,20,0.28)");
  glowA.addColorStop(1, "rgba(255,42,20,0)");
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, width, height);
  const glowB = ctx.createRadialGradient(
    width * 0.12, height * 0.9, 0,
    width * 0.12, height * 0.9, width * 0.9,
  );
  glowB.addColorStop(0, "rgba(255,107,74,0.14)");
  glowB.addColorStop(1, "rgba(255,107,74,0)");
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, width, height);

  // Logo.
  drawLogo(ctx, logo, cx, 150, 76);

  // Headline + support.
  let y = 320;
  y = drawLine(ctx, "Food and groceries,", cx, y, 78, fonts, {
    weight: 700,
    color: WHITE,
  });
  y = drawLine(ctx, "delivered fast.", cx, y + 10, 78, fonts, {
    weight: 700,
    color: WHITE,
  });
  y = drawLine(ctx, "Sign up on BiteExpress.", cx, y + 32, 42, fonts, {
    weight: 500,
    color: INK300,
  });

  // Code hero.
  y += 96;
  y = drawLine(ctx, "USE MY CODE", cx, y, 36, fonts, {
    weight: 700,
    color: INK400,
    letterSpacing: "0.28em",
  });
  y += 20;
  y = drawLine(ctx, code, cx, y, 156, fonts, {
    weight: 700,
    color: WHITE,
    family: fonts.mono,
  });

  // QR on a white tile so it scans against the dark surface.
  y += 90;
  const tile = 540;
  const tileX = cx - tile / 2;
  ctx.fillStyle = WHITE;
  roundRectPath(ctx, tileX, y, tile, tile, 40);
  ctx.fill();
  ctx.imageSmoothingEnabled = false;
  const qrDrawn = 420;
  ctx.drawImage(qr, cx - qrDrawn / 2, y + (tile - qrDrawn) / 2, qrDrawn, qrDrawn);
  ctx.imageSmoothingEnabled = true;
  y += tile + 56;

  // Closing tagline + attribution.
  y = drawLine(ctx, "DM me or use my code on bite.express", cx, y, 40, fonts, {
    weight: 600,
    color: WHITE,
  });
  y += 26;
  const agentLine = firstName
    ? `Your BiteExpress agent: ${firstName}`
    : "Your BiteExpress agent";
  drawLine(ctx, agentLine, cx, y, 34, fonts, { weight: 500, color: INK400 });

  return canvasToBlob(canvas);
}
