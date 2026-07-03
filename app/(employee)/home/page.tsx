"use client";

/**
 * /home — Employee dashboard (Phase 4 scope)
 *
 * Placeholder for now — Phase 4 will add:
 *  - Real-time server clock
 *  - CHECK IN / CHECK OUT buttons
 *  - Today's schedule display
 */

export default function HomePage() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        color: "#fff",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏢</div>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          marginBottom: "0.5rem",
        }}
      >
        AttendanceX
      </h1>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.95rem" }}>
        Xodim paneli — Phase 4 da to&apos;liq amalga oshiriladi
      </p>
      <div
        style={{
          marginTop: "2rem",
          padding: "1rem 1.5rem",
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "1rem",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            color: "#4ade80",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          ✅ Tizimga muvaffaqiyatli kirdingiz
        </span>
      </div>
    </div>
  );
}
