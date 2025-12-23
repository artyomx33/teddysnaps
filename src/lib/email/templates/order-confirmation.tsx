import * as React from "react";

interface OrderConfirmationEmailProps {
  parentName: string;
  childName: string;
  photoCount: number;
  totalAmount: string;
  galleryUrl: string;
}

export function OrderConfirmationEmail({
  parentName,
  childName,
  photoCount,
  totalAmount,
  galleryUrl,
}: OrderConfirmationEmailProps) {
  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "40px 20px",
        backgroundColor: "#0a0a0a",
        color: "#ffffff",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <img
          src="https://snaps.teddykids.nl/teddysnaps-logo.png"
          alt="TeddySnaps"
          width="180"
          height="180"
          style={{ margin: "0 auto" }}
        />
      </div>

      {/* Main content */}
      <div
        style={{
          backgroundColor: "#1a1a1a",
          borderRadius: "16px",
          padding: "32px",
          border: "1px solid #2a2a2a",
        }}
      >
        <h2
          style={{
            color: "#d4a853",
            fontSize: "24px",
            marginTop: 0,
            marginBottom: "24px",
          }}
        >
          Bedankt voor je bestelling!
        </h2>

        <p style={{ color: "#a0a0a0", lineHeight: "1.6", margin: "0 0 20px" }}>
          Beste {parentName},
        </p>

        <p style={{ color: "#a0a0a0", lineHeight: "1.6", margin: "0 0 20px" }}>
          We hebben je bestelling ontvangen voor de foto&apos;s van{" "}
          <strong style={{ color: "#ffffff" }}>{childName}</strong>. Ons team
          gaat nu aan de slag met het bewerken van je foto&apos;s.
        </p>

        {/* Order summary */}
        <div
          style={{
            backgroundColor: "#0a0a0a",
            borderRadius: "12px",
            padding: "20px",
            margin: "24px 0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <span style={{ color: "#a0a0a0" }}>Aantal foto&apos;s:</span>
            <span style={{ color: "#ffffff", fontWeight: "bold" }}>
              {photoCount}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: "1px solid #2a2a2a",
              paddingTop: "12px",
            }}
          >
            <span style={{ color: "#a0a0a0" }}>Totaal betaald:</span>
            <span style={{ color: "#d4a853", fontWeight: "bold", fontSize: "18px" }}>
              {totalAmount}
            </span>
          </div>
        </div>

        <p style={{ color: "#a0a0a0", lineHeight: "1.6", margin: "0 0 24px" }}>
          Zodra je foto&apos;s klaar zijn, ontvang je een email met een link om
          ze te downloaden. Dit duurt meestal 1-3 werkdagen.
        </p>

        {/* CTA Button */}
        <div style={{ textAlign: "center", margin: "32px 0" }}>
          <a
            href={galleryUrl}
            style={{
              display: "inline-block",
              backgroundColor: "#d4a853",
              color: "#0a0a0a",
              padding: "14px 32px",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "16px",
            }}
          >
            Bekijk je galerij
          </a>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          textAlign: "center",
          marginTop: "40px",
          color: "#666666",
          fontSize: "14px",
        }}
      >
        <p style={{ margin: "0 0 8px" }}>
          Vragen? Antwoord direct op deze email.
        </p>
        <p style={{ margin: "0" }}>
          Made with love for{" "}
          <span style={{ color: "#d4a853" }}>TeddyKids</span> families
        </p>
      </div>
    </div>
  );
}
