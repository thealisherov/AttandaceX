"use client";

/**
 * /face-enrollment — First-time face registration page
 *
 * Spec §2.1 step 7: "Xodim keyin ilk marta Face ID (yuzni skanerlash)
 * jarayonidan o'tadi (enrollment)."
 *
 * Upgraded to use realistic Lucide React icons.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getEmbeddingFromVideo } from "@/lib/face/embedding";
import { 
  Camera, 
  ScanFace, 
  CheckCircle2, 
  AlertCircle, 
  Smile, 
  Loader2, 
  Check 
} from "lucide-react";

type CameraState = "idle" | "requesting" | "active" | "denied" | "error";
type EnrollState = "idle" | "no_face" | "detected" | "capturing" | "success" | "error";

export default function FaceEnrollmentPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [enrollState, setEnrollState] = useState<EnrollState>("idle");
  const [modelsReady, setModelsReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [step, setStep] = useState(0); // 0: instructions, 1: camera, 2: done

  // ── Load face-api.js models ───────────────────────────────────────────────
  useEffect(() => {
    import("@/lib/face/faceApi")
      .then(({ loadModels }) => loadModels())
      .then(() => setModelsReady(true))
      .catch(() => {
        setErrorMsg("Yuz aniqlash modellari yuklanmadi. Sahifani yangilang.");
      });
  }, []);

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraState("requesting");
    setErrorMsg(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraState("active");
      setEnrollState("no_face");
      setStep(1);
    } catch (err) {
      const isDenied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");

      setCameraState(isDenied ? "denied" : "error");
      setErrorMsg(
        isDenied
          ? "Kamera ruxsati rad etildi. Brauzer sozlamalaridan ruxsat bering va qaytadan urinib ko'ring."
          : "Kamera ochilmadi. Boshqa ilova kamerani ishlatayotgan bo'lishi mumkin."
      );
    }
  }, []);

  // ── Stop camera on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (detectIntervalRef.current) clearInterval(detectIntervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Real-time face detection loop (every 600ms) ───────────────────────────
  useEffect(() => {
    if (cameraState !== "active" || !modelsReady || !videoRef.current) return;

    const video = videoRef.current;

    detectIntervalRef.current = setInterval(async () => {
      if (enrollState === "capturing" || enrollState === "success") return;

      try {
        const { faceapi } = await import("@/lib/face/faceApi");
        const detection = await faceapi
          .detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 })
          )
          .withFaceLandmarks();

        setEnrollState(detection ? "detected" : "no_face");
      } catch {
        // silent — detection errors are non-critical
      }
    }, 600);

    return () => {
      if (detectIntervalRef.current) clearInterval(detectIntervalRef.current);
    };
  }, [cameraState, modelsReady, enrollState]);

  // ── Capture & enroll ──────────────────────────────────────────────────────
  const handleCapture = async () => {
    if (!videoRef.current || enrollState !== "detected") return;
    setEnrollState("capturing");
    if (detectIntervalRef.current) clearInterval(detectIntervalRef.current);

    try {
      const embedding = await getEmbeddingFromVideo(videoRef.current);

      if (!embedding) {
        setEnrollState("no_face");
        setErrorMsg("Yuz aniqlanmadi. Yaxshiroq yorug'likda qayta urinib ko'ring.");
        return;
      }

      const res = await fetch("/api/face/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedding }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Server xatosi");
      }

      // Stop camera
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setEnrollState("success");
      setStep(2);

      // Redirect after 2s
      setTimeout(() => router.push("/home"), 2000);
    } catch (err) {
      setEnrollState("detected");
      setErrorMsg(err instanceof Error ? err.message : "Xato yuz berdi. Qaytadan urinib ko'ring.");
    }
  };

  // ── Oval state class ──────────────────────────────────────────────────────
  const ovalClass =
    enrollState === "detected"
      ? "ax-face-oval detected"
      : enrollState === "capturing"
      ? "ax-face-oval capturing"
      : "ax-face-oval";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="auth-card" style={{ background: "#ffffff", padding: "2.5rem 2rem", maxWidth: "420px", border: "1px solid #e5e7eb", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "1.25rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ marginBottom: "0.5rem" }}>
          {step === 2 ? (
            <CheckCircle2 size={48} style={{ color: "#4ade80" }} />
          ) : (
            <Smile size={48} style={{ color: "#2563eb" }} />
          )}
        </div>
        <h1 className="ax-heading" style={{ fontSize: "1.3rem" }}>
          {step === 2 ? "Yuz muvaffaqiyatli saqlandi!" : "Yuz ID ro'yxatdan o'tish"}
        </h1>
        <p className="ax-subtext" style={{ marginTop: "0.25rem", fontSize: "0.85rem" }}>
          {step === 0 && "Kirish uchun bir marta yuzingizni skanerlashingiz kerak"}
          {step === 1 && "Yuzingizni oval ichiga joylashtiring"}
          {step === 2 && "Bosh sahifaga o'tkazilmoqda..."}
        </p>
      </div>

      {/* Progress steps */}
      <div className="ax-steps" style={{ marginBottom: "1.5rem" }}>
        {[0, 1, 2].map((s) => (
          <div
            key={s}
            className={`ax-step-dot ${step === s ? "active" : step > s ? "done" : ""}`}
          />
        ))}
      </div>

      {/* Camera view (always in DOM so videoRef is stable) */}
      <div
        className="ax-camera-container"
        style={{
          marginBottom: "1rem",
          display: step === 1 ? "block" : "none"
        }}
      >
        <video
          ref={videoRef}
          id="enrollment-video"
          autoPlay
          playsInline
          muted
        />
        <div className="ax-camera-overlay">
          <div className={ovalClass} />
        </div>
      </div>

      {/* Step 0 — Instructions */}
      {step === 0 && (
        <>
          <div style={{ margin: "1.25rem 0" }}>
            {[
              "Kamera orqali yuzingiz skanerlanadi",
              "Yuzingizni oval ichiga markazlang",
              "Yaxshi yorug'likda bo'ling",
              "Ma'lumotlar xavfsiz saqlanadi",
            ].map((text, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  padding: "0.65rem 0",
                  borderBottom: i < 3 ? "1px solid #edf2f7" : "none",
                }}
              >
                <Check size={14} style={{ color: "#2563eb" }} />
                <span className="ax-subtext" style={{ fontSize: "0.875rem" }}>
                  {text}
                </span>
              </div>
            ))}
          </div>

          <button
            id="start-camera-btn"
            className="ax-btn-primary"
            onClick={startCamera}
            disabled={!modelsReady}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", width: "100%", boxShadow: "0 8px 25px rgba(37, 99, 235, 0.15)" }}
          >
            {!modelsReady ? (
              <>
                <Loader2 size={16} className="ax-spinner" />
                Yuklanmoqda...
              </>
            ) : (
              <>
                <Camera size={16} />
                Kamerani yoqish
              </>
            )}
          </button>
        </>
      )}

      {/* Step 1 — Camera view */}
      {step === 1 && (
        <>
          {/* Status hint */}
          <div style={{ textAlign: "center", marginBottom: "1rem" }}>
            {enrollState === "no_face" && (
              <span className="ax-badge ax-badge-warning" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                <ScanFace size={12} /> Yuz aniqlanmadi
              </span>
            )}
            {enrollState === "detected" && (
              <span className="ax-badge ax-badge-success" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                <CheckCircle2 size={12} /> Yuz aniqlandi — tayyor!
              </span>
            )}
            {enrollState === "capturing" && (
              <span className="ax-badge ax-badge-info" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                <Loader2 size={12} className="ax-spinner" /> Saqlanmoqda...
              </span>
            )}
          </div>

          <button
            id="capture-face-btn"
            className="ax-btn-primary"
            onClick={handleCapture}
            disabled={enrollState !== "detected"}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", boxShadow: "0 8px 25px rgba(37, 99, 235, 0.15)" }}
          >
            <Camera size={16} />
            Yuzni saqlash
          </button>
        </>
      )}

      {/* Step 2 — Success */}
      {step === 2 && (
        <div
          style={{
            textAlign: "center",
            padding: "1.5rem 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem"
          }}
        >
          <CheckCircle2 size={48} style={{ color: "#4ade80" }} />
          <p className="ax-subtext">Bosh sahifaga o&apos;tilmoqda...</p>
          <div style={{ marginTop: "0.75rem" }}>
            <Loader2 size={24} className="ax-spinner" style={{ color: "#2563eb" }} />
          </div>
        </div>
      )}

      {/* Error message */}
      {errorMsg && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#dc2626",
            fontSize: "0.85rem",
            marginTop: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
          {(cameraState === "denied" || cameraState === "error") && (
            <button
              onClick={() => {
                setErrorMsg(null);
                setCameraState("idle");
                startCamera();
              }}
              style={{
                alignSelf: "flex-start",
                marginTop: "0.25rem",
                color: "#2563eb",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "0.85rem",
                textDecoration: "underline",
                padding: 0
              }}
            >
              Qaytadan urinish
            </button>
          )}
        </div>
      )}
    </div>
  );
}
