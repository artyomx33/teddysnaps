"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Users, KeyRound, Calendar, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { Button, Card, CardContent, Input, Badge } from "@/components/ui";
import { getFamilyByAccessCode, getSessionsForLocation, type Session } from "@/lib/actions/gallery";
import { useRouter } from "next/navigation";

export default function GalleryEntryPage() {
  const router = useRouter();

  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);

  const normalizedCode = useMemo(() => accessCode.trim().toUpperCase(), [accessCode]);

  const handleContinue = async () => {
    if (!normalizedCode) return;
    setLoading(true);
    setError(null);

    try {
      const family = await getFamilyByAccessCode(normalizedCode);
      if (!family) {
        setError("Invalid access code. Please check and try again.");
        setFamilyName(null);
        setSessions([]);
        return;
      }

      setFamilyName(family.family_name);

      const locationId = family.location_id;
      if (!locationId) {
        setError("This family is missing a location. Ask the photographer to fix it in Admin → Families.");
        setSessions([]);
        return;
      }

      const sessionsForLocation = await getSessionsForLocation(locationId);
      setSessions(sessionsForLocation);
    } catch (e) {
      console.error(e);
      setError("Failed to load sessions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSession = (sessionId: string) => {
    router.push(`/gallery/${sessionId}/${normalizedCode}`);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
      >
        <Card variant="glass" className="p-6">
          <CardContent className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gold-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-gold-500" />
              </div>
              <div>
                <h1 className="text-2xl font-serif text-white">Parent Access</h1>
                <p className="text-charcoal-400 text-sm">
                  Enter your access code to see available photo sessions.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-charcoal-400">Access code</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal-500" />
                  <Input
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="e.g., TEDDYABC"
                    className="pl-12 bg-charcoal-900 border-charcoal-700"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleContinue();
                    }}
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={handleContinue}
                  disabled={!normalizedCode || loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Continue"
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {familyName && (
              <div className="flex items-center justify-between">
                <p className="text-white">
                  Welcome, <span className="text-gold-500 font-medium">{familyName}</span>
                </p>
                <Badge variant="default" className="font-mono">
                  {normalizedCode}
                </Badge>
              </div>
            )}

            {sessions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-charcoal-300">
                  <Calendar className="w-4 h-4 text-teal-400" />
                  Select a session
                </div>
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      className="w-full text-left p-4 rounded-lg border border-charcoal-700 hover:border-charcoal-600 hover:bg-charcoal-800/40 transition-colors"
                      onClick={() => handleOpenSession(s.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{s.name}</p>
                          <p className="text-sm text-charcoal-500">
                            {new Date(s.shoot_date).toLocaleDateString("nl-NL", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-charcoal-500" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {familyName && sessions.length === 0 && !loading && !error && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-300">
                  No sessions found for your location yet. Please check back later.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}


