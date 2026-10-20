import { supabase } from './supabaseClient';

// Originals may be large phone photos; they are shrunk before upload, and the
// uploaded file must then fit within IMAGE_MAX_BYTES.
export const IMAGE_MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_QUALITY = 0.82;
// Files this small and within the size limit are uploaded as-is.
const IMAGE_KEEP_BELOW_BYTES = 300 * 1024;
export const IMAGE_BUCKET = import.meta.env.VITE_SUPABASE_IMAGES_BUCKET || 'Bilder';

const sanitizePathPart = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const getExtension = (file: File): string => {
  const extension = file.name.split('.').pop();
  return extension ? `.${sanitizePathPart(extension)}` : '';
};

export function validateImageFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error(`${file.name} er ikke et bilde.`);
  }

  if (file.size > IMAGE_MAX_SOURCE_BYTES) {
    throw new Error(`${file.name} er større enn 20 MB.`);
  }
}

const loadBitmap = (file: File) => createImageBitmap(file, { imageOrientation: 'from-image' });

// Scales photos down to at most IMAGE_MAX_DIMENSION px and re-encodes them as JPEG, which
// turns a typical 3-5 MB phone photo into a few hundred kB. Animated and vector images, and
// formats the browser can't decode, are returned unchanged.
export async function shrinkImage(file: File): Promise<File> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await loadBitmap(file);
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= IMAGE_KEEP_BELOW_BYTES) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return file;
    // JPEG has no transparency; a white background keeps transparent PNGs readable.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', IMAGE_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    const name = `${file.name.replace(/\.[^.]+$/, '') || 'image'}.jpg`;
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}

export function createImagePath(userId: string, folder: string, file: File): string {
  const safeFolder = sanitizePathPart(folder) || 'images';
  const safeName = sanitizePathPart(file.name.replace(/\.[^.]+$/, '')) || 'image';
  const uniquePart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${userId}/${safeFolder}/${uniquePart}-${safeName}${getExtension(file)}`;
}

export async function uploadImages(
  userId: string,
  folder: string,
  files: File[]
): Promise<string[]> {
  // Validate and shrink everything first so a bad file can't leave earlier uploads orphaned.
  files.forEach(validateImageFile);
  const prepared = await Promise.all(files.map(shrinkImage));
  prepared.forEach((file, index) => {
    if (file.size > IMAGE_MAX_BYTES) {
      throw new Error(`${files[index].name} er for stort. Prøv et mindre bilde (maks 5 MB).`);
    }
  });

  const results = await Promise.all(
    prepared.map(async (file) => {
      const path = createImagePath(userId, folder, file);
      const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
      return { path, error };
    })
  );

  const paths = results.filter((result) => !result.error).map((result) => result.path);
  const failed = results.find((result) => result.error)?.error;

  if (failed) {
    try {
      await deleteImages(paths);
    } catch (cleanupError) {
      const cleanupMessage =
        cleanupError instanceof Error ? cleanupError.message : 'opprydding feilet';
      throw new Error(`${failed.message}. ${cleanupMessage}`);
    }
    throw new Error(failed.message);
  }

  return paths;
}

export async function deleteImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths);
  if (error) {
    throw new Error(error.message);
  }
  paths.forEach((path) => signedUrlCache.delete(path));
}

export async function deleteImagesBestEffort(paths: string[]): Promise<void> {
  try {
    await deleteImages(paths);
  } catch (error) {
    console.error('Kunne ikke slette bilder fra storage', error);
  }
}

// Signed URLs are reused until shortly before they expire. A new URL for the same image
// would bypass the browser's cache and download the image again.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_REUSE_MARGIN_MS = 5 * 60 * 1000;

export function clearSignedUrlCache(): void {
  signedUrlCache.clear();
}

// Returns path -> signed URL; paths that couldn't be signed (e.g. deleted files) are left out.
export async function getSignedImageUrlMap(
  paths: string[],
  expiresIn = 60 * 60
): Promise<Record<string, string>> {
  const now = Date.now();
  const missing = Array.from(new Set(paths)).filter((path) => {
    const cached = signedUrlCache.get(path);
    return !cached || cached.expiresAt - now < SIGNED_URL_REUSE_MARGIN_MS;
  });

  if (missing.length > 0) {
    const { data, error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .createSignedUrls(missing, expiresIn);

    if (error) {
      throw new Error(error.message);
    }

    const expiresAt = now + expiresIn * 1000;
    data.forEach((item, index) => {
      const path = item.path ?? missing[index];
      if (item.signedUrl && path) signedUrlCache.set(path, { url: item.signedUrl, expiresAt });
    });
  }

  return Object.fromEntries(
    paths.flatMap((path) => {
      const cached = signedUrlCache.get(path);
      return cached ? [[path, cached.url]] : [];
    })
  );
}

export async function createSignedImageUrls(
  paths: string[],
  expiresIn = 60 * 60
): Promise<string[]> {
  if (paths.length === 0) return [];

  const urls = await getSignedImageUrlMap(paths, expiresIn);
  return paths.map((path) => urls[path]).filter(Boolean);
}

export async function createSignedImageUrl(
  path?: string | null,
  expiresIn = 60 * 60
): Promise<string | null> {
  if (!path) return null;

  const [url] = await createSignedImageUrls([path], expiresIn);
  return url ?? null;
}
