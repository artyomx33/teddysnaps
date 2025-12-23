"use server";

import { resend, FROM_EMAIL } from "./resend";
import { OrderConfirmationEmail } from "./templates/order-confirmation";
import { PhotosReadyEmail } from "./templates/photos-ready";

export async function sendOrderConfirmationEmail(params: {
  to: string;
  parentName: string;
  childName: string;
  photoCount: number;
  totalAmount: string;
  galleryUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `Bedankt voor je bestelling - ${params.childName}'s foto's`,
      react: OrderConfirmationEmail({
        parentName: params.parentName,
        childName: params.childName,
        photoCount: params.photoCount,
        totalAmount: params.totalAmount,
        galleryUrl: params.galleryUrl,
      }),
    });

    if (error) {
      console.error("Failed to send order confirmation email:", error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    console.error("Error sending order confirmation email:", err);
    return { ok: false, error: String(err) };
  }
}

export async function sendPhotosReadyEmail(params: {
  to: string;
  parentName: string;
  childName: string;
  photoCount: number;
  downloadUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `Je foto's van ${params.childName} zijn klaar!`,
      react: PhotosReadyEmail({
        parentName: params.parentName,
        childName: params.childName,
        photoCount: params.photoCount,
        downloadUrl: params.downloadUrl,
      }),
    });

    if (error) {
      console.error("Failed to send photos ready email:", error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    console.error("Error sending photos ready email:", err);
    return { ok: false, error: String(err) };
  }
}
