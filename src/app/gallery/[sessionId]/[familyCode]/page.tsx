"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  ShoppingCart,
  Grid,
  List,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useGalleryStore } from "@/stores";
import { useCartStore } from "@/stores";
import { Button, Badge, Card, CardContent } from "@/components/ui";
import { cn, formatPrice } from "@/lib/utils";
import { PRODUCTS } from "@/config/pricing";
import {
  getFamilyByAccessCode,
  getSession,
  getPhotosForFamily,
  getAllPhotosInSession,
  type Photo,
  type Family,
  type Session,
} from "@/lib/actions/gallery";

export default function GalleryPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const familyCode = params.familyCode as string;

  const {
    photos,
    setPhotos,
    toggleLike,
    filter,
    setFilter,
    viewMode,
    setViewMode,
    isLightboxOpen,
    openLightbox,
    closeLightbox,
    selectedPhotoId,
    nextPhoto,
    prevPhoto,
    getFilteredPhotos,
    getLikedCount,
    getSelectedPhoto,
  } = useGalleryStore();

  const { addItem, getItemCount, getTotal, setContext } = useCartStore();

  const [showPricing, setShowPricing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  // Fetch gallery data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch family by access code
        const familyData = await getFamilyByAccessCode(familyCode);
        if (!familyData) {
          setError("Invalid access code. Please check your link.");
          setLoading(false);
          return;
        }
        setFamily(familyData);

        // Fetch session
        const sessionData = await getSession(sessionId);
        if (!sessionData) {
          setError("Photo session not found.");
          setLoading(false);
          return;
        }
        setSession(sessionData);

        // Set cart context
        setContext(familyData.id, sessionId);

        // Fetch photos for this family
        let photosData = await getPhotosForFamily(sessionId, familyData.id);

        // If no matched photos, fall back to all session photos
        if (photosData.length === 0) {
          photosData = await getAllPhotosInSession(sessionId);
        }

        setPhotos(photosData);
      } catch (err) {
        console.error("Error loading gallery:", err);
        setError("Failed to load gallery. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    if (sessionId && familyCode) {
      fetchData();
    }
  }, [sessionId, familyCode, setPhotos, setContext]);

  const filteredPhotos = getFilteredPhotos();
  const selectedPhoto = getSelectedPhoto();
  const likedCount = getLikedCount();
  const cartCount = getItemCount();
  const cartTotal = getTotal();

  const handleAddToCart = () => {
    if (!selectedPhoto || !selectedProduct) return;

    const product = PRODUCTS.find((p) => p.id === selectedProduct);
    if (!product) return;

    addItem({
      photoId: selectedPhoto.id,
      photoUrl: selectedPhoto.url,
      thumbnailUrl: selectedPhoto.thumbnailUrl,
      productId: product.id,
      productName: product.name,
      productType: product.type,
      price: product.price,
    });

    setShowPricing(false);
    setSelectedProduct(null);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLightboxOpen) return;

      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextPhoto();
      if (e.key === "ArrowLeft") prevPhoto();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, closeLightbox, nextPhoto, prevPhoto]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-gold-500 animate-spin mx-auto" />
          <p className="mt-4 text-charcoal-400">Loading your photos...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center py-12">
            <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-serif text-white mb-2">
              Unable to Load Gallery
            </h1>
            <p className="text-charcoal-400 mb-6">{error}</p>
            <Link href="/">
              <Button variant="primary">Return Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No photos state
  if (photos.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center py-12">
            <ShoppingCart className="w-12 h-12 text-charcoal-500 mx-auto mb-4" />
            <h1 className="text-xl font-serif text-white mb-2">
              No Photos Available
            </h1>
            <p className="text-charcoal-400 mb-6">
              Photos for this session haven&apos;t been uploaded yet. Please check
              back later!
            </p>
            <Link href="/">
              <Button variant="primary">Return Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const familyName = family?.family_name || "Your";
  const sessionName = session?.name || "Photo Session";
  const locationName = session?.location?.name || "TeddyKids";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-charcoal-900/80 backdrop-blur-xl border-b border-charcoal-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="/logo.webp"
                alt="TeddySnaps"
                width={48}
                height={48}
                className="rounded-lg"
              />
              <div>
                <h1 className="text-2xl font-serif text-white">
                  {familyName} Family Photos
                </h1>
                <p className="text-sm text-charcoal-400">
                  {sessionName} at {locationName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* View mode toggle */}
              <div className="flex items-center gap-1 bg-charcoal-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    viewMode === "grid"
                      ? "bg-charcoal-700 text-white"
                      : "text-charcoal-400 hover:text-white"
                  )}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    viewMode === "list"
                      ? "bg-charcoal-700 text-white"
                      : "text-charcoal-400 hover:text-white"
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Filter toggle */}
              <div className="flex items-center gap-1 bg-charcoal-800 rounded-lg p-1">
                <button
                  onClick={() => setFilter("all")}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm transition-colors",
                    filter === "all"
                      ? "bg-charcoal-700 text-white"
                      : "text-charcoal-400 hover:text-white"
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter("liked")}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-1",
                    filter === "liked"
                      ? "bg-charcoal-700 text-white"
                      : "text-charcoal-400 hover:text-white"
                  )}
                >
                  <Heart className="w-4 h-4" />
                  {likedCount}
                </button>
              </div>

              {/* Cart */}
              <Link href="/checkout">
                <Button variant="primary" className="relative">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {formatPrice(cartTotal)}
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-teal-500 text-white text-xs rounded-full flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Photo Grid */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div
          className={cn(
            "grid gap-4",
            viewMode === "grid"
              ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              : "grid-cols-1 max-w-2xl mx-auto"
          )}
        >
          {filteredPhotos.map((photo, index) => (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.02 }}
              className="relative group"
            >
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl cursor-pointer",
                  viewMode === "grid" ? "aspect-[4/3]" : "aspect-video"
                )}
                onClick={() => openLightbox(photo.id)}
              >
                <img
                  src={photo.thumbnailUrl}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ZoomIn className="w-8 h-8 text-white" />
                </div>

                {/* Like button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(photo.id);
                  }}
                  className={cn(
                    "absolute top-3 right-3 p-2 rounded-full transition-all",
                    photo.isLiked
                      ? "bg-red-500 text-white"
                      : "bg-black/50 text-white hover:bg-black/70"
                  )}
                >
                  <Heart
                    className={cn("w-5 h-5", photo.isLiked && "fill-current")}
                  />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredPhotos.length === 0 && (
          <div className="text-center py-16">
            <Heart className="w-12 h-12 text-charcoal-600 mx-auto mb-4" />
            <p className="text-charcoal-400">
              No liked photos yet. Tap the heart to save your favorites!
            </p>
          </div>
        )}
      </main>

      {/* Lightbox */}
      <AnimatePresence>
        {isLightboxOpen && selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          >
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Navigation arrows */}
            <button
              onClick={prevPhoto}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-10 h-10" />
            </button>
            <button
              onClick={nextPhoto}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white transition-colors"
            >
              <ChevronRight className="w-10 h-10" />
            </button>

            {/* Image */}
            <motion.div
              key={selectedPhoto.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-4xl max-h-[80vh] mx-auto px-16"
            >
              <img
                src={selectedPhoto.url}
                alt=""
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />

              {/* Actions */}
              <div className="flex items-center justify-center gap-4 mt-6">
                <Button
                  variant={selectedPhoto.isLiked ? "primary" : "outline"}
                  onClick={() => toggleLike(selectedPhoto.id)}
                >
                  <Heart
                    className={cn(
                      "w-5 h-5 mr-2",
                      selectedPhoto.isLiked && "fill-current"
                    )}
                  />
                  {selectedPhoto.isLiked ? "Liked" : "Like"}
                </Button>

                <Button variant="primary" onClick={() => setShowPricing(true)}>
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Add to Cart
                </Button>
              </div>
            </motion.div>

            {/* Pricing Panel */}
            <AnimatePresence>
              {showPricing && (
                <motion.div
                  initial={{ opacity: 0, x: 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 100 }}
                  className="absolute right-0 top-0 h-full w-80 bg-charcoal-900 border-l border-charcoal-800 p-6 overflow-y-auto"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-serif text-white">
                      Choose Format
                    </h3>
                    <button
                      onClick={() => setShowPricing(false)}
                      className="text-charcoal-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {PRODUCTS.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => setSelectedProduct(product.id)}
                        className={cn(
                          "w-full p-4 rounded-lg border text-left transition-all",
                          selectedProduct === product.id
                            ? "border-gold-500 bg-gold-500/10"
                            : "border-charcoal-700 hover:border-charcoal-600"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">
                              {product.name}
                            </p>
                            <p className="text-sm text-charcoal-400">
                              {product.description}
                            </p>
                          </div>
                          <p className="text-gold-500 font-medium">
                            {formatPrice(product.price)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full mt-6"
                    disabled={!selectedProduct}
                    onClick={handleAddToCart}
                  >
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    Add to Selection
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Selection Bar */}
      {(likedCount > 0 || cartCount > 0) && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 bg-charcoal-900/95 backdrop-blur-xl border-t border-charcoal-800 p-4"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className="w-5 h-5 text-red-500 fill-current" />
              <span className="text-white">
                {likedCount} photo{likedCount !== 1 ? "s" : ""} liked
              </span>
              {cartCount > 0 && (
                <Badge variant="gold">{cartCount} in cart</Badge>
              )}
            </div>

            <div className="flex items-center gap-4">
              <p className="text-charcoal-400">
                Total:{" "}
                <span className="text-gold-500 font-medium">
                  {formatPrice(cartTotal)}
                </span>
              </p>
              <Link href="/checkout">
                <Button variant="primary">
                  Checkout
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
