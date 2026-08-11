/** Downscales an image file client-side and returns it as a data: URL —
 * keeps the local database (and eventually any sync payload) small
 * regardless of the source file's size. Shared by avatar and shop-logo
 * uploads so the resize logic only lives in one place. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      img.onerror = () => reject(new Error("That doesn't look like a valid image."));
      img.onload = () => resolve(img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Center-crops to a square — right for round avatars. */
export async function resizeToSquareDataUrl(file: File, maxDimension = 256): Promise<string> {
  const img = await loadImage(file);
  const side = Math.min(maxDimension, Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");
  const scale = side / Math.min(img.width, img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (side - w) / 2, (side - h) / 2, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** Fits within a bounding box, preserving aspect ratio — right for a shop
 * logo, which is rarely square and shouldn't get cropped or stretched. */
export async function resizeToFitDataUrl(file: File, maxDimension = 320): Promise<string> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");
  ctx.drawImage(img, 0, 0, w, h);
  // PNG, not JPEG — logos are frequently transparent-background artwork.
  return canvas.toDataURL("image/png");
}
