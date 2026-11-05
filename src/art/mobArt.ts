// Optional custom enemy art: drop <enemy id>.png files in public/mobs/ and the battle draws them
// instead of the built-in pixel sprites. Missing files fall back silently.
const images = new Map<string, HTMLImageElement | null>();

export function mobImage(id: string): HTMLImageElement | null {
  if (!images.has(id)) {
    const img = new Image();
    images.set(id, null);
    img.onload = () => images.set(id, img);
    img.src = `${import.meta.env.BASE_URL}mobs/${id}.png`;
  }
  return images.get(id) ?? null;
}
