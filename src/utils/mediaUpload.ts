export interface PreparedMediaPayload {
  dataBase64: string;
  filename: string;
  mimeType: string;
}

const readFileRawAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });

const optimizeImageFileToDataUrl = (file: File): Promise<PreparedMediaPayload> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const maxDim = 1600;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas context unavailable.'));
          return;
        }

        const isPngOrWebp =
          file.type === 'image/png' ||
          file.type === 'image/webp' ||
          /\.(png|webp)$/i.test(file.name);

        if (!isPngOrWebp) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);

        const targetMime =
          file.type === 'image/png' && file.size < 900 * 1024 ? 'image/png' : 'image/jpeg';
        let dataUrl = canvas.toDataURL(targetMime, targetMime === 'image/png' ? undefined : 0.84);

        // Keep base64 payload comfortably under Netlify's 6MB request cap
        if (dataUrl.length > 3_500_000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        }

        URL.revokeObjectURL(objectUrl);
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'upload';
        const ext = targetMime === 'image/png' ? '.png' : '.jpg';
        resolve({
          dataBase64: dataUrl,
          filename: `${baseName}${ext}`,
          mimeType: targetMime,
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not decode selected image.'));
    };

    img.src = objectUrl;
  });

export const prepareMediaForUpload = async (file: File): Promise<PreparedMediaPayload> => {
  const lower = file.name.toLowerCase();
  const isRasterImage =
    (file.type.startsWith('image/') || /\.(jpe?g|png|webp|avif)$/i.test(lower)) &&
    file.type !== 'image/svg+xml' &&
    file.type !== 'image/gif' &&
    !lower.endsWith('.svg') &&
    !lower.endsWith('.gif');

  if (isRasterImage && (file.size > 450 * 1024 || lower.endsWith('.heic') || lower.endsWith('.avif'))) {
    try {
      return await optimizeImageFileToDataUrl(file);
    } catch {
      // Fallback to raw data URL if canvas decode fails (e.g. non-standard codec)
    }
  }

  const rawDataUrl = await readFileRawAsDataUrl(file);
  return {
    dataBase64: rawDataUrl,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
  };
};

export const parseJsonResponseSafe = async <T = any>(res: Response): Promise<T> => {
  const text = await res.text();
  if (!text) {
    if (!res.ok) {
      throw new Error(`Server returned empty error response (${res.status}).`);
    }
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    if (res.status === 413) {
      throw new Error('Selected file is too large for upload. Please use a smaller image.');
    }
    throw new Error(
      `Server returned an unexpected response (${res.status}). Please try again.`
    );
  }
};
