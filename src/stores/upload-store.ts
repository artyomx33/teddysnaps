import { create } from "zustand";

export interface UploadFile {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "uploading" | "processing" | "complete" | "error";
  progress: number;
  matches: Array<{
    childId: string;
    childName: string;
    confidence: number;
  }>;
  needsReview: boolean;
  error?: string;
}

interface UploadStore {
  files: UploadFile[];
  isProcessing: boolean;
  sessionName: string;
  locationId: string | null;

  // Actions
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  updateFile: (id: string, updates: Partial<UploadFile>) => void;
  setSessionName: (name: string) => void;
  setLocationId: (locationId: string) => void;
  setProcessing: (isProcessing: boolean) => void;
  clearAll: () => void;

  // Computed helpers
  getPendingCount: () => number;
  getCompleteCount: () => number;
  getNeedsReviewCount: () => number;
  getProgress: () => number;
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  files: [],
  isProcessing: false,
  sessionName: "",
  locationId: null,

  addFiles: (newFiles) =>
    set((state) => ({
      files: [
        ...state.files,
        ...newFiles.map((file) => ({
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
          status: "pending" as const,
          progress: 0,
          matches: [],
          needsReview: false,
        })),
      ],
    })),

  removeFile: (id) =>
    set((state) => {
      const file = state.files.find((f) => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return {
        files: state.files.filter((f) => f.id !== id),
      };
    }),

  updateFile: (id, updates) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })),

  setSessionName: (name) => set({ sessionName: name }),

  setLocationId: (locationId) => set({ locationId }),

  setProcessing: (isProcessing) => set({ isProcessing }),

  clearAll: () => {
    const { files } = get();
    files.forEach((file) => URL.revokeObjectURL(file.preview));
    set({ files: [], sessionName: "", locationId: null, isProcessing: false });
  },

  getPendingCount: () =>
    get().files.filter((f) => f.status === "pending").length,

  getCompleteCount: () =>
    get().files.filter((f) => f.status === "complete").length,

  getNeedsReviewCount: () => get().files.filter((f) => f.needsReview).length,

  getProgress: () => {
    const { files } = get();
    if (files.length === 0) return 0;
    const completed = files.filter((f) => f.status === "complete").length;
    return Math.round((completed / files.length) * 100);
  },
}));
