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
import { Dropzone, UploadQueue, SessionForm } from "@/components/upload";
import { Button, Card, CardContent, Badge, Input } from "@/components/ui";
import { useUploadStore } from "@/stores";
import {
  createPhotoSession,
  uploadPhoto,
  getLocations,
  createLocation,
  getSessionPhotos,
} from "@/lib/actions/upload";
import { getEnrolledChildren, savePhotoMatches } from "@/lib/actions/faces";
import {
  processPhotoBatch,
  type ProcessingProgress,
} from "@/lib/face-recognition/processor";

export default function UploadPage() {
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiProgress, setAiProgress] = useState<ProcessingProgress | null>(null);
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
    const CONCURRENCY_LIMIT = 6; // Upload 6 files at a time

    // Upload a single file
    const uploadSingleFile = async (file: typeof pendingFiles[0]) => {
      try {
        updateFile(file.id, { status: "uploading", progress: 0 });

        const formData = new FormData();
        formData.append("file", file.file);

        // Progress simulation
        const progressInterval = setInterval(() => {
          updateFile(file.id, {
            progress: Math.min(
              (files.find((f) => f.id === file.id)?.progress || 0) + 15,
              90
            ),
          });
        }, 150);

        await uploadPhoto(sessionId, formData);

        clearInterval(progressInterval);
        updateFile(file.id, { status: "complete", progress: 100 });
      } catch (error) {
        console.error("Upload failed:", error);
        updateFile(file.id, { status: "error", error: "Upload failed" });
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

    setIsUploading(false);
    setProcessing(false);
  }, [sessionId, files, updateFile, setProcessing]);

  const startAIProcessing = useCallback(async () => {
    if (!sessionId) return;

    setIsProcessingAI(true);
    setAiProgress(null);

    try {
      // Get photos from database
      const photos = await getSessionPhotos(sessionId);
      if (photos.length === 0) {
        console.log("No photos to process");
        setIsProcessingAI(false);
        return;
      }

      // Get enrolled children
      const enrolledChildren = await getEnrolledChildren();

      // Process photos with AI
      const results = await processPhotoBatch(
        photos.map((p) => ({
          id: p.id,
          url: p.original_url,
          thumbnailUrl: p.thumbnail_url,
        })),
        enrolledChildren,
        (progress) => setAiProgress(progress)
      );

      // Save matches to database
      const matches = results.flatMap((result) =>
        result.matches.map((match) => ({
          photoId: result.photoId,
          childId: match.childId,
          confidence: match.confidence,
        }))
      );

      if (matches.length > 0) {
        await savePhotoMatches(matches);
      }

      setAiComplete(true);
    } catch (error) {
      console.error("AI processing failed:", error);
    } finally {
      setIsProcessingAI(false);
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

              <UploadQueue />
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
                    {isProcessingAI && aiProgress ? (
                      <div className="space-y-2">
                        <p className="text-sm text-charcoal-400">
                          Processing photo {aiProgress.current} of {aiProgress.total}
                          {" - "}
                          <span className="text-teal-400">
                            {aiProgress.status === "detecting"
                              ? "Detecting faces..."
                              : aiProgress.status === "matching"
                              ? "Matching children..."
                              : aiProgress.status === "complete"
                              ? "Done"
                              : "Error"}
                          </span>
                        </p>
                        <div className="w-full h-2 bg-charcoal-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500 transition-all duration-300"
                            style={{
                              width: `${(aiProgress.current / aiProgress.total) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : aiComplete ? (
                      <p className="text-sm text-green-400">
                        Photos have been sorted by child. Families can now view
                        their photos in the gallery!
                      </p>
                    ) : (
                      <p className="text-sm text-charcoal-400">
                        Click &quot;Process with AI&quot; to automatically sort photos
                        by child using face recognition.
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
                        Process with AI
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
