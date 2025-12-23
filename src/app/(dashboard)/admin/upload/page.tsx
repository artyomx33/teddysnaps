"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  CheckCircle,
  Plus,
  Sparkles,
  Loader2,
  Brain,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Dropzone } from "@/components/upload/dropzone";
import { UploadQueue } from "@/components/upload/upload-queue";
import { SessionForm } from "@/components/upload/session-form";
import { Button, Card, CardContent, Badge, Input } from "@/components/ui";
import { useUploadStore } from "@/stores";
import {
  createPhotoSession,
  getLocations,
  createLocation,
  getSessionPhotos,
} from "@/lib/actions/upload";
import { enqueueFaceJob, getFaceJobForSession, type FaceJob } from "@/lib/actions/face-jobs";
import { createClient } from "@/lib/supabase/client";

export default function UploadPage() {
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiJob, setAiJob] = useState<FaceJob | null>(null);
  const [aiComplete, setAiComplete] = useState(false);

  const {
    files,
    sessionName,
    locationId,
    isProcessing,
    setProcessing,
    updateFile,
    getCompleteCount,
    getPendingCount,
  } = useUploadStore();

  // Fetch locations on mount
  useEffect(() => {
    async function fetchLocations() {
      const locs = await getLocations();
      setLocations(locs);
    }
    fetchLocations();
  }, []);

  const handleAddLocation = async () => {
    if (!newLocationName.trim()) return;

    const slug = newLocationName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    try {
      const newLoc = await createLocation(newLocationName, slug);
      setLocations((prev) => [...prev, newLoc]);
      setNewLocationName("");
      setShowAddLocation(false);
    } catch (error) {
      console.error("Failed to create location:", error);
    }
  };

  const handleSessionCreate = async (data: {
    name: string;
    date: string;
    locationId: string;
  }) => {
    try {
      const session = await createPhotoSession({
        name: data.name,
        shootDate: data.date,
        locationId: data.locationId,
      });
      setSessionId(session.id);
    } catch (error) {
      console.error("Failed to create session:", error);
    }
  };

  const startUpload = useCallback(async () => {
    if (!sessionId || files.length === 0) return;

    setIsUploading(true);
    setProcessing(true);

    const pendingFiles = files.filter((f) => f.status === "pending");
    const CONCURRENCY_LIMIT = 5; // Upload 5 files at a time
    const supabase = createClient();
    const UPLOAD_TIMEOUT_MS = 90_000;
    const DB_BATCH_SIZE = 25;
    const DB_TIMEOUT_MS = 20_000;

    type DbBatchItem = {
      fileId: string;
      record: {
        session_id: string;
        original_url: string;
        thumbnail_url: string;
        filename: string;
      };
    };

    const dbQueue: DbBatchItem[] = [];
    let flushing = false;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleFlush = () => {
      if (flushing) return;
      if (dbQueue.length >= DB_BATCH_SIZE) {
        // Flush immediately when we have a full batch.
        void flushDbQueue();
        return;
      }
      // Otherwise debounce (coalesce many uploads into fewer inserts).
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        void flushDbQueue();
      }, 1000);
    };

    const flushDbQueue = async () => {
      if (flushing) return;
      if (dbQueue.length === 0) return;

      flushing = true;
      try {
        while (dbQueue.length > 0) {
          const batch = dbQueue.splice(0, DB_BATCH_SIZE);
          const records = batch.map((b) => b.record);

          const insertPromise = supabase.from("photos").insert(records);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("DB insert timed out")), DB_TIMEOUT_MS)
          );

          const result = await Promise.race([insertPromise, timeoutPromise]);
          // supabase-js returns { data, error }, but result could be a thrown timeout
          const dbError = (result as any)?.error as unknown;
          if (dbError) throw dbError;

          // Mark files complete
          for (const b of batch) {
            updateFile(b.fileId, { status: "complete", progress: 100, error: undefined });
          }
        }
      } catch (error) {
        // If the batch insert fails, mark those files as error so user can retry.
        const message = error instanceof Error ? error.message : "DB insert failed";
        console.error("DB batch insert failed:", error);
        // Mark everything still queued as failed so the retry UX can recover.
        for (const b of dbQueue.splice(0, dbQueue.length)) {
          updateFile(b.fileId, { status: "error", error: message });
        }
      } finally {
        flushing = false;
      }
    };

    // Upload a single file
    const uploadSingleFile = async (file: typeof pendingFiles[0]) => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        updateFile(file.id, { status: "error", error: "Offline. Check Wi‑Fi and retry." });
        return;
      }

      let progressInterval: ReturnType<typeof setInterval> | null = null;

      try {
        updateFile(file.id, { status: "uploading", progress: 0 });

        // Progress simulation (we don't have upload progress events here)
        let simulated = 0;
        progressInterval = setInterval(() => {
          simulated = Math.min(simulated + 8, 90);
          updateFile(file.id, {
            progress: simulated,
          });
        }, 150);

        // Deterministic path so retries overwrite rather than creating orphan objects.
        const storagePath = `${sessionId}/${file.id}-${file.file.name}`;

        const uploadPromise = supabase.storage
          .from("photos-originals")
          .upload(storagePath, file.file, { upsert: true });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Upload timed out")), UPLOAD_TIMEOUT_MS)
        );

        const { error: uploadError } = await Promise.race([uploadPromise, timeoutPromise]);

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrl } = supabase.storage
          .from("photos-originals")
          .getPublicUrl(storagePath);

        const originalUrl = publicUrl.publicUrl;
        const thumbnailUrl = publicUrl.publicUrl;

        if (progressInterval) clearInterval(progressInterval);

        // Queue DB insert and mark as processing while we batch-write.
        updateFile(file.id, { status: "processing", progress: 95, error: undefined });
        dbQueue.push({
          fileId: file.id,
          record: {
            session_id: sessionId,
            original_url: originalUrl,
            thumbnail_url: thumbnailUrl,
            filename: file.file.name,
          },
        });

        // Flush in the background so upload concurrency isn't blocked by DB latency.
        scheduleFlush();
      } catch (error) {
        console.error("Upload failed:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Upload failed";
        if (progressInterval) clearInterval(progressInterval);
        updateFile(file.id, { status: "error", error: message });
      }
    };

    // Process uploads in parallel batches
    const uploadInBatches = async () => {
      const queue = [...pendingFiles];
      const active: Promise<void>[] = [];

      while (queue.length > 0 || active.length > 0) {
        // Fill up to concurrency limit
        while (active.length < CONCURRENCY_LIMIT && queue.length > 0) {
          const file = queue.shift()!;
          const promise = uploadSingleFile(file).then(() => {
            active.splice(active.indexOf(promise), 1);
          });
          active.push(promise);
        }

        // Wait for at least one to complete before adding more
        if (active.length > 0) {
          await Promise.race(active);
        }
      }
    };

    await uploadInBatches();

    // Flush any remaining DB inserts after all uploads finished.
    await flushDbQueue();
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    setIsUploading(false);
    setProcessing(false);
  }, [sessionId, files, updateFile, setProcessing]);

  const retryFailed = useCallback(() => {
    if (isUploading) return;
    const failed = files.filter((f) => f.status === "error");
    if (failed.length === 0) return;
    for (const f of failed) {
      updateFile(f.id, { status: "pending", progress: 0, error: undefined });
    }
    // Kick off uploads on next tick so state is updated.
    setTimeout(() => {
      startUpload().catch(() => {});
    }, 0);
  }, [files, isUploading, startUpload, updateFile]);

  const retryFile = useCallback((fileId: string) => {
    if (isUploading) return;
    updateFile(fileId, { status: "pending", progress: 0, error: undefined });
    setTimeout(() => {
      startUpload().catch(() => {});
    }, 0);
  }, [isUploading, startUpload, updateFile]);

  const pollJob = useCallback(async (sid: string) => {
    const current = await getFaceJobForSession(sid);
    if (!current) return;
    setAiJob(current);
    if (current.status === "complete") {
      setAiComplete(true);
      setIsProcessingAI(false);
    }
    if (current.status === "failed") {
      setIsProcessingAI(false);
      console.error("Face job failed:", current.error);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    if (!aiJob || (aiJob.status !== "queued" && aiJob.status !== "running")) return;

    const t = setInterval(() => {
      pollJob(sessionId).catch(() => {});
    }, 1500);

    return () => clearInterval(t);
  }, [aiJob?.status, pollJob, sessionId]);

  // If a job already exists for this session, load it (useful on refresh).
  useEffect(() => {
    if (!sessionId) return;
    pollJob(sessionId).catch(() => {});
  }, [sessionId, pollJob]);

  const startAIProcessing = useCallback(async () => {
    if (!sessionId) return;

    setIsProcessingAI(true);

    try {
      // Ensure there are photos, then enqueue server worker job
      const photos = await getSessionPhotos(sessionId);
      if (photos.length === 0) {
        console.log("No photos to process");
        setIsProcessingAI(false);
        return;
      }

      const job = await enqueueFaceJob(sessionId);
      setAiJob(job);
      await pollJob(sessionId);
    } catch (error) {
      console.error("AI processing failed:", error);
    } finally {
      // Keep isProcessingAI true while job runs async; polling will flip it.
    }
  }, [sessionId]);

  const pendingCount = getPendingCount();
  const completeCount = getCompleteCount();
  const hasFiles = files.length > 0;
  const canStartUpload = hasFiles && sessionId && pendingCount > 0;
  const allUploadsComplete = completeCount > 0 && completeCount === files.length;

  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" />

      <main className="flex-1 ml-64">
        <Header title="Upload Photos" subtitle="Create a new photo session" />

        <div className="p-6 space-y-6">
          {/* Session Form */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">Session Details</h2>
              {sessionId && (
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Session Created
                </Badge>
              )}
            </div>

            <SessionForm
              onSubmit={handleSessionCreate}
              locations={locations}
            />

            {/* Add Location */}
            {showAddLocation ? (
              <Card variant="glass" className="p-4">
                <div className="flex items-center gap-3">
                  <Input
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    placeholder="e.g., TeddyKids Leiden"
                    className="flex-1"
                  />
                  <Button onClick={handleAddLocation} size="sm">
                    Add
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddLocation(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </Card>
            ) : (
              <button
                onClick={() => setShowAddLocation(true)}
                className="text-sm text-gold-500 hover:text-gold-400 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add new location
              </button>
            )}
          </div>

          {/* Create Session Button */}
          {!sessionId && sessionName && locationId && (
            <Button
              onClick={() =>
                handleSessionCreate({
                  name: sessionName,
                  date: new Date().toISOString().split("T")[0],
                  locationId,
                })
              }
              variant="primary"
              size="lg"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Create Session & Start Upload
            </Button>
          )}

          {/* Dropzone */}
          {sessionId && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Dropzone />
            </motion.div>
          )}

          {/* Upload Queue */}
          {hasFiles && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-white">Upload Queue</h2>
                <div className="flex items-center gap-3">
                  {canStartUpload && (
                    <Button
                      onClick={startUpload}
                      disabled={isUploading}
                      variant="primary"
                    >
                      {isUploading ? (
                        <>
                          <Pause className="w-4 h-4 mr-2" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Start Upload ({pendingCount})
                        </>
                      )}
                    </Button>
                  )}
                  {allUploadsComplete && (
                    <Badge variant="success">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      All uploads complete!
                    </Badge>
                  )}
                </div>
              </div>

              <UploadQueue onRetryFailed={retryFailed} onRetryFile={retryFile} />
            </motion.div>
          )}

          {/* AI Processing Card */}
          {(completeCount > 0 || sessionId) && (
            <Card variant="glass">
              <CardContent>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                    {isProcessingAI ? (
                      <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
                    ) : aiComplete ? (
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    ) : (
                      <Brain className="w-6 h-6 text-teal-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white mb-1">
                      {aiComplete
                        ? "AI Processing Complete"
                        : isProcessingAI
                        ? "Processing Photos..."
                        : "AI Face Recognition Ready"}
                    </h3>
                    {isProcessingAI && aiJob ? (
                      <div className="space-y-2">
                        <p className="text-sm text-charcoal-400">
                          {aiJob?.message || "Processing..."}{" "}
                          <span className="text-teal-400">
                            {aiJob?.status === "queued"
                              ? "Queued"
                              : aiJob?.status === "running"
                              ? "Running"
                              : aiJob?.status === "complete"
                              ? "Done"
                              : aiJob?.status === "failed"
                              ? "Failed"
                              : ""}
                          </span>
                        </p>
                        <div className="w-full h-2 bg-charcoal-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500 transition-all duration-300"
                            style={{
                              width: `${Math.round((aiJob?.progress || 0) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : aiComplete ? (
                      <p className="text-sm text-green-400">
                        Face extraction and clustering is complete. Go to Admin → Faces to label clusters.
                      </p>
                    ) : (
                      <p className="text-sm text-charcoal-400">
                        Start server-side face discovery to cluster everyone. Then label clusters in Admin → Faces.
                      </p>
                    )}
                    {!isProcessingAI && !aiComplete && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={startAIProcessing}
                        disabled={!sessionId}
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Start Face Processing (Server)
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
