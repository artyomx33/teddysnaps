import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  console.warn("RESEND_API_KEY not set - emails will not be sent");
}

// Use a placeholder key in CI/dev to prevent build errors (actual sends check the key)
export const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder_key");

export const FROM_EMAIL = "TeddySnaps <snaps@teddykids.nl>";
