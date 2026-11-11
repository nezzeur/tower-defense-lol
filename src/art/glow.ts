// Soft radial sprites, pre-rendered once per colour. Drawing an image is far cheaper than a canvas
// shadowBlur or a fresh gradient, so every glow, light and soft shadow on the board goes through here.

type G = CanvasRenderingContext2D;

const SIZE = 64;
const cache = new Map<string, HTMLCanvasElement>();

/** Radial falloff tinted with `color` (any solid CSS colour; keep the set of colours small, they are cached). */
export function glowSprite(color: string): HTMLCanvasElement {
  let cv = cache.get(color);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = SIZE;
    const c = cv.getContext('2d')!;
    const grad = c.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.18, 'rgba(255,255,255,0.74)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.28)');
    grad.addColorStop(0.75, 'rgba(255,255,255,0.07)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, SIZE, SIZE);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, SIZE, SIZE);
    cache.set(color, cv);
  }
  return cv;
}

/**
 * Draws a soft disc (or ellipse when `ry` is given) centred on (x, y). The caller picks the blend mode:
 * 'lighter' / 'screen' for light, the default for soft shadows and smoke.
 */
export function drawGlow(g: G, x: number, y: number, r: number, color: string, alpha = 1, ry = r): void {
  if (alpha <= 0.004 || r <= 0) return;
  const prev = g.globalAlpha;
  g.globalAlpha = prev * Math.min(1, alpha);
  g.drawImage(glowSprite(color), x - r, y - ry, r * 2, ry * 2);
  g.globalAlpha = prev;
}

/** Shortest signed turn from angle a to angle b, in [-PI, PI]. */
export function angDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
