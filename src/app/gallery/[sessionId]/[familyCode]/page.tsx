"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  ShoppingCart,
  Grid,
  List,
  X,
  ChevronRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useGalleryStore } from "@/stores";
import { useCartStore } from "@/stores";
import { Button, Badge, Card, CardContent } from "@/components/ui";
import { cn, formatPrice } from "@/lib/utils";
import {
  getFamilyByAccessCode,
  getSession,
  getPricedProducts,
  getPhotosForFamily,
  type Photo,
  type Family,
  type Session,
} from "@/lib/actions/gallery";
import { imagePresets } from "@/lib/image-transform";

type DbProduct = {
  id: string;
  name: string;
  type: "digital" | "print" | "canvas" | "book";
  price: number;
  description: string | null;
};

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
    getFilteredPhotos,
    getLikedCount,
  } = useGalleryStore();

  const { addItem, getItemCount, getTotal, setContext } = useCartStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [perPhotoProduct, setPerPhotoProduct] = useState<DbProduct | null>(null);
  const [bundleProduct, setBundleProduct] = useState<DbProduct | null>(null);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

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

        // Fetch confirmed photos for this family (no fallback to all photos)
        const photosData = await getPhotosForFamily(sessionId, familyData.id);

        setPhotos(photosData);

        // Fetch products server-side (service role) so parent pricing always loads.
        const all = (await getPricedProducts()) as unknown as DbProduct[];
        const digital = all.filter((p) => p.type === "digital" && p.price > 0);
        const priced = (digital.length > 0 ? digital : all).filter((p) => p.price > 0);

        if (priced.length > 0) {
          const sorted = [...priced].sort((a, b) => a.price - b.price);
          setPerPhotoProduct(sorted[0]);
          // Bundle = highest priced item (works for 10 + 50 model).
          const maybeBundle = sorted[sorted.length - 1];
          setBundleProduct(maybeBundle && maybeBundle.id !== sorted[0].id ? maybeBundle : null);
        } else {
          setPerPhotoProduct(null);
          setBundleProduct(null);
        }
        setProductsLoaded(true);
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
  const likedCount = getLikedCount();
  const cartCount = getItemCount();
  const cartTotal = getTotal();
  const [confirmPhoto, setConfirmPhoto] = useState<Photo | null>(null);

  const ensureProducts = async (): Promise<{ per: DbProduct | null; bundle: DbProduct | null }> => {
    if (perPhotoProduct) return { per: perPhotoProduct, bundle: bundleProduct };
    if (isLoadingProducts) return { per: null, bundle: null };

    setIsLoadingProducts(true);
    try {
      const all = (await getPricedProducts()) as unknown as DbProduct[];
      const digital = all.filter((p) => p.type === "digital" && p.price > 0);
      const priced = (digital.length > 0 ? digital : all).filter((p) => p.price > 0);
      if (priced.length === 0) return { per: null, bundle: null };

      const sorted = [...priced].sort((a, b) => a.price - b.price);
      const per = sorted[0];
      const bundle = sorted.length > 1 ? sorted[sorted.length - 1] : null;
      setPerPhotoProduct(per);
      setBundleProduct(bundle);
      setProductsLoaded(true);
      return { per, bundle };
    } catch (e) {
      console.error("Failed to load products:", e);
      return { per: null, bundle: null };
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const addDefaultToCart = async (photo: Photo) => {
    const per = perPhotoProduct ?? (await ensureProducts()).per;
    if (!per) return;
    addItem({
      kind: "photo",
      photoId: photo.id,
      photoUrl: photo.url,
      thumbnailUrl: photo.thumbnailUrl,
      productId: per.id,
      productName: per.name,
      productType: per.type,
      price: per.price,
    });
  };

  const buyFullAlbum = () => {
    if (!bundleProduct) return;
    addItem({
      kind: "bundle",
      photoId: null,
      photoUrl: "",
      thumbnailUrl: "",
      productId: bundleProduct.id,
      productName: bundleProduct.name,
      productType: bundleProduct.type,
      price: bundleProduct.price,
    });
  };

  // NOTE: Parent gallery intentionally has no full-size lightbox (avoid "download" UX).

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
              Photos are being prepared
            </h1>
            <p className="text-charcoal-400 mb-6">
              We&apos;re currently sorting and confirming photos for your family.
              Please check back a bit later.
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
                role="button"
                tabIndex={0}
                className={cn(
                  "relative overflow-hidden rounded-xl cursor-pointer block w-full text-left outline-none focus:ring-2 focus:ring-gold-500/50",
                  viewMode === "grid" ? "aspect-[4/3]" : "aspect-video"
                )}
                onClick={() => setConfirmPhoto(photo)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setConfirmPhoto(photo);
                  }
                }}
                aria-label="Add photo to cart"
              >
                <img
                  src={imagePresets.thumbnail(photo.thumbnailUrl)}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {/* Added feedback */}
                {justAddedId === photo.id && (
                  <div className="pointer-events-none absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="px-4 py-2 rounded-full bg-gold-500 text-charcoal-950 font-medium">
                      Added
                    </div>
                  </div>
                )}

                {/* Loading feedback (first tap may need to fetch products) */}
                {isLoadingProducts && !perPhotoProduct && (
                  <div className="pointer-events-none absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="px-4 py-2 rounded-full bg-charcoal-900/90 text-white text-sm border border-charcoal-700">
                      Loading price…
                    </div>
                  </div>
                )}

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

                {/* Label */}
                {productsLoaded && perPhotoProduct && (
                  <div className="pointer-events-none absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/55 text-white text-sm">
                    Tap to add {formatPrice(perPhotoProduct.price)}
                  </div>
                )}
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

      {/* Confirm modal (single item) */}
      <AnimatePresence>
        {confirmPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center p-4"
            onClick={() => setConfirmPhoto(null)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="w-full max-w-md bg-charcoal-900 border border-charcoal-800 rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 flex items-center justify-between">
                <p className="text-white font-medium">Add to cart</p>
                <button
                  className="text-charcoal-400 hover:text-white"
                  onClick={() => setConfirmPhoto(null)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-4 pb-4">
                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-charcoal-800">
                  <img
                    src={imagePresets.thumbnail(confirmPhoto.thumbnailUrl)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-sm text-charcoal-400">
                    {perPhotoProduct ? perPhotoProduct.name : "Loading pricing..."}
                  </div>
                  <Button
                    variant="primary"
                    disabled={!perPhotoProduct}
                    onClick={async () => {
                      await addDefaultToCart(confirmPhoto);
                      setConfirmPhoto(null);
                    }}
                  >
                    Add {perPhotoProduct ? formatPrice(perPhotoProduct.price) : ""}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Selection Bar */}
      {(likedCount > 0 || cartCount > 0 || !!bundleProduct) && (
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
              {bundleProduct && (
                <Button variant="outline" size="sm" onClick={buyFullAlbum}>
                  Buy full album {formatPrice(bundleProduct.price)}
                </Button>
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
