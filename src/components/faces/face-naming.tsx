"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  UserPlus,
  Check,
  Save,
  Loader2,
  Users,
  X,
  Undo,
  Keyboard,
  Wand2,
} from "lucide-react";
import { Button, Card, CardContent, Badge, Input } from "@/components/ui";
import {
  getUnnamedFaces,
  getChildrenForNaming,
  nameCluster,
  createChildFromCluster,
  skipCluster,
  undoClusterNaming,
  getFaceCounts,
  getFacesForMatching,
} from "@/lib/actions/faces";
import { cn } from "@/lib/utils";
import { matchAllFaces, SuggestedMatch } from "@/lib/face-recognition/matcher";

function getConfidenceColor(similarity: number): string {
  if (similarity >= 0.95) return "bg-teal-500 text-white"; // Green - high confidence
  if (similarity >= 0.85) return "bg-amber-500 text-white"; // Yellow - good match
  return "bg-charcoal-600 text-charcoal-300"; // Gray - low confidence
}

function formatSimilarity(similarity: number): string {
  return `${Math.round(similarity * 100)}%`;
}

interface FaceNamingProps {
  sessionId: string;
  locationId: string;
  onComplete: () => void;
}

interface FaceGroup {
  clusterId: string;
  faces: Array<{ id: string; cropUrl: string; descriptor?: number[] }>;
  selectedChildId: string | null;
  newChildName: string;
  isCreatingNew: boolean;
  isSkipped: boolean;
  suggestions: SuggestedMatch[];
}

interface LastAction {
  type: "name" | "skip" | "create";
  clusterId: string;
  previousState: FaceGroup;
}

export function FaceNaming({
  sessionId,
  locationId,
  onComplete,
}: FaceNamingProps) {
  const [faceGroups, setFaceGroups] = useState<FaceGroup[]>([]);
  const [existingChildren, setExistingChildren] = useState<
    Array<{ id: string; firstName: string; familyName: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [faceCounts, setFaceCounts] = useState({ total: 0, named: 0, skipped: 0, remaining: 0 });
  const [isMatching, setIsMatching] = useState(false);
  const [hasMatched, setHasMatched] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const FACES_PER_PAGE = 24;

  const totalPages = Math.ceil(faceGroups.length / FACES_PER_PAGE);
  const paginatedGroups = faceGroups.slice(
    currentPage * FACES_PER_PAGE,
    (currentPage + 1) * FACES_PER_PAGE
  );

  useEffect(() => {
    loadData();
  }, [sessionId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return; // Ignore when typing

      const activeGroup = faceGroups[activeGroupIndex];
      if (!activeGroup) return;

      // Number keys 1-9 for quick name selection
      if (e.key >= "1" && e.key <= "9") {
        const index = parseInt(e.key) - 1;
        if (existingChildren[index]) {
          handleSelectChild(activeGroup.clusterId, existingChildren[index].id);
          // Auto-advance to next group
          if (activeGroupIndex < faceGroups.length - 1) {
            setActiveGroupIndex(activeGroupIndex + 1);
          }
        }
      }

      // Arrow keys to navigate groups
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveGroupIndex(Math.min(activeGroupIndex + 1, faceGroups.length - 1));
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveGroupIndex(Math.max(activeGroupIndex - 1, 0));
      }

      // S to skip current group
      if (e.key === "s" || e.key === "S") {
        handleSkipCluster(activeGroup.clusterId);
        if (activeGroupIndex < faceGroups.length - 1) {
          setActiveGroupIndex(activeGroupIndex + 1);
        }
      }

      // Z to undo
      if ((e.key === "z" || e.key === "Z") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleUndo();
      }

      // N for new child
      if (e.key === "n" || e.key === "N") {
        handleToggleNewChild(activeGroup.clusterId);
      }

      // ? for help
      if (e.key === "?") {
        setShowKeyboardHelp(!showKeyboardHelp);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [faceGroups, activeGroupIndex, existingChildren, showKeyboardHelp]);

  async function loadData() {
    setLoading(true);

    const [faces, children, counts] = await Promise.all([
      getUnnamedFaces(sessionId),
      getChildrenForNaming(locationId),
      getFaceCounts(sessionId),
    ]);

    setFaceCounts(counts);

    // Group faces by cluster
    const groupedByCluster = new Map<string, Array<{ id: string; cropUrl: string }>>();

    for (const face of faces) {
      const clusterId = face.cluster_id || face.id;
      const existing = groupedByCluster.get(clusterId) || [];
      existing.push({ id: face.id, cropUrl: face.crop_url });
      groupedByCluster.set(clusterId, existing);
    }

    const groups: FaceGroup[] = Array.from(groupedByCluster.entries()).map(
      ([clusterId, faces]) => ({
        clusterId,
        faces,
        selectedChildId: null,
        newChildName: "",
        isCreatingNew: false,
        isSkipped: false,
        suggestions: [],
      })
    );

    setFaceGroups(groups);
    setExistingChildren(
      children.map((c: any) => ({
        id: c.id,
        firstName: c.first_name,
        familyName: c.families?.family_name || "",
      }))
    );
    setLoading(false);
  }

  const handleSelectChild = (clusterId: string, childId: string) => {
    setFaceGroups((prev) =>
      prev.map((g) =>
        g.clusterId === clusterId
          ? { ...g, selectedChildId: childId, isCreatingNew: false, newChildName: "", isSkipped: false }
          : g
      )
    );
  };

  const handleToggleNewChild = (clusterId: string) => {
    setFaceGroups((prev) =>
      prev.map((g) =>
        g.clusterId === clusterId
          ? { ...g, isCreatingNew: !g.isCreatingNew, selectedChildId: null, isSkipped: false }
          : g
      )
    );
  };

  const handleNewChildName = (clusterId: string, name: string) => {
    setFaceGroups((prev) =>
      prev.map((g) =>
        g.clusterId === clusterId ? { ...g, newChildName: name } : g
      )
    );
  };

  const handleSkipCluster = (clusterId: string) => {
    const group = faceGroups.find(g => g.clusterId === clusterId);
    if (group) {
      setLastAction({ type: "skip", clusterId, previousState: { ...group } });
    }

    setFaceGroups((prev) =>
      prev.map((g) =>
        g.clusterId === clusterId
          ? { ...g, isSkipped: true, selectedChildId: null, isCreatingNew: false, newChildName: "" }
          : g
      )
    );
  };

  const handleUndo = useCallback(async () => {
    if (!lastAction) return;

    // Restore previous state
    setFaceGroups((prev) =>
      prev.map((g) =>
        g.clusterId === lastAction.clusterId ? lastAction.previousState : g
      )
    );

    // If it was a save action, also undo in database
    if (lastAction.type === "name" || lastAction.type === "create") {
      try {
        await undoClusterNaming(lastAction.clusterId, sessionId);
      } catch (error) {
        console.error("Error undoing:", error);
      }
    }

    setLastAction(null);
  }, [lastAction, sessionId]);

  const handleMatchWithAI = async () => {
    setIsMatching(true);

    try {
      // Fetch faces with descriptors
      const { unnamed, named } = await getFacesForMatching(sessionId);

      if (named.length === 0) {
        alert("No named faces to match against. Name a few faces first!");
        setIsMatching(false);
        return;
      }

      // Prepare named faces for matching
      const namedForMatching = named.map((f: any) => ({
        childId: f.child_id,
        childName: f.children?.first_name || "Unknown",
        familyName: f.children?.families?.family_name || "",
        descriptor: f.face_descriptor as number[],
      }));

      // Prepare unnamed faces for matching
      const unnamedForMatching = unnamed.map((f: any) => ({
        id: f.id,
        descriptor: f.face_descriptor as number[],
      }));

      // Run AI matching (client-side, fast!)
      const matchResults = matchAllFaces(unnamedForMatching, namedForMatching);

      // Update face groups with suggestions
      setFaceGroups((prev) =>
        prev.map((group) => {
          // Find matches for any face in this group
          const faceId = group.faces[0]?.id;
          if (!faceId) return group;

          // Look up by clusterId first (if clustered), then by face id
          const suggestions = matchResults.get(group.clusterId) || matchResults.get(faceId) || [];

          // Auto-select if top match is >= 85%
          const topMatch = suggestions[0];
          const autoSelect = topMatch && topMatch.similarity >= 0.85 ? topMatch.childId : null;

          return {
            ...group,
            suggestions,
            selectedChildId: autoSelect || group.selectedChildId,
          };
        })
      );

      setHasMatched(true);
    } catch (error) {
      console.error("Error during AI matching:", error);
      alert("Failed to run AI matching. Please try again.");
    } finally {
      setIsMatching(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);

    try {
      // Only save faces on current page
      for (const group of paginatedGroups) {
        if (group.isSkipped) {
          await skipCluster(group.clusterId, sessionId);
        } else if (group.selectedChildId) {
          setLastAction({ type: "name", clusterId: group.clusterId, previousState: { ...group } });
          await nameCluster(group.clusterId, group.selectedChildId, sessionId);
        } else if (group.isCreatingNew && group.newChildName.trim()) {
          setLastAction({ type: "create", clusterId: group.clusterId, previousState: { ...group } });
          await createChildFromCluster(
            group.clusterId,
            sessionId,
            group.newChildName.trim(),
            locationId
          );
        }
      }

      // If more pages, advance to next. Otherwise complete.
      if (currentPage < totalPages - 1) {
        setCurrentPage(currentPage + 1);
        // Reload data to refresh the list (removes saved faces)
        await loadData();
      } else {
        onComplete();
      }
    } catch (error) {
      console.error("Error saving names:", error);
    } finally {
      setSaving(false);
    }
  };

  const pageNamedCount = paginatedGroups.filter(
    (g) => g.selectedChildId || (g.isCreatingNew && g.newChildName.trim()) || g.isSkipped
  ).length;

  if (loading) {
    return (
      <Card variant="glass" className="p-8">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-gold-500" />
          <span className="text-charcoal-400">Loading faces...</span>
        </div>
      </Card>
    );
  }

  if (faceGroups.length === 0) {
    const allDone = faceCounts.total > 0 && faceCounts.remaining === 0;
    return (
      <Card variant="glass" className="p-8 text-center">
        {allDone ? (
          <>
            <Check className="w-12 h-12 text-teal-500 mx-auto mb-4" />
            <p className="text-white font-medium mb-2">All faces processed!</p>
            <p className="text-charcoal-400">
              {faceCounts.named} named • {faceCounts.skipped} skipped
            </p>
          </>
        ) : (
          <>
            <Users className="w-12 h-12 text-charcoal-500 mx-auto mb-4" />
            <p className="text-charcoal-400">No unnamed faces to review</p>
          </>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif text-white">Name Faces</h2>
          <p className="text-sm text-charcoal-400">
            {faceGroups.length} remaining • {pageNamedCount} ready to save
            {(faceCounts.named > 0 || faceCounts.skipped > 0) && (
              <span className="text-teal-400 ml-2">
                ({faceCounts.named} named, {faceCounts.skipped} skipped previously)
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!hasMatched && faceGroups.length > 0 && (
            <Button
              variant="outline"
              onClick={handleMatchWithAI}
              disabled={isMatching}
            >
              {isMatching ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4 mr-2" />
              )}
              {isMatching ? "Matching..." : "Match with AI"}
            </Button>
          )}

          {hasMatched && (
            <Badge variant="success" className="py-1">
              <Check className="w-3 h-3 mr-1" />
              AI Matched
            </Badge>
          )}

          {lastAction && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
            >
              <Undo className="w-4 h-4 mr-2" />
              Undo
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
          >
            <Keyboard className="w-4 h-4 mr-2" />
            Shortcuts
          </Button>

          <Button
            variant="primary"
            onClick={handleSaveAll}
            disabled={saving || pageNamedCount === 0}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Page ({pageNamedCount})
          </Button>
        </div>
      </div>

      {/* Keyboard Help */}
      <AnimatePresence>
        {showKeyboardHelp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card variant="glass" className="p-4">
              <h4 className="text-sm font-medium text-white mb-2">Keyboard Shortcuts</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div><kbd className="bg-charcoal-700 px-1 rounded">1-9</kbd> Quick assign name</div>
                <div><kbd className="bg-charcoal-700 px-1 rounded">←→</kbd> Navigate groups</div>
                <div><kbd className="bg-charcoal-700 px-1 rounded">S</kbd> Skip group</div>
                <div><kbd className="bg-charcoal-700 px-1 rounded">N</kbd> New child</div>
                <div><kbd className="bg-charcoal-700 px-1 rounded">⌘Z</kbd> Undo</div>
                <div><kbd className="bg-charcoal-700 px-1 rounded">?</kbd> Toggle help</div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Face Groups Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {paginatedGroups.map((group, index) => (
          <motion.div
            key={group.clusterId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
          >
            <Card
              variant={group.selectedChildId || group.newChildName || group.isSkipped ? "glass" : "default"}
              className={cn(
                "p-3 transition-all cursor-pointer",
                index === activeGroupIndex && "ring-2 ring-gold-500",
                group.selectedChildId && "border-teal-500/50",
                group.isSkipped && "border-charcoal-600 opacity-50"
              )}
              onClick={() => setActiveGroupIndex(index)}
            >
              {/* Face thumbnail - LARGE and centered */}
              <div className="flex justify-center mb-3">
                <div className="relative">
                  <img
                    src={group.faces[0]?.cropUrl}
                    alt=""
                    className="w-32 h-32 rounded-xl object-cover"
                  />
                  {group.faces.length > 1 && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-charcoal-700 border-2 border-charcoal-900 flex items-center justify-center">
                      <span className="text-xs text-charcoal-300">
                        +{group.faces.length - 1}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status indicators */}
              {group.isSkipped && (
                <Badge variant="default" className="mb-3">
                  <X className="w-3 h-3 mr-1" />
                  Skipped
                </Badge>
              )}
              {group.selectedChildId && (
                <Badge variant="success" className="mb-3">
                  <Check className="w-3 h-3 mr-1" />
                  {existingChildren.find((c) => c.id === group.selectedChildId)?.firstName}
                </Badge>
              )}
              {group.newChildName && (
                <Badge variant="success" className="mb-3">
                  <UserPlus className="w-3 h-3 mr-1" />
                  {group.newChildName} (new)
                </Badge>
              )}

              {/* Name buttons */}
              {!group.isSkipped && (
                <div className="space-y-2">
                  {/* AI Suggestions (if available) */}
                  {group.suggestions.length > 0 && (
                    <div className="space-y-1">
                      {group.suggestions.map((suggestion, idx) => (
                        <button
                          key={suggestion.childId}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectChild(group.clusterId, suggestion.childId);
                          }}
                          className={cn(
                            "w-full px-3 py-1.5 text-sm rounded-lg transition-all flex items-center justify-between",
                            group.selectedChildId === suggestion.childId
                              ? getConfidenceColor(suggestion.similarity)
                              : idx === 0 && suggestion.similarity >= 0.85
                              ? getConfidenceColor(suggestion.similarity) + " ring-2 ring-offset-2 ring-offset-charcoal-900"
                              : "bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700"
                          )}
                        >
                          <span>{suggestion.childName}</span>
                          <span className={cn(
                            "text-xs px-1.5 py-0.5 rounded",
                            suggestion.similarity >= 0.85 ? "bg-black/20" : "bg-charcoal-700"
                          )}>
                            {formatSimilarity(suggestion.similarity)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Existing children as pressable buttons (when no AI suggestions) */}
                  {group.suggestions.length === 0 && (
                    <div className="flex flex-wrap gap-2">
                      {existingChildren.slice(0, 9).map((child, childIndex) => (
                        <button
                          key={child.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectChild(group.clusterId, child.id);
                          }}
                          className={cn(
                            "px-3 py-1.5 text-sm rounded-full transition-all",
                            group.selectedChildId === child.id
                              ? "bg-teal-500 text-white"
                              : "bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700"
                          )}
                        >
                          <span className="text-xs text-charcoal-500 mr-1">{childIndex + 1}</span>
                          {child.firstName}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Actions row */}
                  <div className="flex gap-2 pt-2 border-t border-charcoal-700">
                    {group.isCreatingNew ? (
                      <div className="flex gap-2 flex-1">
                        <Input
                          placeholder="Enter name..."
                          value={group.newChildName}
                          onChange={(e) =>
                            handleNewChildName(group.clusterId, e.target.value)
                          }
                          className="flex-1"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleNewChild(group.clusterId);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleNewChild(group.clusterId);
                          }}
                          className="flex-1"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          New
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSkipCluster(group.clusterId);
                          }}
                          className="text-charcoal-400"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Skip
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
          >
            Previous
          </Button>
          <span className="text-charcoal-400">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
