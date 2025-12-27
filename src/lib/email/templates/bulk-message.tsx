import * as React from "react";

export type BulkEmailType = "reminder" | "promotional" | "custom";

interface BulkMessageEmailProps {
  familyName: string;
  childName?: string;
  templateType: BulkEmailType;
  customMessage?: string;
  galleryUrl: string;
}

function getTemplateContent(
  type: BulkEmailType,
  familyName: string,
  childName?: string,
  customMessage?: string
): { heading: string; body: React.ReactNode; buttonText: string } {
  const nameHighlight = (
    <strong style={{ color: "#ec4899" }}>{childName || familyName}</strong>
  );

  switch (type) {
    case "reminder":
      return {
        heading: "De mooiste momenten staan klaar",
        body: (
          <>
            <p style={{ color: "#a0a0a0", lineHeight: "1.6", margin: "0 0 20px" }}>
              Beste Familie {familyName},
            </p>
            <p style={{ color: "#a0a0a0", lineHeight: "1.6", margin: "0 0 20px" }}>
              De professionele foto&apos;s van {nameHighlight} zijn bewerkt en
              klaar om te bekijken. Mis deze bijzondere momenten niet!
            </p>
          </>
        ),
        buttonText: "Bekijk de foto's",
      };

    case "promotional":
      return {
        heading: "Speciale aanbieding!",
        body: (
          <>
            <p style={{ color: "#a0a0a0", lineHeight: "1.6", margin: "0 0 20px" }}>
              Beste Familie {familyName},
            </p>
            <p style={{ color: "#a0a0a0", lineHeight: "1.6", margin: "0 0 20px" }}>
              {customMessage || "We hebben een speciale aanbieding voor je!"}
            </p>
          </>
        ),
        buttonText: "Bekijk de aanbieding",
      };

    case "custom":
    default:
      return {
        heading: "Bericht van TeddySnaps",
        body: (
          <>
            <p style={{ color: "#a0a0a0", lineHeight: "1.6", margin: "0 0 20px" }}>
              Beste Familie {familyName},
            </p>
            <p
              style={{
                color: "#a0a0a0",
                lineHeight: "1.6",
                margin: "0 0 20px",
                whiteSpace: "pre-wrap",
              }}
            >
              {customMessage || ""}
            </p>
          </>
        ),
        buttonText: "Bekijk je foto's",
      };
  }
}

export function BulkMessageEmail({
  familyName,
  childName,
  templateType,
  customMessage,
  galleryUrl,
}: BulkMessageEmailProps) {
  const { heading, body, buttonText } = getTemplateContent(
    templateType,
    familyName,
    childName,
    customMessage
  );

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
            color: "#ec4899",
            fontSize: "24px",
            marginTop: 0,
            marginBottom: "24px",
            textAlign: "center",
          }}
        >
          {heading}
        </h2>

        {body}

        {/* CTA Button - Pink gradient */}
        <div style={{ textAlign: "center", margin: "32px 0" }}>
          <a
            href={galleryUrl}
            style={{
              display: "inline-block",
              background: "linear-gradient(135deg, #ec4899 0%, #f472b6 100%)",
              color: "#ffffff",
              padding: "16px 40px",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "18px",
            }}
          >
            {buttonText}
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
        <p style={{ margin: "0", fontSize: "16px" }}>
          Warme groet,
          <br />
          <span style={{ color: "#ec4899" }}>TeddySnaps</span>{" "}
          <span role="img" aria-label="teddy bear">
            🧸
          </span>
          <span role="img" aria-label="pink heart">
            💗
          </span>
          <span role="img" aria-label="blue heart">
            💙
          </span>
        </p>
      </div>
    </div>
  );
}

export function getSubjectForTemplate(
  type: BulkEmailType,
  familyName: string,
  childName?: string
): string {
  switch (type) {
    case "reminder":
      return `De mooiste momenten van ${childName || familyName} staan klaar ✨`;
    case "promotional":
      return `Speciale aanbieding voor Familie ${familyName}! 🎁`;
    case "custom":
    default:
      return `Bericht van TeddySnaps`;
  }
}
