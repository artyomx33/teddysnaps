/**
 * Supabase Image Transformation Helper
 *
 * Uses Supabase's built-in image CDN to serve optimized images.
 * Original images stay in storage, transforms are generated on-demand and cached.
 *
 * Docs: https://supabase.com/docs/guides/storage/serving/image-transformations
 */

// DISABLED: We now pre-generate thumbnails at upload time to avoid Supabase costs
// See: scripts/migrate-thumbnails.ts for the migration
// See: src/lib/actions/upload.ts for the new upload flow
const TRANSFORMS_ENABLED = false;

type ImageFormat = 'webp' | 'avif' | 'jpeg' | 'png';
type ResizeMode = 'cover' | 'contain' | 'fill';

interface TransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: ImageFormat;
  resize?: ResizeMode;
}

/**
 * Transforms a Supabase storage URL to use image transformations.
 *
 * @example
 * // Original: https://xxx.supabase.co/storage/v1/object/public/photos/image.jpg
 * // Thumbnail: https://xxx.supabase.co/storage/v1/render/image/public/photos/image.jpg?width=400&format=webp
 */
export function getTransformedUrl(
  originalUrl: string,
  options: TransformOptions = {}
): string {
  // Return original if transforms not enabled
  if (!TRANSFORMS_ENABLED) {
    return originalUrl;
  }

  const {
    width,
    height,
    quality = 75,
    format = 'webp',
    resize = 'cover',
  } = options;

  // Only transform Supabase storage URLs
  if (!originalUrl.includes('supabase.co/storage')) {
    return originalUrl;
  }

  // Convert from /object/public/ to /render/image/public/
  const transformUrl = originalUrl.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );

  // Build query params
  const params = new URLSearchParams();
  if (width) params.set('width', width.toString());
  if (height) params.set('height', height.toString());
  params.set('quality', quality.toString());
  // Note: Supabase uses 'origin' to keep original format, not 'webp'/'avif' directly
  // Omitting format lets Supabase auto-optimize based on browser Accept headers
  if (format !== 'webp') params.set('format', format);
  params.set('resize', resize);

  return `${transformUrl}?${params.toString()}`;
}

/**
 * Preset transformations for common use cases
 */
export const imagePresets = {
  /** Grid thumbnail: 300px, low quality, full image - anti-screenshot (~20-30KB) */
  thumbnail: (url: string) =>
    getTransformedUrl(url, { width: 300, quality: 55, resize: 'contain' }),

  /** Medium preview: 500px, medium quality, full image (~50-80KB) */
  preview: (url: string) =>
    getTransformedUrl(url, { width: 500, quality: 65, resize: 'contain' }),

  /** Lightbox view: 800px, better quality, full image (~100-150KB) */
  lightbox: (url: string) =>
    getTransformedUrl(url, { width: 800, quality: 75, resize: 'contain' }),

  /** High quality for purchase preview: 1200px, good quality */
  highQuality: (url: string) =>
    getTransformedUrl(url, { width: 1200, quality: 85, resize: 'contain' }),
};
