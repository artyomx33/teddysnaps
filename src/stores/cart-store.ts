import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  photoId: string;
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
  removeItem: (photoId: string, productId: string) => void;
  updateQuantity: (photoId: string, productId: string, quantity: number) => void;
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
          const existing = state.items.find(
            (i) => i.photoId === item.photoId && i.productId === item.productId
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.photoId === item.photoId && i.productId === item.productId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: 1 }] };
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
        const count = get().getItemCount();
        const subtotal = get().getSubtotal();
        // 15% off for 5+ items
        if (count >= 5) return subtotal * 0.15;
        return 0;
      },

      getTotal: () => get().getSubtotal() - get().getDiscount(),
    }),
    {
      name: "teddysnaps-cart",
    }
  )
);
