"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, MessageCircle, Building, Home, Check } from "lucide-react";
import { Card, CardContent, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DELIVERY_OPTIONS } from "@/config/pricing";

interface DeliveryFormProps {
  onDeliveryMethodChange: (method: string) => void;
  onContactChange: (contact: { email?: string; phone?: string; address?: string }) => void;
  selectedMethod: string;
}

const methodIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  whatsapp: MessageCircle,
  pickup: Building,
  delivery: Home,
};

export function DeliveryForm({
  onDeliveryMethodChange,
  onContactChange,
  selectedMethod,
}: DeliveryFormProps) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const handleEmailChange = (value: string) => {
    setEmail(value);
    onContactChange({ email: value, phone, address });
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    onContactChange({ email, phone: value, address });
  };

  const handleAddressChange = (value: string) => {
    setAddress(value);
    onContactChange({ email, phone, address: value });
  };

  return (
    <Card>
      <CardContent className="space-y-6">
        <h3 className="text-lg font-medium text-white">Delivery Method</h3>

        {/* Delivery Options */}
        <div className="grid grid-cols-2 gap-3">
          {DELIVERY_OPTIONS.map((option) => {
            const Icon = methodIcons[option.id];
            const isSelected = selectedMethod === option.id;

            return (
              <motion.button
                key={option.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onDeliveryMethodChange(option.id)}
                className={cn(
                  "p-4 rounded-xl border-2 text-left transition-all relative",
                  isSelected
                    ? "border-gold-500 bg-gold-500/10"
                    : "border-charcoal-700 hover:border-charcoal-600"
                )}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-gold-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-charcoal-950" />
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      isSelected ? "bg-gold-500/20" : "bg-charcoal-800"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5",
                        isSelected ? "text-gold-500" : "text-charcoal-400"
                      )}
                    />
                  </div>
                  <div>
                    <p
                      className={cn(
                        "font-medium",
                        isSelected ? "text-white" : "text-charcoal-300"
                      )}
                    >
                      {option.name}
                    </p>
                    <p className="text-sm text-charcoal-400">
                      {option.description}
                    </p>
                    {option.price > 0 && (
                      <p className="text-sm text-gold-500 mt-1">
                        +€{option.price.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Contact Details */}
        <div className="space-y-4 pt-4 border-t border-charcoal-700">
          <h4 className="text-sm font-medium text-charcoal-300">
            Contact Details
          </h4>

          {(selectedMethod === "email" || selectedMethod === "delivery") && (
            <Input
              label="Email Address"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
            />
          )}

          {selectedMethod === "whatsapp" && (
            <Input
              label="WhatsApp Number"
              type="tel"
              placeholder="+31 6 12345678"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
            />
          )}

          {selectedMethod === "delivery" && (
            <div className="space-y-3">
              <Input
                label="Phone Number"
                type="tel"
                placeholder="+31 6 12345678"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
              />
              <Input
                label="Delivery Address"
                placeholder="Street, City, Postal Code"
                value={address}
                onChange={(e) => handleAddressChange(e.target.value)}
              />
            </div>
          )}

          {selectedMethod === "pickup" && (
            <div className="p-4 bg-charcoal-800/50 rounded-lg">
              <p className="text-sm text-charcoal-400">
                Your prints will be ready for pickup at TeddyKids. We&apos;ll notify
                you when they&apos;re ready.
              </p>
              <Input
                label="Email for notification"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                className="mt-3"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
