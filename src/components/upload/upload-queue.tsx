"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Loader2, Image, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUploadStore, type UploadFile } from "@/stores";
import { Badge, Button } from "@/components/ui";

interface UploadQueueProps {
  onRetryFailed?: () => void;
  onRetryFile?: (fileId: string) => void;
}

export function UploadQueue({ onRetryFailed, onRetryFile }: UploadQueueProps) {
  const { files, removeFile, updateFile, getProgress, getCompleteCount, getNeedsReviewCount } = useUploadStore();

  if (files.length === 0) return null;

  const progress = getProgress();
  const completeCount = getCompleteCount();
  const needsReviewCount = getNeedsReviewCount();
  const failedCount = files.filter((f) => f.status === "error").length;

  const retryAllFailed = () => {
    // If a retry handler is passed, let the page manage it.
    if (onRetryFailed) return onRetryFailed();

    // Fallback: just reset to pending; user can press Start Upload again.
    files
      .filter((f) => f.status === "error")
      .forEach((f) => updateFile(f.id, { status: "pending", progress: 0, error: undefined }));
  };

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-medium text-white">
            {completeCount} / {files.length} uploaded
          </h3>
          {needsReviewCount > 0 && (
            <Badge variant="warning">{needsReviewCount} need review</Badge>
          )}
          {failedCount > 0 && (
            <Badge variant="warning">{failedCount} failed</Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {failedCount > 0 && (
            <Button variant="outline" size="sm" onClick={retryAllFailed}>
              <RotateCw className="w-4 h-4 mr-2" />
              Retry failed ({failedCount})
            </Button>
          )}
          <span className="text-sm text-charcoal-400">{progress}%</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-charcoal-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-gold-500 to-gold-400"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* File Grid */}
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-[400px] overflow-y-auto p-1">
        <AnimatePresence mode="popLayout">
          {files.map((file) => (
            <UploadFileCard
              key={file.id}
              file={file}
              onRemove={removeFile}
              onRetry={onRetryFile}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface UploadFileCardProps {
  file: UploadFile;
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
}

function UploadFileCard({ file, onRemove, onRetry }: UploadFileCardProps) {
  const { updateFile } = useUploadStore();
  const statusIcons = {
    pending: <Image className="w-4 h-4 text-charcoal-400" />,
    uploading: <Loader2 className="w-4 h-4 text-gold-500 animate-spin" />,
    processing: <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />,
    complete: <CheckCircle className="w-4 h-4 text-green-500" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />,
  };

  const handleRetry = () => {
    if (onRetry) return onRetry(file.id);
    updateFile(file.id, { status: "pending", progress: 0, error: undefined });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="relative group"
    >
      <div
        className={cn(
          "aspect-square rounded-lg overflow-hidden border-2 transition-colors",
          file.status === "error"
            ? "border-red-500/50"
            : file.needsReview
            ? "border-amber-500/50"
            : file.status === "complete"
            ? "border-green-500/50"
            : "border-charcoal-700"
        )}
      >
        {/* Thumbnail */}
        <img
          src={file.preview}
          alt=""
          className="w-full h-full object-cover"
        />

        {/* Status overlay */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity",
            file.status === "complete" && !file.needsReview
              ? "bg-black/20"
              : file.status === "error"
              ? "bg-red-500/20"
              : file.status === "uploading" || file.status === "processing"
              ? "bg-black/40"
              : "bg-transparent"
          )}
        >
          {file.status !== "pending" && statusIcons[file.status]}
        </div>

        {/* Progress ring for uploading */}
        {file.status === "uploading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-10 h-10 transform -rotate-90">
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="3"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="#C9A962"
                strokeWidth="3"
                strokeDasharray={100}
                strokeDashoffset={100 - file.progress}
                className="transition-all duration-300"
              />
            </svg>
          </div>
        )}

        {/* Remove button */}
        <button
          onClick={() => onRemove(file.id)}
          className="absolute top-1 right-1 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
        >
          <X className="w-3 h-3 text-white" />
        </button>

        {/* Retry button (for failed uploads) */}
        {file.status === "error" && (
          <button
            onClick={handleRetry}
            className="absolute top-1 left-1 p-1 bg-black/60 rounded-full opacity-100 hover:bg-black/80"
            title="Retry upload"
          >
            <RotateCw className="w-3 h-3 text-white" />
          </button>
        )}

        {/* Match count badge */}
        {file.matches.length > 0 && (
          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-teal-500/90 rounded text-xs text-white font-medium">
            {file.matches.length} match{file.matches.length > 1 ? "es" : ""}
          </div>
        )}
      </div>
    </motion.div>
  );
}
