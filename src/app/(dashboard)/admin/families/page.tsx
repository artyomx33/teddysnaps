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
  GitMerge,
  ArrowLeftRight,
  AlertTriangle,
  Camera,
  Phone,
  CheckCircle,
  RotateCcw,
  Mail,
  Send,
  Pencil,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, Badge, Button, Input, Glow } from "@/components/ui";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
// Thumbnails are now pre-generated - no transform needed

interface Child {
  id: string;
  first_name: string;
  reference_photo_url: string | null;
  photo_children: { count: number }[];
}

interface HeroPhoto {
  id: string;
  thumbnail_url: string | null;
  original_url: string;
}

interface Family {
  id: string;
  family_name: string;
  email: string | null;
  phone: string | null;
  access_code: string;
  location_id: string;
  hero_photo_id: string | null;
  hero_photo: HeroPhoto[] | null;
  children: Child[];
  location: {
    name: string;
  }[] | null;
  done_at: string | null;
  last_gallery_access: string | null;
}

import { setFamilyDoneStatus } from "@/lib/actions/families";

export default function FamiliesPage() {
  const router = useRouter();
  const [families, setFamilies] = useState<Family[]>([]);
  const [purchaseCounts, setPurchaseCounts] = useState<Record<string, number>>({});
  const [latestOrderAt, setLatestOrderAt] = useState<Record<string, string>>({});
  const [openRetouchCounts, setOpenRetouchCounts] = useState<Record<string, number>>({});
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "done">("all");
  const [togglingDoneId, setTogglingDoneId] = useState<string | null>(null);

  // Merge mode state
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  // Email mode state
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [selectedEmailFamilies, setSelectedEmailFamilies] = useState<string[]>([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState<"reminder" | "promotional" | "custom">("reminder");
  const [customMessage, setCustomMessage] = useState("");
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailResult, setEmailResult] = useState<{ sent: number; failed: number } | null>(null);
  const [hotLeadsOnly, setHotLeadsOnly] = useState(false);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editEmailValue, setEditEmailValue] = useState("");

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
          location_id,
          hero_photo_id,
          done_at,
          last_gallery_access,
          hero_photo:photos!hero_photo_id (id, thumbnail_url, original_url),
          children (id, first_name, reference_photo_url, photo_children(count)),
          location:locations (name)
        `)
        .order("family_name"),
      supabase.from("locations").select("id, name").order("name"),
    ]);

    setFamilies(familiesRes.data || []);
    setLocations(locationsRes.data || []);

    const familyIds = (familiesRes.data || []).map((f: any) => f.id as string).filter(Boolean);
    if (familyIds.length > 0) {
      const [paidOrdersRes, openRetouchRes] = await Promise.all([
        supabase
          .from("orders")
          .select("family_id, created_at")
          .in("family_id", familyIds)
          .eq("payment_status", "paid"),
        supabase
          .from("retouch_tasks")
          .select("family_id")
          .in("family_id", familyIds)
          .neq("status", "delivered"),
      ]);

      const paidCounts: Record<string, number> = {};
      const latestOrders: Record<string, string> = {};
      for (const row of paidOrdersRes.data || []) {
        const fid = (row as any).family_id as string;
        const createdAt = (row as any).created_at as string;
        if (!fid) continue;
        paidCounts[fid] = (paidCounts[fid] || 0) + 1;
        // Track the latest order timestamp
        if (!latestOrders[fid] || createdAt > latestOrders[fid]) {
          latestOrders[fid] = createdAt;
        }
      }

      const openCounts: Record<string, number> = {};
      for (const row of openRetouchRes.data || []) {
        const fid = (row as any).family_id as string;
        if (!fid) continue;
        openCounts[fid] = (openCounts[fid] || 0) + 1;
      }

      setPurchaseCounts(paidCounts);
      setLatestOrderAt(latestOrders);
      setOpenRetouchCounts(openCounts);
    } else {
      setPurchaseCounts({});
      setLatestOrderAt({});
      setOpenRetouchCounts({});
    }

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

  // Merge mode handlers
  const handleFamilySelect = (familyId: string) => {
    if (!isMergeMode) return;

    setSelectedFamilies((prev) => {
      if (prev.includes(familyId)) {
        return prev.filter((id) => id !== familyId);
      }
      if (prev.length >= 2) {
        return prev; // Max 2 families
      }
      return [...prev, familyId];
    });
  };

  const exitMergeMode = () => {
    setIsMergeMode(false);
    setSelectedFamilies([]);
    setShowMergeModal(false);
    setMergeError(null);
  };

  const swapFamilies = () => {
    setSelectedFamilies((prev) => [prev[1], prev[0]]);
  };

  const handleMerge = async () => {
    if (selectedFamilies.length !== 2) return;

    const [sourceFamilyId, destinationFamilyId] = selectedFamilies;
    const supabase = createClient();

    setMerging(true);
    setMergeError(null);

    try {
      // Step 1: Move all children from source to destination
      const { error: childrenError } = await supabase
        .from("children")
        .update({ family_id: destinationFamilyId })
        .eq("family_id", sourceFamilyId);

      if (childrenError) {
        throw new Error(`Failed to move children: ${childrenError.message}`);
      }

      // Step 2: Move all orders from source to destination
      const { error: ordersError } = await supabase
        .from("orders")
        .update({ family_id: destinationFamilyId })
        .eq("family_id", sourceFamilyId);

      if (ordersError) {
        // Rollback: Move children back
        await supabase
          .from("children")
          .update({ family_id: sourceFamilyId })
          .eq("family_id", destinationFamilyId);
        throw new Error(`Failed to move orders: ${ordersError.message}`);
      }

      // Step 3: Delete the source family (now empty)
      const { error: deleteError } = await supabase
        .from("families")
        .delete()
        .eq("id", sourceFamilyId);

      if (deleteError) {
        // Rollback: Move everything back
        await supabase
          .from("children")
          .update({ family_id: sourceFamilyId })
          .eq("family_id", destinationFamilyId);
        await supabase
          .from("orders")
          .update({ family_id: sourceFamilyId })
          .eq("family_id", destinationFamilyId);
        throw new Error(`Failed to delete source family: ${deleteError.message}`);
      }

      // Success - refresh and exit merge mode
      exitMergeMode();
      fetchData();
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  };

  // Get family objects for merge preview
  const sourceFamily = selectedFamilies[0] ? families.find((f) => f.id === selectedFamilies[0]) : null;
  const destinationFamily = selectedFamilies[1] ? families.find((f) => f.id === selectedFamilies[1]) : null;
  const locationMismatch = sourceFamily && destinationFamily && sourceFamily.location_id !== destinationFamily.location_id;

  // Email mode handlers
  const exitEmailMode = () => {
    setIsEmailMode(false);
    setSelectedEmailFamilies([]);
    setShowEmailModal(false);
    setEmailResult(null);
    setHotLeadsOnly(false);
  };

  const handleEmailFamilySelect = (familyId: string, hasEmail: boolean) => {
    if (!isEmailMode || !hasEmail) return;

    setSelectedEmailFamilies((prev) => {
      if (prev.includes(familyId)) {
        return prev.filter((id) => id !== familyId);
      }
      return [...prev, familyId];
    });
  };

  // Check if family is a "hot lead" (accessed gallery in last 10 days)
  const isHotLead = (family: Family): boolean => {
    if (!family.last_gallery_access) return false;
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    return new Date(family.last_gallery_access) > tenDaysAgo;
  };

  // Get families with email for "Select All" button
  const familiesWithEmail = families.filter((f) => f.email);
  const hotLeadFamilies = familiesWithEmail.filter(isHotLead);

  const handleSelectAllWithEmail = () => {
    const targetFamilies = hotLeadsOnly ? hotLeadFamilies : familiesWithEmail;
    setSelectedEmailFamilies(targetFamilies.map((f) => f.id));
  };

  const handleSendEmails = async () => {
    if (selectedEmailFamilies.length === 0) return;

    setSendingEmails(true);
    setEmailResult(null);

    try {
      const response = await fetch("/api/admin/email/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyIds: selectedEmailFamilies,
          templateType: emailTemplate,
          customMessage: emailTemplate === "custom" ? customMessage : undefined,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        setEmailResult({ sent: data.sent, failed: data.failed });
        setSelectedEmailFamilies([]);
        setShowEmailModal(false);
      } else {
        setEmailResult({ sent: 0, failed: selectedEmailFamilies.length });
      }
    } catch {
      setEmailResult({ sent: 0, failed: selectedEmailFamilies.length });
    } finally {
      setSendingEmails(false);
    }
  };

  const handleUpdateEmail = async (familyId: string, newEmail: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("families")
      .update({ email: newEmail || null })
      .eq("id", familyId);

    if (!error) {
      setFamilies((prev) =>
        prev.map((f) => (f.id === familyId ? { ...f, email: newEmail || null } : f))
      );
    }
    setEditingEmailId(null);
  };

  // Calculate total photo count for a family (sum of all children's photo_children counts)
  const getFamilyPhotoCount = (family: Family): number => {
    if (!family.children) return 0;
    return family.children.reduce((total, child) => {
      const count = child.photo_children?.[0]?.count || 0;
      return total + count;
    }, 0);
  };

  // Compute family status: open/done/none (no orders)
  const getFamilyStatus = (family: Family): "open" | "done" | "none" => {
    const hasOrders = (purchaseCounts[family.id] || 0) > 0;
    if (!hasOrders) return "none";

    const doneAt = family.done_at;
    const latestOrder = latestOrderAt[family.id];

    // Open if: no done_at OR latest order is after done_at
    if (!doneAt || (latestOrder && latestOrder > doneAt)) {
      return "open";
    }
    return "done";
  };

  // Toggle done status
  const handleToggleDone = async (family: Family) => {
    const currentStatus = getFamilyStatus(family);
    const shouldMarkDone = currentStatus === "open";

    setTogglingDoneId(family.id);
    try {
      await setFamilyDoneStatus(family.id, shouldMarkDone);
      // Optimistically update local state
      setFamilies(prev => prev.map(f =>
        f.id === family.id
          ? { ...f, done_at: shouldMarkDone ? new Date().toISOString() : null }
          : f
      ));
    } catch (e) {
      console.error("Failed to toggle done status:", e);
    } finally {
      setTogglingDoneId(null);
    }
  };

  // Count families by status
  const statusCounts = families.reduce(
    (acc, family) => {
      const status = getFamilyStatus(family);
      if (status === "open") acc.open++;
      else if (status === "done") acc.done++;
      return acc;
    },
    { open: 0, done: 0 }
  );

  const filteredFamilies = families.filter((family) => {
    // First apply search filter
    const matchesSearch =
      family.family_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      family.children?.some((child) =>
        child.first_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    if (!matchesSearch) return false;

    // Then apply status filter
    if (statusFilter === "all") return true;
    const status = getFamilyStatus(family);
    if (statusFilter === "open") return status === "open";
    if (statusFilter === "done") return status === "done";
    return true;
  });

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

            <div className="flex items-center gap-2">
              {isMergeMode ? (
                <>
                  <span className="text-sm text-charcoal-400">
                    {selectedFamilies.length}/2 selected
                  </span>
                  <Button variant="ghost" onClick={exitMergeMode}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setShowMergeModal(true)}
                    disabled={selectedFamilies.length !== 2}
                  >
                    <GitMerge className="w-4 h-4 mr-2" />
                    Preview Merge
                  </Button>
                </>
              ) : isEmailMode ? (
                <>
                  <span className="text-sm text-charcoal-400">
                    {selectedEmailFamilies.length} selected
                  </span>
                  <Button variant="ghost" onClick={exitEmailMode}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setShowEmailModal(true)}
                    disabled={selectedEmailFamilies.length === 0}
                    className="bg-pink-500 hover:bg-pink-400"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Compose Email
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsEmailMode(true)}
                    className="border-pink-500/50 text-pink-400 hover:bg-pink-500/10"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Send Emails
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsMergeMode(true)}
                  >
                    <GitMerge className="w-4 h-4 mr-2" />
                    Merge Families
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setShowAddForm(!showAddForm)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Family
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Status Filter Bar */}
          {(statusCounts.open > 0 || statusCounts.done > 0) && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-charcoal-400 mr-2">Status:</span>
              <Button
                variant={statusFilter === "all" ? "primary" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                All ({families.length})
              </Button>
              <Button
                variant={statusFilter === "open" ? "primary" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("open")}
              >
                Open ({statusCounts.open})
              </Button>
              <Button
                variant={statusFilter === "done" ? "primary" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("done")}
              >
                Done ({statusCounts.done})
              </Button>
            </div>
          )}

          {/* Merge Mode Instructions */}
          {isMergeMode && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card variant="glass" className="p-4 border-gold-500/30">
                <div className="flex items-center gap-3">
                  <GitMerge className="w-5 h-5 text-gold-500" />
                  <p className="text-charcoal-300">
                    <span className="text-gold-500 font-medium">Merge Mode:</span> Select 2 families to merge. The first family selected will be merged INTO the second.
                  </p>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Email Mode Instructions */}
          {isEmailMode && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card variant="glass" className="p-4 border-pink-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-pink-500" />
                    <p className="text-charcoal-300">
                      <span className="text-pink-500 font-medium">Email Mode:</span> Select families to email. Only families with email addresses are selectable.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-charcoal-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hotLeadsOnly}
                        onChange={(e) => setHotLeadsOnly(e.target.checked)}
                        className="rounded border-charcoal-600 bg-charcoal-800 text-pink-500 focus:ring-pink-500"
                      />
                      Hot leads only ({hotLeadFamilies.length})
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllWithEmail}
                      className="border-pink-500/50 text-pink-400"
                    >
                      Select All ({hotLeadsOnly ? hotLeadFamilies.length : familiesWithEmail.length})
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Email Result Banner */}
          {emailResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card
                variant="glass"
                className={`p-4 ${
                  emailResult.failed > 0
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-teal-500/30 bg-teal-500/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {emailResult.failed > 0 ? (
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-teal-400" />
                    )}
                    <p className="text-charcoal-200">
                      Sent {emailResult.sent} emails successfully
                      {emailResult.failed > 0 && `, ${emailResult.failed} failed`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEmailResult(null)}>
                    Dismiss
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

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
              filteredFamilies.map((family, index) => {
                const familyStatus = getFamilyStatus(family);
                const isDone = familyStatus === "done";
                const isOpen = familyStatus === "open";

                return (
                <motion.div
                  key={family.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Glow
                    variant="gold"
                    disabled={isDone || !(purchaseCounts[family.id] > 0)}
                    className="rounded-xl"
                  >
                  <Card
                    variant={selectedFamilies.includes(family.id) ? "glow" : "default"}
                    className={`p-4 transition-colors cursor-pointer relative ${
                      isDone ? "opacity-60" : ""
                    } ${
                      isMergeMode
                        ? selectedFamilies.includes(family.id)
                          ? "ring-2 ring-gold-500"
                          : "hover:ring-2 hover:ring-gold-500/50"
                        : isEmailMode
                        ? selectedEmailFamilies.includes(family.id)
                          ? "ring-2 ring-pink-500"
                          : family.email
                          ? "hover:ring-2 hover:ring-pink-500/50"
                          : "opacity-50"
                        : "hover:bg-charcoal-800/50"
                    }`}
                    onClick={() => {
                      if (isMergeMode) {
                        handleFamilySelect(family.id);
                      } else if (isEmailMode) {
                        handleEmailFamilySelect(family.id, !!family.email);
                      } else {
                        router.push(`/admin/families/${family.id}`);
                      }
                    }}
                  >
                    {/* Selection indicator in merge mode */}
                    {isMergeMode && (
                      <div className="absolute top-3 right-3">
                        {selectedFamilies.includes(family.id) ? (
                          <div className="w-6 h-6 rounded-full bg-gold-500 flex items-center justify-center">
                            <span className="text-charcoal-950 text-xs font-bold">
                              {selectedFamilies.indexOf(family.id) + 1}
                            </span>
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-charcoal-600" />
                        )}
                      </div>
                    )}

                    {/* Selection indicator in email mode */}
                    {isEmailMode && (
                      <div className="absolute top-3 right-3">
                        {family.email ? (
                          selectedEmailFamilies.includes(family.id) ? (
                            <div className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-pink-500/50" />
                          )
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-charcoal-700 flex items-center justify-center opacity-50">
                            <X className="w-3 h-3 text-charcoal-500" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Hero photo or fallback to child reference photo or initial */}
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-serif text-lg flex-shrink-0">
                          {family.hero_photo?.[0]?.thumbnail_url || family.hero_photo?.[0]?.original_url ? (
                            <img
                              src={family.hero_photo[0].thumbnail_url || family.hero_photo[0].original_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : family.children?.find(c => c.reference_photo_url)?.reference_photo_url ? (
                            <img
                              src={family.children.find(c => c.reference_photo_url)!.reference_photo_url!}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            family.family_name[0]
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white">
                              {family.family_name}
                            </p>
                            <Badge variant="default" className="text-xs font-mono">
                              {family.access_code}
                            </Badge>
                            {isDone ? (
                              <Badge variant="success" className="text-xs flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Done
                              </Badge>
                            ) : (purchaseCounts[family.id] || 0) > 0 && (
                              <Badge variant="gold" className="text-xs flex items-center gap-1">
                                <Download className="w-3 h-3" />
                                {purchaseCounts[family.id]} HD
                              </Badge>
                            )}
                            {(openRetouchCounts[family.id] || 0) > 0 && (
                              <Badge variant="warning" className="text-xs">
                                {openRetouchCounts[family.id]} retouch
                              </Badge>
                            )}
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
                          <p className="text-sm text-charcoal-400 flex items-center gap-2">
                            <span>
                              {family.children?.map((c) => c.first_name).join(", ") ||
                                "No children"}
                            </span>
                            {family.location?.[0] && (
                              <span>• {family.location[0].name}</span>
                            )}
                            <span className="inline-flex items-center gap-1 text-teal-400">
                              <Camera className="w-3 h-3" />
                              {getFamilyPhotoCount(family)}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Inline email editing */}
                        {editingEmailId === family.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleUpdateEmail(family.id, editEmailValue);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1"
                          >
                            <Input
                              type="email"
                              value={editEmailValue}
                              onChange={(e) => setEditEmailValue(e.target.value)}
                              placeholder="email@example.com"
                              className="w-48 h-8 text-sm"
                              autoFocus
                              onBlur={() => handleUpdateEmail(family.id, editEmailValue)}
                            />
                          </form>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEmailId(family.id);
                              setEditEmailValue(family.email || "");
                            }}
                            className="flex items-center gap-1 text-sm text-charcoal-400 hover:text-white group"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            {family.email || <span className="text-charcoal-500">Add email</span>}
                            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                          </button>
                        )}
                        {family.phone && (
                          <span className="text-sm text-charcoal-400 inline-flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-charcoal-500" />
                            {family.phone}
                          </span>
                        )}
                        {/* Done/Re-open button - only show for families with orders */}
                        {(isOpen || isDone) && (
                          <Button
                            variant={isDone ? "outline" : "ghost"}
                            size="sm"
                            className={isDone
                              ? "text-charcoal-400 hover:text-white"
                              : "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            }
                            disabled={togglingDoneId === family.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleDone(family);
                            }}
                          >
                            {togglingDoneId === family.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isDone ? (
                              <>
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Re-open
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Done
                              </>
                            )}
                          </Button>
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
                  </Glow>
                </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Merge Preview Modal */}
        <AnimatePresence>
          {showMergeModal && sourceFamily && destinationFamily && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => !merging && setShowMergeModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6 max-w-2xl w-full"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-serif text-white">Merge Preview</h2>
                  <button
                    onClick={() => !merging && setShowMergeModal(false)}
                    className="text-charcoal-400 hover:text-white"
                    disabled={merging}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Warning */}
                <Card variant="glass" className="border-amber-500/30 bg-amber-500/10 p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-400 font-medium">This action cannot be undone</p>
                      <p className="text-sm text-charcoal-400 mt-1">
                        The source family will be permanently deleted after merge.
                        {locationMismatch && (
                          <span className="block text-amber-400 mt-1">
                            Warning: These families are in different locations.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Side by side comparison */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Source column */}
                  <Card variant="default" className="p-4 border-red-500/30">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                        <span className="text-red-400 text-xs font-bold">1</span>
                      </div>
                      <h3 className="font-medium text-red-400">Source (will be deleted)</h3>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-white font-medium">{sourceFamily.family_name}</p>
                        <p className="text-sm text-charcoal-500 font-mono">{sourceFamily.access_code}</p>
                      </div>
                      <div>
                        <p className="text-xs text-charcoal-500 uppercase mb-1">Children to move</p>
                        <p className="text-charcoal-300">
                          {sourceFamily.children?.length || 0} children
                          {sourceFamily.children?.length > 0 && (
                            <span className="text-charcoal-500 ml-1">
                              ({sourceFamily.children.map((c) => c.first_name).join(", ")})
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-charcoal-500 uppercase mb-1">Location</p>
                        <p className="text-charcoal-300">{sourceFamily.location?.[0]?.name || "Unknown"}</p>
                      </div>
                    </div>
                  </Card>

                  {/* Destination column */}
                  <Card variant="default" className="p-4 border-teal-500/30">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 rounded-full bg-teal-500/20 flex items-center justify-center">
                        <span className="text-teal-400 text-xs font-bold">2</span>
                      </div>
                      <h3 className="font-medium text-teal-400">Destination (keeps code)</h3>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-white font-medium">{destinationFamily.family_name}</p>
                        <p className="text-sm text-teal-400 font-mono">{destinationFamily.access_code}</p>
                      </div>
                      <div>
                        <p className="text-xs text-charcoal-500 uppercase mb-1">Existing children</p>
                        <p className="text-charcoal-300">
                          {destinationFamily.children?.length || 0} children
                          {destinationFamily.children?.length > 0 && (
                            <span className="text-charcoal-500 ml-1">
                              ({destinationFamily.children.map((c) => c.first_name).join(", ")})
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-charcoal-500 uppercase mb-1">Location</p>
                        <p className="text-charcoal-300">{destinationFamily.location?.[0]?.name || "Unknown"}</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Swap button */}
                <div className="flex justify-center mb-6">
                  <Button variant="outline" onClick={swapFamilies} disabled={merging}>
                    <ArrowLeftRight className="w-4 h-4 mr-2" />
                    Swap Source & Destination
                  </Button>
                </div>

                {/* Error message */}
                {mergeError && (
                  <Card variant="glass" className="border-red-500/30 bg-red-500/10 p-4 mb-6">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <p className="text-red-400">{mergeError}</p>
                    </div>
                  </Card>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-charcoal-700">
                  <Button
                    variant="ghost"
                    onClick={() => setShowMergeModal(false)}
                    disabled={merging}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleMerge}
                    disabled={merging}
                    className="bg-red-500 hover:bg-red-400"
                  >
                    {merging ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Merging...
                      </>
                    ) : (
                      <>
                        <GitMerge className="w-4 h-4 mr-2" />
                        Confirm Merge
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email Composer Modal */}
        <AnimatePresence>
          {showEmailModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => !sendingEmails && setShowEmailModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6 max-w-xl w-full"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-serif text-white">Compose Email</h2>
                  <button
                    onClick={() => !sendingEmails && setShowEmailModal(false)}
                    className="text-charcoal-400 hover:text-white"
                    disabled={sendingEmails}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Recipient count */}
                <div className="mb-6">
                  <Badge variant="default" className="text-sm">
                    <Mail className="w-3.5 h-3.5 mr-1" />
                    {selectedEmailFamilies.length} recipients
                  </Badge>
                </div>

                {/* Template selector */}
                <div className="space-y-3 mb-6">
                  <p className="text-sm text-charcoal-400">Select template:</p>
                  <label
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      emailTemplate === "reminder"
                        ? "border-pink-500 bg-pink-500/10"
                        : "border-charcoal-700 hover:border-charcoal-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      value="reminder"
                      checked={emailTemplate === "reminder"}
                      onChange={() => setEmailTemplate("reminder")}
                      className="mt-1 text-pink-500 focus:ring-pink-500"
                    />
                    <div>
                      <p className="font-medium text-white">Photo Reminder</p>
                      <p className="text-sm text-charcoal-400">
                        &quot;De mooiste momenten staan klaar&quot; - remind families their photos are ready
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      emailTemplate === "promotional"
                        ? "border-pink-500 bg-pink-500/10"
                        : "border-charcoal-700 hover:border-charcoal-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      value="promotional"
                      checked={emailTemplate === "promotional"}
                      onChange={() => setEmailTemplate("promotional")}
                      className="mt-1 text-pink-500 focus:ring-pink-500"
                    />
                    <div>
                      <p className="font-medium text-white">Promotional</p>
                      <p className="text-sm text-charcoal-400">
                        &quot;Speciale aanbieding!&quot; - for special offers and discounts
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      emailTemplate === "custom"
                        ? "border-pink-500 bg-pink-500/10"
                        : "border-charcoal-700 hover:border-charcoal-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      value="custom"
                      checked={emailTemplate === "custom"}
                      onChange={() => setEmailTemplate("custom")}
                      className="mt-1 text-pink-500 focus:ring-pink-500"
                    />
                    <div>
                      <p className="font-medium text-white">Custom Message</p>
                      <p className="text-sm text-charcoal-400">Write your own message</p>
                    </div>
                  </label>
                </div>

                {/* Custom message textarea */}
                {emailTemplate === "custom" && (
                  <div className="mb-6">
                    <label className="block text-sm text-charcoal-400 mb-2">Your message:</label>
                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder="Write your message here..."
                      className="w-full h-32 px-4 py-3 bg-charcoal-800 border border-charcoal-700 rounded-lg text-white placeholder-charcoal-500 resize-none focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-charcoal-700">
                  <Button
                    variant="ghost"
                    onClick={() => setShowEmailModal(false)}
                    disabled={sendingEmails}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSendEmails}
                    disabled={sendingEmails || (emailTemplate === "custom" && !customMessage.trim())}
                    className="bg-pink-500 hover:bg-pink-400"
                  >
                    {sendingEmails ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send to {selectedEmailFamilies.length} families
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
