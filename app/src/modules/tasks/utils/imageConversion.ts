const MAX_DIMENSION = 2048;
const OUTPUT_QUALITY = 0.9;
// iOS WebKit can leave createImageBitmap pending until the page is backgrounded;
// past this point uploading the untouched original beats an endless spinner.
const DECODE_TIMEOUT_MS = 8000;

const WEBP_MIME_TYPE = 'image/webp';
const JPEG_MIME_TYPE = 'image/jpeg';

let cachedOutputType: string | undefined;

/** Safari cannot encode WebP and silently falls back to (much larger) PNG. */
function outputMimeType(): string {
  if (cachedOutputType) return cachedOutputType;
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  cachedOutputType = probe
    .toDataURL(WEBP_MIME_TYPE)
    .startsWith(`data:${WEBP_MIME_TYPE}`)
    ? WEBP_MIME_TYPE
    : JPEG_MIME_TYPE;
  return cachedOutputType;
}

function decodeWithTimeout(file: File): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error('Image decoding timed out.'));
    }, DECODE_TIMEOUT_MS);
    createImageBitmap(file).then(
      (bmp) => {
        clearTimeout(timer);
        if (timedOut) bmp.close();
        else resolve(bmp);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

function dataUrlToBlob(dataUrl: string, type: string): Blob {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function processImageBeforeUpload(imageFile: File): Promise<File> {
  if (
    !imageFile.type.startsWith('image/') ||
    imageFile.type === WEBP_MIME_TYPE
  ) {
    return imageFile;
  }

  try {
    const bmp = await decodeWithTimeout(imageFile);
    let { width, height } = bmp;

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bmp.close();
      throw new Error('Canvas context could not be created.');
    }

    ctx.drawImage(bmp, 0, 0, width, height);
    bmp.close();

    // Synchronous toDataURL instead of toBlob: iOS Safari may never invoke the
    // toBlob callback for a detached canvas while the page stays in the foreground.
    const type = outputMimeType();
    const dataUrl = canvas.toDataURL(type, OUTPUT_QUALITY);

    // iOS caps total canvas memory; release the backing store right away.
    canvas.width = canvas.height = 0;

    const extension = type === WEBP_MIME_TYPE ? 'webp' : 'jpg';
    return new File(
      [dataUrlToBlob(dataUrl, type)],
      imageFile.name.replace(/\.[^/.]+$/, '') + `.${extension}`,
      { type, lastModified: Date.now() },
    );
  } catch (error) {
    console.warn(
      'Image processing failed, falling back to original file',
      error,
    );
    return imageFile;
  }
}
