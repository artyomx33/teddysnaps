import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  kind?: "photo" | "bundle";
  photoId: string | null;
  photoUrl: string;
  thumbnailUrl: string;
  productId: string;
  productName: string;
  productType: "digital" | "print" | "canvas" | "book";
  price: number;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  familyId: string | null;
  sessionId: string | null;

  // Actions
  addItem: (item: Omit<CartItem, "quantity">) => void;
  addItems: (items: Array<Omit<CartItem, "quantity">>) => void;
  removeItem: (photoId: string | null, productId: string) => void;
  updateQuantity: (photoId: string | null, productId: string, quantity: number) => void;
  clearCart: () => void;
  setContext: (familyId: string, sessionId: string) => void;

  // Computed helpers
  getSubtotal: () => number;
  getItemCount: () => number;
  getDiscount: () => number;
  getTotal: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      familyId: null,
      sessionId: null,

      addItem: (item) =>
        set((state) => {
          // Bundle purchase replaces the cart.
          if (item.photoId === null || item.kind === "bundle") {
            return { items: [{ ...item, kind: "bundle", quantity: 1 }] };
          }

          // If a bundle is in cart and user adds single photos, remove the bundle.
          const withoutBundle = state.items.filter((i) => i.photoId !== null && i.kind !== "bundle");

          const existing = state.items.find(
            (i) => i.photoId === item.photoId && i.productId === item.productId
          );
          if (existing) {
            return {
              items: withoutBundle.map((i) =>
                i.photoId === item.photoId && i.productId === item.productId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            };
          }
          return { items: [...withoutBundle, { ...item, kind: "photo", quantity: 1 }] };
        }),

      addItems: (items) =>
        set((state) => {
          if (items.length === 0) return { items: state.items };

          // Bundle wins and replaces cart.
          const bundle = items.find((i) => i.photoId === null || i.kind === "bundle");
          if (bundle) return { items: [{ ...bundle, kind: "bundle", quantity: 1 }] };

          // If a bundle is in cart and user adds single photos, remove the bundle.
          let next = state.items.filter((i) => i.photoId !== null && i.kind !== "bundle");

          for (const item of items) {
            const existingIndex = next.findIndex(
              (i) => i.photoId === item.photoId && i.productId === item.productId
            );
            if (existingIndex >= 0) {
              next = next.map((i, idx) =>
                idx === existingIndex ? { ...i, quantity: i.quantity + 1 } : i
              );
            } else {
              next = [...next, { ...item, kind: "photo", quantity: 1 }];
            }
          }

          return { items: next };
        }),

      removeItem: (photoId, productId) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.photoId === photoId && i.productId === productId)
          ),
        })),

      updateQuantity: (photoId, productId, quantity) =>
        set((state) => ({
          items:
            quantity > 0
              ? state.items.map((i) =>
                  i.photoId === photoId && i.productId === productId
                    ? { ...i, quantity }
                    : i
                )
              : state.items.filter(
                  (i) => !(i.photoId === photoId && i.productId === productId)
                ),
        })),

      clearCart: () => set({ items: [], familyId: null, sessionId: null }),

      setContext: (familyId, sessionId) => set({ familyId, sessionId }),

      getSubtotal: () =>
        get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),

      getItemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),

      getDiscount: () => {
        return 0;
      },

      getTotal: () => get().getSubtotal() - get().getDiscount(),
    }),
    {
      name: "teddysnaps-cart",
    }
  )
);
