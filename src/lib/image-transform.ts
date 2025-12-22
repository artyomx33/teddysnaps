/**
 * Supabase Image Transformation Helper
 *
 * Uses Supabase's built-in image CDN to serve optimized images.
 * Original images stay in storage, transforms are generated on-demand and cached.
 *
 * Docs: https://supabase.com/docs/guides/storage/serving/image-transformations
 */

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
  params.set('format', format);
  params.set('resize', resize);

  return `${transformUrl}?${params.toString()}`;
}

/**
 * Preset transformations for common use cases
 */
export const imagePresets = {
  /** Grid thumbnail: 400px wide, WebP, 70% quality (~30-50KB) */
  thumbnail: (url: string) =>
    getTransformedUrl(url, { width: 400, quality: 70 }),

  /** Medium preview: 800px wide, WebP, 80% quality (~80-120KB) */
  preview: (url: string) =>
    getTransformedUrl(url, { width: 800, quality: 80 }),

  /** Lightbox view: 1200px wide, WebP, 85% quality (~150-250KB) */
  lightbox: (url: string) =>
    getTransformedUrl(url, { width: 1200, quality: 85 }),

  /** High quality for purchase preview: 1600px, 90% quality */
  highQuality: (url: string) =>
    getTransformedUrl(url, { width: 1600, quality: 90 }),
};
