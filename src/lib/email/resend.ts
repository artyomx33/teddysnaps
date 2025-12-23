import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  console.warn("RESEND_API_KEY not set - emails will not be sent");
}

export const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM_EMAIL = "TeddySnaps <snaps@teddykids.nl>";
