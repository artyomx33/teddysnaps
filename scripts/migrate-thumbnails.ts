/**
 * Thumbnail Migration Script
 *
 * Generates pre-sized thumbnails for all existing photos to eliminate
 * Supabase Image Transformation costs.
 *
 * Usage:
 *   npx tsx scripts/migrate-thumbnails.ts --dry-run     # Test with 5 photos
 *   npx tsx scripts/migrate-thumbnails.ts               # Run full migration
 *   npx tsx scripts/migrate-thumbnails.ts --batch=100   # Custom batch size
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// ============================================
// CONFIGURATION
// ============================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const CONFIG = {
  // Thumbnail settings (match existing imagePresets.thumbnail)
  thumbnail: {
    width: 300,
    quality: 55,
    format: 'webp' as const,
  },
  // Processing settings
  batchSize: 50,
  delayBetweenBatches: 1000, // ms - be nice to Supabase
  // Storage paths
  sourceBucket: 'photos-originals',
  // Thumbnails go in same bucket under thumbnails/ prefix
  thumbnailPrefix: 'thumbnails/',
};

// ============================================
// SETUP
// ============================================

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BATCH_SIZE = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '') || CONFIG.batchSize;
const SKIP_EXISTING = !args.includes('--force');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing environment variables. Make sure .env.local is loaded.');
  console.error('Run with: npx dotenv -e .env.local -- npx tsx scripts/migrate-thumbnails.ts');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// TYPES
// ============================================

interface Photo {
  id: string;
  session_id: string;
  original_url: string;
  thumbnail_url: string | null;
  filename: string | null;
}

interface MigrationStats {
  total: number;
  processed: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

// ============================================
// HELPERS
// ============================================

function extractStoragePath(url: string): string | null {
  // Extract path from: https://xxx.supabase.co/storage/v1/object/public/photos-originals/sessionId/filename.jpg
  const match = url.match(/\/storage\/v1\/object\/public\/photos-originals\/(.+)$/);
  return match ? match[1] : null;
}

function getThumbnailPath(originalPath: string): string {
  // Original: sessionId/1234-photo.jpg
  // Thumbnail: thumbnails/sessionId/1234-photo.webp
  const pathWithoutExt = originalPath.replace(/\.[^.]+$/, '');
  return `${CONFIG.thumbnailPrefix}${pathWithoutExt}.webp`;
}

function getThumbnailUrl(thumbnailPath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${CONFIG.sourceBucket}/${thumbnailPath}`;
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function generateThumbnail(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(CONFIG.thumbnail.width, null, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: CONFIG.thumbnail.quality })
    .toBuffer();
}

async function uploadThumbnail(thumbnailBuffer: Buffer, path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(CONFIG.sourceBucket)
    .upload(path, thumbnailBuffer, {
      contentType: 'image/webp',
      upsert: true, // Overwrite if exists
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}

async function updatePhotoRecord(photoId: string, thumbnailUrl: string): Promise<void> {
  const { error } = await supabase
    .from('photos')
    .update({ thumbnail_url: thumbnailUrl })
    .eq('id', photoId);

  if (error) {
    throw new Error(`DB update failed: ${error.message}`);
  }
}

async function thumbnailExists(path: string): Promise<boolean> {
  const { data } = await supabase.storage
    .from(CONFIG.sourceBucket)
    .list(path.split('/').slice(0, -1).join('/'), {
      search: path.split('/').pop(),
    });
  return (data?.length ?? 0) > 0;
}

// ============================================
// MAIN MIGRATION
// ============================================

async function processPhoto(photo: Photo, stats: MigrationStats): Promise<boolean> {
  const originalPath = extractStoragePath(photo.original_url);

  if (!originalPath) {
    console.log(`  [SKIP] ${photo.id}: Cannot extract path from URL`);
    stats.skipped++;
    return false;
  }

  const thumbnailPath = getThumbnailPath(originalPath);
  const thumbnailUrl = getThumbnailUrl(thumbnailPath);

  // Check if thumbnail already exists and URL is already updated
  if (SKIP_EXISTING && photo.thumbnail_url?.includes('/thumbnails/')) {
    console.log(`  [SKIP] ${photo.id}: Already has thumbnail URL`);
    stats.skipped++;
    return false;
  }

  try {
    // 1. Download original
    console.log(`  [DOWN] ${photo.id}: Downloading original...`);
    const originalBuffer = await downloadImage(photo.original_url);

    // 2. Generate thumbnail
    console.log(`  [PROC] ${photo.id}: Generating thumbnail (${CONFIG.thumbnail.width}px, q${CONFIG.thumbnail.quality})...`);
    const thumbnailBuffer = await generateThumbnail(originalBuffer);

    const originalSize = (originalBuffer.length / 1024).toFixed(1);
    const thumbnailSize = (thumbnailBuffer.length / 1024).toFixed(1);
    console.log(`  [SIZE] ${photo.id}: ${originalSize}KB -> ${thumbnailSize}KB (${((1 - thumbnailBuffer.length / originalBuffer.length) * 100).toFixed(0)}% reduction)`);

    if (DRY_RUN) {
      console.log(`  [DRY]  ${photo.id}: Would upload to ${thumbnailPath}`);
      console.log(`  [DRY]  ${photo.id}: Would update DB with ${thumbnailUrl}`);
    } else {
      // 3. Upload thumbnail
      console.log(`  [UPLD] ${photo.id}: Uploading thumbnail...`);
      await uploadThumbnail(thumbnailBuffer, thumbnailPath);

      // 4. Update database
      console.log(`  [DB]   ${photo.id}: Updating database...`);
      await updatePhotoRecord(photo.id, thumbnailUrl);
    }

    console.log(`  [DONE] ${photo.id}: Success!`);
    stats.processed++;
    return true;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  [FAIL] ${photo.id}: ${errorMessage}`);
    stats.failed++;
    stats.errors.push({ id: photo.id, error: errorMessage });
    return false;
  }
}

async function migrate(): Promise<void> {
  console.log('\n========================================');
  console.log('  TEDDYSNAPS THUMBNAIL MIGRATION');
  console.log('========================================\n');

  if (DRY_RUN) {
    console.log('>>> DRY RUN MODE - No changes will be made <<<\n');
  }

  console.log(`Config:`);
  console.log(`  - Thumbnail: ${CONFIG.thumbnail.width}px, quality ${CONFIG.thumbnail.quality}, ${CONFIG.thumbnail.format}`);
  console.log(`  - Batch size: ${BATCH_SIZE}`);
  console.log(`  - Skip existing: ${SKIP_EXISTING}`);
  console.log('');

  // Fetch all photos
  console.log('Fetching photos from database...');
  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, session_id, original_url, thumbnail_url, filename')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch photos:', error);
    process.exit(1);
  }

  if (!photos || photos.length === 0) {
    console.log('No photos found!');
    return;
  }

  console.log(`Found ${photos.length} photos\n`);

  // Limit for dry run
  const photosToProcess = DRY_RUN ? photos.slice(0, 5) : photos;

  if (DRY_RUN) {
    console.log(`(Dry run: processing first 5 of ${photos.length} photos)\n`);
  }

  const stats: MigrationStats = {
    total: photosToProcess.length,
    processed: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Process in batches
  const batches = Math.ceil(photosToProcess.length / BATCH_SIZE);

  for (let i = 0; i < batches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, photosToProcess.length);
    const batch = photosToProcess.slice(start, end);

    console.log(`\n--- Batch ${i + 1}/${batches} (photos ${start + 1}-${end}) ---\n`);

    for (const photo of batch) {
      await processPhoto(photo, stats);
    }

    // Delay between batches (except last)
    if (i < batches - 1 && !DRY_RUN) {
      console.log(`\nWaiting ${CONFIG.delayBetweenBatches}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenBatches));
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('  MIGRATION COMPLETE');
  console.log('========================================\n');
  console.log(`Total:     ${stats.total}`);
  console.log(`Processed: ${stats.processed}`);
  console.log(`Skipped:   ${stats.skipped}`);
  console.log(`Failed:    ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach(({ id, error }) => {
      console.log(`  - ${id}: ${error}`);
    });
  }

  if (DRY_RUN) {
    console.log('\n>>> This was a DRY RUN - no changes were made <<<');
    console.log('>>> Run without --dry-run to apply changes <<<\n');
  }
}

// Run
migrate().catch(console.error);
