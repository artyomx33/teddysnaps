import { create } from "zustand";

export interface Photo {
  id: string;
  url: string;
  thumbnailUrl: string;
  isLiked: boolean;
  width?: number;
  height?: number;
}

interface GalleryStore {
  photos: Photo[];
  selectedPhotoId: string | null;
  viewMode: "grid" | "list";
  filter: "all" | "liked";
  isLightboxOpen: boolean;

  // Actions
  setPhotos: (photos: Photo[]) => void;
  toggleLike: (photoId: string) => void;
  selectPhoto: (photoId: string | null) => void;
  setViewMode: (mode: "grid" | "list") => void;
  setFilter: (filter: "all" | "liked") => void;
  openLightbox: (photoId: string) => void;
  closeLightbox: () => void;
  nextPhoto: () => void;
  prevPhoto: () => void;

  // Computed helpers
  getFilteredPhotos: () => Photo[];
  getLikedCount: () => number;
  getSelectedPhoto: () => Photo | undefined;
}

export const useGalleryStore = create<GalleryStore>((set, get) => ({
  photos: [],
  selectedPhotoId: null,
  viewMode: "grid",
  filter: "all",
  isLightboxOpen: false,

  setPhotos: (photos) => set({ photos }),

  toggleLike: (photoId) =>
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === photoId ? { ...p, isLiked: !p.isLiked } : p
      ),
    })),

  selectPhoto: (photoId) => set({ selectedPhotoId: photoId }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setFilter: (filter) => set({ filter }),

  openLightbox: (photoId) =>
    set({ selectedPhotoId: photoId, isLightboxOpen: true }),

  closeLightbox: () => set({ isLightboxOpen: false }),

  nextPhoto: () => {
    const { photos, selectedPhotoId, filter } = get();
    const filteredPhotos =
      filter === "liked" ? photos.filter((p) => p.isLiked) : photos;
    const currentIndex = filteredPhotos.findIndex(
      (p) => p.id === selectedPhotoId
    );
    if (currentIndex < filteredPhotos.length - 1) {
      set({ selectedPhotoId: filteredPhotos[currentIndex + 1].id });
    }
  },

  prevPhoto: () => {
    const { photos, selectedPhotoId, filter } = get();
    const filteredPhotos =
      filter === "liked" ? photos.filter((p) => p.isLiked) : photos;
    const currentIndex = filteredPhotos.findIndex(
      (p) => p.id === selectedPhotoId
    );
    if (currentIndex > 0) {
      set({ selectedPhotoId: filteredPhotos[currentIndex - 1].id });
    }
  },

  getFilteredPhotos: () => {
    const { photos, filter } = get();
    return filter === "liked" ? photos.filter((p) => p.isLiked) : photos;
  },

  getLikedCount: () => get().photos.filter((p) => p.isLiked).length,

  getSelectedPhoto: () => {
    const { photos, selectedPhotoId } = get();
    return photos.find((p) => p.id === selectedPhotoId);
  },
}));
