import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic"]);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const [k, v] = a.split("=");
    const key = k.slice(2);
    if (v !== undefined) out[key] = v;
    else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) out[key] = argv[++i];
    else out[key] = true;
  }
  return out;
}

function requireString(name, v) {
  if (!v || typeof v !== "string") {
    throw new Error(`Missing required ${name}`);
  }
  return v;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".heic") return "image/heic";
  return "application/octet-stream";
}

async function walkFiles(rootDir) {
  const results = [];
  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile()) results.push(full);
    }
  }
  await walk(rootDir);
  return results;
}

function sanitizeObjectPath(p) {
  // Keep folder structure but avoid weird whitespace.
  return p
    .split(path.sep)
    .map((seg) => seg.trim().replace(/\s+/g, "_"))
    .filter(Boolean)
    .join("/");
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function loadManifestSet(manifestPath) {
  const set = new Set();
  if (!fs.existsSync(manifestPath)) return set;
  const txt = await fsp.readFile(manifestPath, "utf8");
  for (const line of txt.split("\n")) {
    if (!line.trim()) continue;
    try {
      const j = JSON.parse(line);
      if (j?.src) set.add(j.src);
    } catch {
      // ignore
    }
  }
  return set;
}

async function appendManifest(manifestPath, record) {
  await fsp.appendFile(manifestPath, JSON.stringify(record) + "\n", "utf8");
}

async function runPool(items, concurrency, worker) {
  let idx = 0;
  let inFlight = 0;
  let resolved = 0;
  let rejected = 0;

  return await new Promise((resolve, reject) => {
    const results = [];

    const pump = () => {
      if (resolved + rejected === items.length && inFlight === 0) {
        return resolve({ results, resolved, rejected });
      }
      while (inFlight < concurrency && idx < items.length) {
        const currentIndex = idx++;
        const item = items[currentIndex];
        inFlight++;
        Promise.resolve()
          .then(() => worker(item, currentIndex))
          .then((r) => {
            results[currentIndex] = r;
            resolved++;
          })
          .catch((e) => {
            results[currentIndex] = e;
            rejected++;
          })
          .finally(() => {
            inFlight--;
            pump();
          });
      }
    };

    try {
      pump();
    } catch (e) {
      reject(e);
    }
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const folder = requireString("folder", args.folder);
  const sessionId = requireString("session-id", args["session-id"]);
  const bucket = (args.bucket || "photos-originals").toString();
  const concurrency = Number(args.concurrency || 6);
  const dryRun = args["dry-run"] === true || args["dry-run"] === "true";
  const insertDb = !(args["no-insert-db"] === true || args["no-insert-db"] === "true");
  const prefix =
    args.prefix?.toString() ||
    `sessions/${sessionId}/originals`;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase credentials. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const manifestDir = path.join(process.cwd(), ".upload-manifests");
  await ensureDir(manifestDir);
  const manifestPath = path.join(manifestDir, `session-${sessionId}.jsonl`);
  const already = await loadManifestSet(manifestPath);

  console.log("[bulk-upload] folder:", folder);
  console.log("[bulk-upload] sessionId:", sessionId);
  console.log("[bulk-upload] bucket:", bucket);
  console.log("[bulk-upload] prefix:", prefix);
  console.log("[bulk-upload] concurrency:", concurrency);
  console.log("[bulk-upload] insertDb:", insertDb);
  console.log("[bulk-upload] dryRun:", dryRun);
  console.log("[bulk-upload] manifest:", manifestPath);

  const allFiles = await walkFiles(folder);
  const files = allFiles.filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
  console.log(`[bulk-upload] found ${files.length} image files`);

  const pending = files.filter((f) => !already.has(f));
  console.log(`[bulk-upload] pending ${pending.length} (skipping ${files.length - pending.length} already in manifest)`);

  let uploaded = 0;
  let inserted = 0;
  const t0 = Date.now();

  async function uploadOne(srcPath, i) {
    const rel = path.relative(folder, srcPath);
    const objectPath = sanitizeObjectPath(path.posix.join(prefix, rel.split(path.sep).join("/")));

    if (dryRun) {
      await appendManifest(manifestPath, { src: srcPath, objectPath, ok: true, dryRun: true, ts: new Date().toISOString() });
      return;
    }

    const buf = await fsp.readFile(srcPath);
    const ct = contentTypeFor(srcPath);

    // Upload with retries
    let lastErr = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const { error } = await supabase.storage.from(bucket).upload(objectPath, buf, {
        contentType: ct,
        upsert: false,
      });

      if (!error) {
        lastErr = null;
        break;
      }

      // 409 conflict (already exists) is ok for resume.
      if (error.statusCode === "409" || error.statusCode === 409) {
        lastErr = null;
        break;
      }

      lastErr = error;
      const backoff = 500 * attempt;
      console.warn(`[bulk-upload] upload retry ${attempt}/4 for ${rel}:`, error.message || error, "sleep", backoff);
      await sleep(backoff);
    }

    if (lastErr) {
      await appendManifest(manifestPath, {
        src: srcPath,
        objectPath,
        ok: false,
        step: "upload",
        error: { message: lastErr.message, statusCode: lastErr.statusCode },
        ts: new Date().toISOString(),
      });
      throw new Error(`Upload failed: ${rel} (${lastErr.message})`);
    }

    uploaded++;

    let publicUrl = null;
    try {
      publicUrl = supabase.storage.from(bucket).getPublicUrl(objectPath)?.data?.publicUrl || null;
    } catch {
      // ignore
    }

    if (insertDb) {
      const row = {
        session_id: sessionId,
        original_url: publicUrl ?? `${bucket}:${objectPath}`,
        thumbnail_url: publicUrl ?? null,
        filename: path.basename(srcPath),
      };

      // One-by-one insert (simple and reliable). Can be optimized later.
      const { error } = await supabase.from("photos").insert(row);
      if (error) {
        await appendManifest(manifestPath, {
          src: srcPath,
          objectPath,
          ok: false,
          step: "db_insert",
          error: { message: error.message, code: error.code, details: error.details, hint: error.hint },
          ts: new Date().toISOString(),
        });
        throw new Error(`DB insert failed for ${rel}: ${error.message}`);
      }
      inserted++;
    }

    await appendManifest(manifestPath, {
      src: srcPath,
      objectPath,
      ok: true,
      publicUrl,
      insertedDb: insertDb,
      ts: new Date().toISOString(),
    });

    const done = uploaded;
    const total = pending.length;
    if (done % 25 === 0 || done === total) {
      const elapsed = (Date.now() - t0) / 1000;
      const rate = done / Math.max(1, elapsed);
      console.log(`[bulk-upload] ${done}/${total} uploaded (${rate.toFixed(2)} files/s)`);
    }
  }

  const { rejected } = await runPool(pending, concurrency, uploadOne);

  console.log("[bulk-upload] done", {
    uploaded,
    inserted,
    failed: rejected,
    seconds: Math.round((Date.now() - t0) / 1000),
  });
}

main().catch((e) => {
  console.error("[bulk-upload] fatal:", e);
  process.exitCode = 1;
});



