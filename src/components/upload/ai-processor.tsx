"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Brain,
  CheckCircle,
  AlertTriangle,
  Play,
  Pause,
  Users,
} from "lucide-react";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import {
  loadModels,
  areModelsLoaded,
  processPhotoBatch,
  type EnrolledChild,
  type ProcessedPhoto,
  type ProcessingProgress,
} from "@/lib/face-recognition";

interface AIProcessorProps {
  photos: Array<{ id: string; url: string; thumbnailUrl?: string }>;
  enrolledChildren: EnrolledChild[];
  onComplete: (results: ProcessedPhoto[]) => void;
  onSaveMatches: (
    matches: Array<{ photoId: string; childId: string; confidence: number }>
  ) => Promise<void>;
}

export function AIProcessor({
  photos,
  enrolledChildren,
  onComplete,
  onSaveMatches,
}: AIProcessorProps) {
  const [modelsReady, setModelsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [results, setResults] = useState<ProcessedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load models on mount
  useEffect(() => {
    async function init() {
      try {
        if (!areModelsLoaded()) {
          await loadModels();
        }
        setModelsReady(true);
      } catch (err) {
        setError("Failed to load AI models. Please refresh the page.");
        console.error(err);
      }
    }
    init();
  }, []);

  const handleProgress = useCallback((p: ProcessingProgress) => {
    setProgress(p);
  }, []);

  const startProcessing = async () => {
    if (!modelsReady || photos.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setResults([]);

    try {
      const processedPhotos = await processPhotoBatch(
        photos,
        enrolledChildren,
        handleProgress
      );

      setResults(processedPhotos);

      // Collect all matches for saving
      const allMatches = processedPhotos.flatMap((photo) =>
        photo.matches.map((match) => ({
          photoId: photo.photoId,
          childId: match.childId,
          confidence: match.confidence,
        }))
      );

      // Save matches to database
      if (allMatches.length > 0) {
        await onSaveMatches(allMatches);
      }

      onComplete(processedPhotos);
    } catch (err) {
      setError("Processing failed. Please try again.");
      console.error(err);
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);
  const needsReviewCount = results.filter((r) => r.needsReview).length;
  const progressPercent = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <Card variant="glass">
      <CardContent className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500/20 to-teal-400/10 flex items-center justify-center">
              <Brain className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">
                AI Face Recognition
              </h3>
              <p className="text-sm text-charcoal-400">
                {modelsReady
                  ? `Ready to process ${photos.length} photos against ${enrolledChildren.length} enrolled children`
                  : "Loading AI models..."}
              </p>
            </div>
          </div>

          {/* Action Button */}
          {!isProcessing && results.length === 0 && (
            <Button
              onClick={startProcessing}
              disabled={!modelsReady || photos.length === 0 || enrolledChildren.length === 0}
              variant="secondary"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Process with AI
            </Button>
          )}
        </div>

        {/* Warning if no enrolled children */}
        {enrolledChildren.length === 0 && (
          <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <p className="text-sm text-amber-300">
              No children enrolled for face recognition. Go to Families to enroll
              children first.
            </p>
          </div>
        )}

        {/* Processing Progress */}
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
                  Processing photo {progress.current} of {progress.total}
                </span>
                <span className="text-white">{progressPercent}%</span>
              </div>

              <div className="h-2 bg-charcoal-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-teal-500 to-teal-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-charcoal-400">
                {progress.status === "detecting" && (
                  <>
                    <Brain className="w-4 h-4 animate-pulse text-teal-400" />
                    Detecting faces...
                  </>
                )}
                {progress.status === "matching" && (
                  <>
                    <Users className="w-4 h-4 animate-pulse text-gold-500" />
                    Matching children...
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Summary */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-4">
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Processing Complete
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-charcoal-800/50 rounded-lg text-center">
                  <p className="text-2xl font-serif text-white">
                    {results.length}
                  </p>
                  <p className="text-xs text-charcoal-400">Photos Processed</p>
                </div>
                <div className="p-3 bg-charcoal-800/50 rounded-lg text-center">
                  <p className="text-2xl font-serif text-teal-400">
                    {totalMatches}
                  </p>
                  <p className="text-xs text-charcoal-400">Faces Matched</p>
                </div>
                <div className="p-3 bg-charcoal-800/50 rounded-lg text-center">
                  <p className="text-2xl font-serif text-amber-400">
                    {needsReviewCount}
                  </p>
                  <p className="text-xs text-charcoal-400">Need Review</p>
                </div>
              </div>

              {/* Match details */}
              {totalMatches > 0 && (
                <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg">
                  <p className="text-sm text-teal-300">
                    Photos have been automatically sorted into family folders.
                    Check the Families section to view sorted photos.
                  </p>
                </div>
              )}
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
