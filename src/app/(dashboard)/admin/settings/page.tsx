"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  MapPin,
  Plus,
  Trash2,
  CreditCard,
  Mail,
  Save,
  Check,
  Loader2,
  Package,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Button, Input, Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";

interface Location {
  id: string;
  name: string;
  slug: string;
  address: string | null;
}

interface Product {
  id: string;
  name: string;
  type: string;
  price: number;
  description: string | null;
}

export default function SettingsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showZeroPriced, setShowZeroPriced] = useState(false);

  // New location form
  const [newLocation, setNewLocation] = useState({ name: "", address: "" });
  const [showAddLocation, setShowAddLocation] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const supabase = createClient();

    const [locationsRes, productsRes] = await Promise.all([
      supabase.from("locations").select("*").order("name"),
      supabase.from("products").select("*").order("price"),
    ]);

    setLocations(locationsRes.data || []);
    setProducts(productsRes.data || []);
    setLoading(false);
  }

  const handleAddLocation = async () => {
    if (!newLocation.name.trim()) return;

    setSaving(true);
    const supabase = createClient();

    const slug = newLocation.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    const { error } = await supabase.from("locations").insert({
      name: newLocation.name,
      slug,
      address: newLocation.address || null,
    });

    if (!error) {
      setNewLocation({ name: "", address: "" });
      setShowAddLocation(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleDeleteLocation = async (id: string) => {
    if (!confirm("Are you sure? This will affect all families at this location."))
      return;

    const supabase = createClient();
    await supabase.from("locations").delete().eq("id", id);
    fetchData();
  };

  const handleUpdateProduct = async (id: string, price: number) => {
    const supabase = createClient();
    await supabase.from("products").update({ price }).eq("id", id);
    fetchData();
  };

  const handleUpdateProductFields = async (
    id: string,
    patch: Partial<Pick<Product, "name" | "type" | "description" | "price">>
  ) => {
    const supabase = createClient();
    await supabase.from("products").update(patch).eq("id", id);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar role="admin" />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" />

      <main className="flex-1 ml-64">
        <Header title="Settings" subtitle="Configure your TeddySnaps" />

        <div className="p-6 space-y-8 max-w-4xl">
          {/* Locations Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-gold-500" />
                Locations
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddLocation(!showAddLocation)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Location
              </Button>
            </div>

            {showAddLocation && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4"
              >
                <Card variant="glass" className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-charcoal-400 mb-1">
                        Location Name *
                      </label>
                      <Input
                        placeholder="e.g., TeddyKids Amsterdam"
                        value={newLocation.name}
                        onChange={(e) =>
                          setNewLocation((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-charcoal-400 mb-1">
                        Address
                      </label>
                      <Input
                        placeholder="Street, City"
                        value={newLocation.address}
                        onChange={(e) =>
                          setNewLocation((prev) => ({
                            ...prev,
                            address: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      variant="ghost"
                      onClick={() => setShowAddLocation(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleAddLocation}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Add Location"
                      )}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

            <div className="space-y-2">
              {locations.length === 0 ? (
                <Card variant="glass" className="p-8 text-center">
                  <MapPin className="w-8 h-8 text-charcoal-500 mx-auto mb-2" />
                  <p className="text-charcoal-400">No locations yet</p>
                </Card>
              ) : (
                locations.map((location) => (
                  <Card key={location.id} variant="default" className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{location.name}</p>
                        {location.address && (
                          <p className="text-sm text-charcoal-400">
                            {location.address}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => handleDeleteLocation(location.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </section>

          {/* Products/Pricing Section */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-teal-400" />
              Products & Pricing
            </h2>

            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-charcoal-500">
                Tip: set a product price to <span className="text-charcoal-300 font-medium">0</span> to hide it from parents.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowZeroPriced((v) => !v)}
              >
                {showZeroPriced ? "Hide €0 products" : "Show €0 products"}
              </Button>
            </div>

            <div className="space-y-2">
              {(showZeroPriced ? products : products.filter((p) => p.price > 0)).map((product) => (
                <Card key={product.id} variant="default" className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Input
                        value={product.name}
                        onChange={(e) =>
                          setProducts((prev) =>
                            prev.map((p) =>
                              p.id === product.id ? { ...p, name: e.target.value } : p
                            )
                          )
                        }
                        onBlur={(e) =>
                          handleUpdateProductFields(product.id, { name: e.target.value })
                        }
                        className="max-w-sm"
                      />
                      <p className="text-sm text-charcoal-400">
                        {product.description || product.type}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <select
                        value={product.type}
                        onChange={(e) => {
                          const nextType = e.target.value;
                          setProducts((prev) =>
                            prev.map((p) =>
                              p.id === product.id ? { ...p, type: nextType } : p
                            )
                          );
                          handleUpdateProductFields(product.id, { type: nextType }).catch(() => {});
                        }}
                        className="px-3 py-2 bg-charcoal-900 border border-charcoal-700 rounded-lg text-white"
                      >
                        <option value="digital">digital</option>
                        <option value="print">print</option>
                        <option value="canvas">canvas</option>
                        <option value="book">book</option>
                      </select>
                      <span className="text-charcoal-400">€</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={product.price}
                        onChange={(e) =>
                          setProducts((prev) =>
                            prev.map((p) =>
                              p.id === product.id
                                ? { ...p, price: parseFloat(e.target.value) || 0 }
                                : p
                            )
                          )
                        }
                        onBlur={(e) =>
                          handleUpdateProductFields(product.id, {
                            price: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-24 text-right"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* Integration Status */}
          <section>
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-400" />
              Integrations
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card variant="glass" className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">Mollie Payments</p>
                    <p className="text-sm text-charcoal-400">
                      Accept iDEAL, credit cards, and more
                    </p>
                  </div>
                  <Badge variant="warning" className="text-yellow-400">
                    Not configured
                  </Badge>
                </div>
              </Card>

              <Card variant="glass" className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">Resend Email</p>
                    <p className="text-sm text-charcoal-400">
                      Send order confirmations and gallery links
                    </p>
                  </div>
                  <Badge variant="warning" className="text-yellow-400">
                    Not configured
                  </Badge>
                </div>
              </Card>
            </div>

            <p className="text-sm text-charcoal-500 mt-4">
              To configure integrations, add API keys to your .env.local file:
              <br />
              <code className="text-charcoal-400">MOLLIE_API_KEY=test_xxx</code>
              <br />
              <code className="text-charcoal-400">RESEND_API_KEY=re_xxx</code>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
