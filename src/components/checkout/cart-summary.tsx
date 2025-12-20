"use client";

import { motion } from "framer-motion";
import { Trash2, Plus, Minus } from "lucide-react";
import { useCartStore } from "@/stores";
import { Card, CardContent, Badge } from "@/components/ui";
import { formatPrice } from "@/lib/utils";

export function CartSummary() {
  const {
    items,
    removeItem,
    updateQuantity,
    getSubtotal,
    getDiscount,
    getTotal,
    getItemCount,
  } = useCartStore();

  const subtotal = getSubtotal();
  const discount = getDiscount();
  const total = getTotal();
  const itemCount = getItemCount();

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-charcoal-400">Your cart is empty</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <h3 className="text-lg font-medium text-white">Your Selection</h3>

        {/* Cart Items */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {items.map((item, index) => (
            <motion.div
              key={`${item.photoId}-${item.productId}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-3 p-3 bg-charcoal-800/50 rounded-lg"
            >
              {/* Thumbnail */}
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={item.thumbnailUrl || item.photoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">
                  {item.productName}
                </p>
                <p className="text-sm text-charcoal-400">
                  {formatPrice(item.price)} each
                </p>
              </div>

              {/* Quantity controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    updateQuantity(
                      item.photoId,
                      item.productId,
                      item.quantity - 1
                    )
                  }
                  className="p-1 text-charcoal-400 hover:text-white transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center text-white">
                  {item.quantity}
                </span>
                <button
                  onClick={() =>
                    updateQuantity(
                      item.photoId,
                      item.productId,
                      item.quantity + 1
                    )
                  }
                  className="p-1 text-charcoal-400 hover:text-white transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Item total */}
              <p className="w-20 text-right text-white font-medium">
                {formatPrice(item.price * item.quantity)}
              </p>

              {/* Remove */}
              <button
                onClick={() => removeItem(item.photoId, item.productId)}
                className="p-1 text-charcoal-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-charcoal-700 pt-4 space-y-2">
          <div className="flex justify-between text-charcoal-400">
            <span>Subtotal ({itemCount} items)</span>
            <span>{formatPrice(subtotal)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-green-400">
              <span className="flex items-center gap-2">
                Family Discount
                <Badge variant="success">-15%</Badge>
              </span>
              <span>-{formatPrice(discount)}</span>
            </div>
          )}

          <div className="flex justify-between text-xl font-medium text-white pt-2 border-t border-charcoal-700">
            <span>Total</span>
            <span className="text-gold-500">{formatPrice(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
