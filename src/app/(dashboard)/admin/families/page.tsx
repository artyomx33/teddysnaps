"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Search,
  Loader2,
  UserPlus,
  Trash2,
  Copy,
  Check,
  X,
  ChevronRight,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Badge, Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

interface Child {
  id: string;
  first_name: string;
}

interface Family {
  id: string;
  family_name: string;
  email: string | null;
  phone: string | null;
  access_code: string;
  children: Child[];
  location: {
    name: string;
  }[] | null;
}

export default function FamiliesPage() {
  const router = useRouter();
  const [families, setFamilies] = useState<Family[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [newFamily, setNewFamily] = useState({
    family_name: "",
    email: "",
    phone: "",
    location_id: "",
    children: [""],
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const supabase = createClient();

    const [familiesRes, locationsRes] = await Promise.all([
      supabase
        .from("families")
        .select(`
          id,
          family_name,
          email,
          phone,
          access_code,
          children (id, first_name),
          location:locations (name)
        `)
        .order("family_name"),
      supabase.from("locations").select("id, name").order("name"),
    ]);

    setFamilies(familiesRes.data || []);
    setLocations(locationsRes.data || []);
    setLoading(false);
  }

  const generateAccessCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "TEDDY";
    for (let i = 0; i < 3; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const handleAddFamily = async () => {
    if (!newFamily.family_name || !newFamily.location_id) return;

    const supabase = createClient();
    const accessCode = generateAccessCode();

    // Create family
    const { data: family, error: familyError } = await supabase
      .from("families")
      .insert({
        family_name: newFamily.family_name,
        email: newFamily.email || null,
        phone: newFamily.phone || null,
        location_id: newFamily.location_id,
        access_code: accessCode,
      })
      .select()
      .single();

    if (familyError) {
      console.error("Error creating family:", familyError);
      return;
    }

    // Add children
    const childrenToAdd = newFamily.children
      .filter((name) => name.trim())
      .map((name) => ({
        family_id: family.id,
        first_name: name.trim(),
        is_enrolled: true,
      }));

    if (childrenToAdd.length > 0) {
      await supabase.from("children").insert(childrenToAdd);
    }

    // Reset form and refresh
    setNewFamily({
      family_name: "",
      email: "",
      phone: "",
      location_id: "",
      children: [""],
    });
    setShowAddForm(false);
    fetchData();
  };

  const handleDeleteFamily = async (familyId: string) => {
    if (!confirm("Are you sure you want to delete this family?")) return;

    const supabase = createClient();

    // Delete children first
    await supabase.from("children").delete().eq("family_id", familyId);

    // Delete family
    await supabase.from("families").delete().eq("id", familyId);

    fetchData();
  };

  const copyAccessCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const addChildField = () => {
    setNewFamily((prev) => ({
      ...prev,
      children: [...prev.children, ""],
    }));
  };

  const updateChildName = (index: number, name: string) => {
    setNewFamily((prev) => ({
      ...prev,
      children: prev.children.map((c, i) => (i === index ? name : c)),
    }));
  };

  const removeChildField = (index: number) => {
    if (newFamily.children.length <= 1) return;
    setNewFamily((prev) => ({
      ...prev,
      children: prev.children.filter((_, i) => i !== index),
    }));
  };

  const filteredFamilies = families.filter(
    (family) =>
      family.family_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      family.children?.some((child) =>
        child.first_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

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
        <Header title="Families" subtitle="Manage registered families" />

        <div className="p-6 space-y-6">
          {/* Actions Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal-500" />
              <Input
                placeholder="Search families or children..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 bg-charcoal-900 border-charcoal-700"
              />
            </div>
            <Button
              variant="primary"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Family
            </Button>
          </div>

          {/* Add Family Form */}
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card variant="glass" className="p-6">
                <h3 className="font-medium text-white mb-4">Add New Family</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-charcoal-400 mb-1">
                      Family Name *
                    </label>
                    <Input
                      placeholder="e.g., Van den Berg"
                      value={newFamily.family_name}
                      onChange={(e) =>
                        setNewFamily((prev) => ({
                          ...prev,
                          family_name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-charcoal-400 mb-1">
                      Location *
                    </label>
                    <select
                      value={newFamily.location_id}
                      onChange={(e) =>
                        setNewFamily((prev) => ({
                          ...prev,
                          location_id: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 bg-charcoal-800 border border-charcoal-700 rounded-lg text-white"
                    >
                      <option value="">Select location</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-charcoal-400 mb-1">
                      Email
                    </label>
                    <Input
                      type="email"
                      placeholder="parent@example.com"
                      value={newFamily.email}
                      onChange={(e) =>
                        setNewFamily((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-charcoal-400 mb-1">
                      Phone
                    </label>
                    <Input
                      placeholder="+31 6 12345678"
                      value={newFamily.phone}
                      onChange={(e) =>
                        setNewFamily((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm text-charcoal-400 mb-2">
                    Children
                  </label>
                  <div className="space-y-2">
                    {newFamily.children.map((child, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="Child's first name"
                          value={child}
                          onChange={(e) => updateChildName(index, e.target.value)}
                        />
                        {newFamily.children.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeChildField(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addChildField}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Child
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleAddFamily}>
                    Create Family
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Families List */}
          <div className="space-y-3">
            {filteredFamilies.length === 0 ? (
              <Card variant="glass" className="p-12 text-center">
                <Users className="w-12 h-12 text-charcoal-500 mx-auto mb-4" />
                <p className="text-charcoal-400">
                  {searchQuery ? "No families found" : "No families registered yet"}
                </p>
              </Card>
            ) : (
              filteredFamilies.map((family, index) => (
                <motion.div
                  key={family.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card
                    variant="default"
                    className="p-4 hover:bg-charcoal-800/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/admin/families/${family.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-serif text-lg">
                          {family.family_name[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white">
                              {family.family_name}
                            </p>
                            <Badge variant="default" className="text-xs font-mono">
                              {family.access_code}
                            </Badge>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyAccessCode(family.access_code, family.id);
                              }}
                              className="p-1 hover:bg-charcoal-700 rounded"
                            >
                              {copiedId === family.id ? (
                                <Check className="w-3 h-3 text-green-500" />
                              ) : (
                                <Copy className="w-3 h-3 text-charcoal-400" />
                              )}
                            </button>
                          </div>
                          <p className="text-sm text-charcoal-400">
                            {family.children?.map((c) => c.first_name).join(", ") ||
                              "No children"}
                            {family.location?.[0] && ` • ${family.location[0].name}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {family.email && (
                          <span className="text-sm text-charcoal-400">
                            {family.email}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFamily(family.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <ChevronRight className="w-5 h-5 text-charcoal-500" />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
