"use server";

import { createClient } from "@/lib/supabase/server";

export type FaceJobStatus = "queued" | "running" | "failed" | "complete";

export interface FaceJob {
  id: string;
  session_id: string;
  status: FaceJobStatus;
  progress: number;
  message: string | null;
  photos_total: number | null;
  photos_done: number | null;
  faces_total: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export async function enqueueFaceJob(sessionId: string): Promise<FaceJob> {
  const supabase = await createClient();

  // If a job is already queued/running for this session, return it.
  const { data: existing } = await supabase
    .from("face_jobs")
    .select("*")
    .eq("session_id", sessionId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as FaceJob;

  const { data, error } = await supabase
    .from("face_jobs")
    .insert({
      session_id: sessionId,
      status: "queued",
      progress: 0,
      message: "Queued",
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[enqueueFaceJob] Failed:", error);
    throw new Error("Failed to enqueue face job");
  }

  return data as FaceJob;
}

export async function getFaceJobForSession(sessionId: string): Promise<FaceJob | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("face_jobs")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getFaceJobForSession] Failed:", error);
    return null;
  }

  return (data as FaceJob) ?? null;
}


