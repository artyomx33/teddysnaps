"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, Image, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUploadStore } from "@/stores";

interface DropzoneProps {
  onFilesAdded?: (files: File[]) => void;
  maxFiles?: number;
  accept?: string;
}

export function Dropzone({
  onFilesAdded,
  maxFiles = 500,
  accept = "image/*",
}: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { addFiles, files } = useUploadStore();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/")
      );

      if (droppedFiles.length > 0) {
        const filesToAdd = droppedFiles.slice(0, maxFiles - files.length);
        addFiles(filesToAdd);
        onFilesAdded?.(filesToAdd);
      }
    },
    [addFiles, files.length, maxFiles, onFilesAdded]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files
        ? Array.from(e.target.files).filter((file) =>
            file.type.startsWith("image/")
          )
        : [];

      if (selectedFiles.length > 0) {
        const filesToAdd = selectedFiles.slice(0, maxFiles - files.length);
        addFiles(filesToAdd);
        onFilesAdded?.(filesToAdd);
      }

      // Reset input
      e.target.value = "";
    },
    [addFiles, files.length, maxFiles, onFilesAdded]
  );

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={cn(
        "relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 cursor-pointer",
        isDragging
          ? "border-gold-500 bg-gold-500/10"
          : "border-charcoal-700 hover:border-charcoal-600 bg-charcoal-900/50"
      )}
    >
      <input
        type="file"
        accept={accept}
        multiple
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />

      <div className="text-center">
        <motion.div
          animate={{
            scale: isDragging ? 1.1 : 1,
            rotate: isDragging ? 5 : 0,
          }}
          className="inline-flex"
        >
          <div
            className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors",
              isDragging ? "bg-gold-500/20" : "bg-charcoal-800"
            )}
          >
            <Upload
              className={cn(
                "w-8 h-8 transition-colors",
                isDragging ? "text-gold-500" : "text-charcoal-400"
              )}
            />
          </div>
        </motion.div>

        <h3 className="text-xl font-medium text-white mb-2">
          {isDragging ? "Drop photos here!" : "Drag & drop photos"}
        </h3>
        <p className="text-charcoal-400 mb-4">
          or click to browse your files
        </p>
        <p className="text-sm text-charcoal-500">
          Supports JPG, PNG, HEIC • Up to {maxFiles} photos
        </p>
      </div>

      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gold-500/5 rounded-2xl pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
