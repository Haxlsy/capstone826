/**
 * Shrinks a photo in the browser before it is uploaded: resized to at most
 * `maxWidth` wide and re-encoded as JPEG. A phone camera photo is typically
 * 4 to 12 MB; uploads go through a server function that the host rejects
 * above 4.5 MB (see MAX_UPLOAD_REQUEST_BYTES in lib/media/limits.ts), so
 * every photo upload must go through this first.
 *
 * Browser only. Never rejects: if the image cannot be read or encoded, the
 * original file is returned unchanged.
 */
export function compressImage(file: File, maxWidth = 1920, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }) : file),
        "image/jpeg", quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
