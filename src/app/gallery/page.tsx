"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Users, KeyRound, Calendar, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { Button, Card, CardContent, Input, Badge } from "@/components/ui";
import { useRouter } from "next/navigation";

type Session = {
  id: string;
  name: string;
  shoot_date: string;
};

export default function GalleryEntryPage() {
  const router = useRouter();

  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Contact capture (email required before opening a session)
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [savedWhatsapp, setSavedWhatsapp] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [whatsappInput, setWhatsappInput] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSaved, setContactSaved] = useState(false);

  const normalizedCode = useMemo(() => accessCode.trim().toUpperCase(), [accessCode]);

  const handleContinue = async () => {
    if (!normalizedCode) return;
    setLoading(true);
    setError(null);
    setContactError(null);
    setContactSaved(false);

    try {
      const res = await fetch("/api/gallery/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: normalizedCode }),
      });

      const payload = (await res.json()) as
        | {
            ok: true;
            familyName: string;
            email?: string | null;
            whatsapp?: string | null;
            sessions: Session[];
          }
        | { ok: false; message: string };

      if (!payload.ok) {
        setError(payload.message || "Failed to load sessions. Please try again.");
        setFamilyName(null);
        setSessions([]);
        setSavedEmail(null);
        setSavedWhatsapp(null);
        setEmailInput("");
        setWhatsappInput("");
        return;
      }

      setFamilyName(payload.familyName);
      setSessions(payload.sessions ?? []);
      const initialEmail = (payload.email ?? "").trim();
      const initialWhatsapp = (payload.whatsapp ?? "").trim();
      setSavedEmail(initialEmail || null);
      setSavedWhatsapp(initialWhatsapp || null);
      setEmailInput(initialEmail);
      setWhatsappInput(initialWhatsapp);
      setContactSaved(false);
    } catch (e) {
      console.error(e);
      setError("Failed to load sessions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContact = async () => {
    if (!normalizedCode) return;
    if (savingContact) return;
    setSavingContact(true);
    setContactError(null);
    setContactSaved(false);

    try {
      const res = await fetch("/api/gallery/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessCode: normalizedCode,
          email: emailInput.trim(),
          whatsapp: whatsappInput.trim(),
        }),
      });

      const payload = (await res.json()) as
        | {
            ok: true;
            email: string | null;
            whatsapp: string | null;
          }
        | { ok: false; message: string };

      if (!payload.ok) {
        setContactError(payload.message || "Failed to save contact details. Please try again.");
        return;
      }

      const nextEmail = (payload.email ?? "").trim();
      const nextWhatsapp = (payload.whatsapp ?? "").trim();
      setSavedEmail(nextEmail || null);
      setSavedWhatsapp(nextWhatsapp || null);
      setEmailInput(nextEmail);
      setWhatsappInput(nextWhatsapp);
      setContactSaved(true);
    } catch (e) {
      console.error(e);
      setContactError("Failed to save contact details. Please try again.");
    } finally {
      setSavingContact(false);
    }
  };

  const savedEmailNormalized = (savedEmail ?? "").trim().toLowerCase();
  const emailInputNormalized = emailInput.trim().toLowerCase();
  const isEmailPresent = !!savedEmailNormalized;
  const isEmailDirty = emailInputNormalized !== savedEmailNormalized;
  const canOpenSessions = isEmailPresent && !isEmailDirty;

  const handleOpenSession = (sessionId: string) => {
    if (!canOpenSessions) return;
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
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-white">
                    Welcome, <span className="text-gold-500 font-medium">{familyName}</span>
                  </p>
                  <Badge variant="default" className="font-mono">
                    {normalizedCode}
                  </Badge>
                </div>

                <div className="space-y-3 border-t border-charcoal-800 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-charcoal-300">Contact details</p>
                      <p className="text-xs text-charcoal-500">
                        Email is required to open a session folder. WhatsApp is optional.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {contactSaved && (
                        <span className="text-xs text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2 py-1 rounded-md">
                          Saved
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={savingContact || !emailInput.trim()}
                        onClick={handleSaveContact}
                      >
                        {savingContact ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm text-charcoal-400">
                        Email <span className="text-red-300">*</span>
                      </label>
                      <Input
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="parent@email.com"
                        className="bg-charcoal-900 border-charcoal-700"
                        type="email"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm text-charcoal-400">WhatsApp (optional)</label>
                      <Input
                        value={whatsappInput}
                        onChange={(e) => setWhatsappInput(e.target.value)}
                        placeholder="+31 6 12345678"
                        className="bg-charcoal-900 border-charcoal-700"
                        type="tel"
                      />
                    </div>
                  </div>

                  {contactError && (
                    <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <p className="text-sm text-red-300">{contactError}</p>
                    </div>
                  )}

                  {!isEmailPresent && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-sm text-amber-300">
                        Please add your email to continue.
                      </p>
                    </div>
                  )}

                  {isEmailPresent && isEmailDirty && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-sm text-amber-300">
                        You changed your email. Please click Save to continue.
                      </p>
                    </div>
                  )}
                </div>
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
                      disabled={!canOpenSessions}
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


