// Client-side helpers for avatar upload:
// - resize to a square, downscale to 512px on the longer edge
// - encode to JPEG for smaller uploads
// - build a private storage path scoped to the user's folder

const AVATAR_SIZE = 512;
const AVATAR_QUALITY = 0.85;

export function avatarPathFor(userId: string): string {
  // Same path every time so `upsert: true` replaces the old file.
  return `${userId}/avatar.jpg`;
}

export async function fileToSquareJpeg(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable in this browser.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close?.();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed."))),
      "image/jpeg",
      AVATAR_QUALITY,
    );
  });
}
