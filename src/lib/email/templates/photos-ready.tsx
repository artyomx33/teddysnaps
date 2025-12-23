import * as React from "react";

interface PhotosReadyEmailProps {
  parentName: string;
  childName: string;
  photoCount: number;
  downloadUrl: string;
}

export function PhotosReadyEmail({
  parentName,
  childName,
  photoCount,
  downloadUrl,
}: PhotosReadyEmailProps) {
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
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <span style={{ fontSize: "64px" }}>🎉</span>
        </div>

        <h2
          style={{
            color: "#d4a853",
            fontSize: "24px",
            marginTop: 0,
            marginBottom: "24px",
            textAlign: "center",
          }}
        >
          Je foto&apos;s zijn klaar!
        </h2>

        <p style={{ color: "#a0a0a0", lineHeight: "1.6", margin: "0 0 20px" }}>
          Beste {parentName},
        </p>

        <p style={{ color: "#a0a0a0", lineHeight: "1.6", margin: "0 0 20px" }}>
          Geweldig nieuws! De foto&apos;s van{" "}
          <strong style={{ color: "#ffffff" }}>{childName}</strong> zijn bewerkt
          en klaar om te downloaden.
        </p>

        {/* Photo count badge */}
        <div
          style={{
            backgroundColor: "#0a0a0a",
            borderRadius: "12px",
            padding: "20px",
            margin: "24px 0",
            textAlign: "center",
          }}
        >
          <span style={{ color: "#d4a853", fontSize: "36px", fontWeight: "bold" }}>
            {photoCount}
          </span>
          <br />
          <span style={{ color: "#a0a0a0" }}>HD foto&apos;s klaar</span>
        </div>

        {/* CTA Button */}
        <div style={{ textAlign: "center", margin: "32px 0" }}>
          <a
            href={downloadUrl}
            style={{
              display: "inline-block",
              backgroundColor: "#d4a853",
              color: "#0a0a0a",
              padding: "16px 40px",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "18px",
            }}
          >
            Download je foto&apos;s
          </a>
        </div>

        <p
          style={{
            color: "#666666",
            lineHeight: "1.6",
            margin: "24px 0 0",
            fontSize: "14px",
            textAlign: "center",
          }}
        >
          De downloadlink blijft 30 dagen geldig.
        </p>
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
