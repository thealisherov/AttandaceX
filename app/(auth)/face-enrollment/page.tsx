"use client";

/**
 * /face-enrollment — First-time face registration page
 *
 * Spec §2.1 step 7: "Xodim keyin ilk marta Face ID (yuzni skanerlash)
 * jarayonidan o'tadi (enrollment)."
 *
 * Flow:
 *  1. Request camera permission → show live preview
 *  2. Load face-api.js models
 *  3. Detect face in real-time → show oval guide (gray → green when detected)
 *  4. User taps "Yuzni saqlash" → capture embedding → POST /api/face/enroll
 *  5. On success → redirect to /home
 *
 * Edge cases handled:
 *  - Camera denied → clear error with instructions
 *  - No face detected → prompt to reposition
 *  - Model loading failure → error state
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getEmbeddingFromVideo } from "@/lib/face/embedding";

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
    <div className="auth-card" style={{ maxWidth: 440 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>
          {step === 2 ? "✅" : "🫠"}
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
      <div className="ax-steps">
        {[0, 1, 2].map((s) => (
          <div
            key={s}
            className={`ax-step-dot ${step === s ? "active" : step > s ? "done" : ""}`}
          />
        ))}
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
                  padding: "0.5rem 0",
                  borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}
              >
                <span style={{ color: "#60a5fa", fontSize: "1rem" }}>✓</span>
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
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
          >
            {!modelsReady ? (
              <>
                <span className="ax-spinner" />
                Yuklanmoqda...
              </>
            ) : (
              "📷 Kamerani yoqish"
            )}
          </button>
        </>
      )}

      {/* Step 1 — Camera view */}
      {step === 1 && (
        <>
          <div className="ax-camera-container" style={{ marginBottom: "1rem" }}>
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

          {/* Status hint */}
          <div style={{ textAlign: "center", marginBottom: "1rem" }}>
            {enrollState === "no_face" && (
              <span className="ax-badge ax-badge-warning">👤 Yuz aniqlanmadi</span>
            )}
            {enrollState === "detected" && (
              <span className="ax-badge ax-badge-success">✅ Yuz aniqlandi — tayyor!</span>
            )}
            {enrollState === "capturing" && (
              <span className="ax-badge ax-badge-info">
                <span className="ax-spinner" style={{ width: 12, height: 12 }} />
                &nbsp;Saqlanmoqda...
              </span>
            )}
          </div>

          <button
            id="capture-face-btn"
            className="ax-btn-primary"
            onClick={handleCapture}
            disabled={enrollState !== "detected"}
          >
            📸 Yuzni saqlash
          </button>
        </>
      )}

      {/* Step 2 — Success */}
      {step === 2 && (
        <div
          style={{
            textAlign: "center",
            padding: "1.5rem 0",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(22,163,74,0.2)",
              border: "2px solid #4ade80",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2rem",
              marginBottom: "0.75rem",
            }}
          >
            ✅
          </div>
          <p className="ax-subtext">Bosh sahifaga o&apos;tilmoqda...</p>
          <div style={{ marginTop: "0.75rem" }}>
            <span className="ax-spinner" />
          </div>
        </div>
      )}

      {/* Error message */}
      {errorMsg && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            background: "rgba(220,38,38,0.15)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "#f87171",
            fontSize: "0.85rem",
            marginTop: "1rem",
          }}
        >
          ⚠️ {errorMsg}
          {(cameraState === "denied" || cameraState === "error") && (
            <button
              onClick={() => {
                setErrorMsg(null);
                setCameraState("idle");
                startCamera();
              }}
              style={{
                display: "block",
                marginTop: "0.5rem",
                color: "#93c5fd",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "0.85rem",
                textDecoration: "underline",
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
