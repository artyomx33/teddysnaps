"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Scan,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Server,
} from "lucide-react";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { enqueueFaceJob, getFaceJobForSession, type FaceJob } from "@/lib/actions/face-jobs";

interface FaceDiscoveryProps {
  sessionId: string;
  photos: Array<{ id: string; url: string }>;
  onComplete: (totalFaces: number) => void;
}

export function FaceDiscovery({
  sessionId,
  photos,
  onComplete,
}: FaceDiscoveryProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [job, setJob] = useState<FaceJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const pollJob = useCallback(async () => {
    const current = await getFaceJobForSession(sessionId);
    if (!current) return;
    setJob(current);

    if (current.status === "complete") {
      setIsProcessing(false);
      setIsComplete(true);
      onComplete(current.faces_total ?? 0);
    }

    if (current.status === "failed") {
      setIsProcessing(false);
      setError(current.error || "Face processing failed. Please retry.");
    }
  }, [sessionId, onComplete]);

  // If a job exists (queued/running), keep polling.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const shouldPoll = job?.status === "queued" || job?.status === "running";
    if (shouldPoll) {
      timer = setInterval(() => {
        pollJob().catch(() => {});
      }, 1500);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [job?.status, pollJob]);

  const startDiscovery = async () => {
    if (photos.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setIsComplete(false);

    try {
      const enqueued = await enqueueFaceJob(sessionId);
      setJob(enqueued);
      await pollJob();
    } catch (err) {
      console.error("Discovery failed:", err);
      setError("Failed to start server processing. Please try again.");
    } finally {
      // Do not flip isProcessing off here; job runs async on the worker.
    }
  };

  const progressPercent = job ? Math.round((job.progress || 0) * 100) : 0;

  return (
    <Card variant="glass">
      <CardContent className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-400/10 flex items-center justify-center">
              <Scan className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">
                Face Discovery
              </h3>
              <p className="text-sm text-charcoal-400">
                Run server-side face extraction and clustering for {photos.length} photos
              </p>
            </div>
          </div>

          {!isProcessing && !isComplete && (
            <Button
              onClick={startDiscovery}
              disabled={photos.length === 0}
              variant="secondary"
            >
              <Server className="w-4 h-4 mr-2" />
              Start Server Processing
            </Button>
          )}
        </div>

        {/* Progress */}
        <AnimatePresence>
          {isProcessing && job && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-charcoal-400">
                  {job.message || (job.status === "queued" ? "Queued..." : "Processing...")}
                </span>
                <span className="text-white">{progressPercent}%</span>
              </div>

              <div className="h-2 bg-charcoal-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-purple-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-charcoal-400">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                {job.status === "queued" && "Waiting for worker..."}
                {job.status === "running" && "Extracting faces and clustering..."}
              </div>

              {(job.photos_total || job.photos_done || job.faces_total) && (
                <div className="text-sm text-purple-300">
                  {typeof job.photos_done === "number" && typeof job.photos_total === "number"
                    ? `${job.photos_done}/${job.photos_total} photos • `
                    : ""}
                  {typeof job.faces_total === "number" ? `${job.faces_total} faces found` : ""}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Complete */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-3">
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Discovery Complete
                </Badge>
              </div>

              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <p className="text-lg font-serif text-white mb-1">
                  {(job?.faces_total ?? 0)} faces discovered & clustered
                </p>
                <p className="text-sm text-purple-300">
                  Go to the Faces page to name and organize them
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
