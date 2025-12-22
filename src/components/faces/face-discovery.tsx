"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Scan,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Save,
} from "lucide-react";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import {
  discoverFacesInBatch,
  clusterFaces,
  type DiscoveryProgress,
  type DiscoveredFaceData,
} from "@/lib/face-recognition";
import { uploadFaceCrop } from "@/lib/actions/upload";
import { saveDiscoveredFaces, updateFaceClusters } from "@/lib/actions/faces";

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
  const [progress, setProgress] = useState<DiscoveryProgress | null>(null);
  const [totalFacesFound, setTotalFacesFound] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [phase, setPhase] = useState<"detecting" | "clustering" | "done">("detecting");

  const handleProgress = useCallback((p: DiscoveryProgress) => {
    setProgress(p);
    setTotalFacesFound(p.totalFacesSoFar);
  }, []);

  // Handle batch completion (incremental saving)
  const handleBatchComplete = useCallback(async (batchFaces: DiscoveredFaceData[]) => {
    // Upload face crops
    const facesToSave: Array<{
      photoId: string;
      descriptor: number[];
      cropUrl: string;
      bbox: { x: number; y: number; width: number; height: number };
      detectionScore: number;
    }> = [];

    for (const face of batchFaces) {
      const faceId = crypto.randomUUID();
      const cropUrl = await uploadFaceCrop(sessionId, faceId, face.cropBlob);

      facesToSave.push({
        photoId: face.photoId,
        descriptor: face.descriptor,
        cropUrl,
        bbox: face.bbox,
        detectionScore: face.detectionScore,
      });
    }

    // Save to database incrementally
    await saveDiscoveredFaces(sessionId, facesToSave);
  }, [sessionId]);

  const startDiscovery = async () => {
    if (photos.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setTotalFacesFound(0);
    setIsComplete(false);
    setPhase("detecting");

    try {
      // Phase 1: Discover all faces with incremental saving
      const discoveredFaces = await discoverFacesInBatch(
        photos,
        handleProgress,
        handleBatchComplete
      );

      // Phase 2: Cluster similar faces
      setPhase("clustering");

      // Get saved face IDs from database
      const { data: savedFaces } = await fetch(`/api/faces?session=${sessionId}`).then(r => r.json());

      if (savedFaces && savedFaces.length > 0) {
        const clusterableItems = savedFaces.map((f: any) => ({
          id: f.id,
          descriptor: f.face_descriptor,
        }));

        const clusters = clusterFaces(clusterableItems);

        // Update cluster assignments
        const assignments = clusters.flatMap((cluster) =>
          cluster.items.map((faceId) => ({
            faceId,
            clusterId: cluster.id,
          }))
        );

        await updateFaceClusters(assignments);
      }

      setPhase("done");
      setIsComplete(true);
      onComplete(discoveredFaces.length);
    } catch (err) {
      console.error("Discovery failed:", err);
      setError("Face discovery failed. Please try again.");
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const progressPercent = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

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
                Detect and extract all faces from {photos.length} photos
              </p>
            </div>
          </div>

          {!isProcessing && !isComplete && (
            <Button
              onClick={startDiscovery}
              disabled={photos.length === 0}
              variant="secondary"
            >
              <Brain className="w-4 h-4 mr-2" />
              Start Discovery
            </Button>
          )}
        </div>

        {/* Progress */}
        <AnimatePresence>
          {isProcessing && progress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-charcoal-400">
                  {phase === "detecting"
                    ? `Processing photo ${progress.current} of ${progress.total}`
                    : "Clustering similar faces..."}
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
                {progress.status === "loading" && "Loading image..."}
                {progress.status === "detecting" && "Detecting faces..."}
                {progress.status === "cropping" && `Found ${progress.facesFound} face(s), extracting...`}
                {progress.status === "saving" && (
                  <>
                    <Save className="w-4 h-4 text-teal-400" />
                    Saving batch...
                  </>
                )}
              </div>

              <div className="text-sm text-purple-300">
                {totalFacesFound} faces discovered (saved incrementally)
              </div>
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
                  {totalFacesFound} faces discovered & clustered
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
