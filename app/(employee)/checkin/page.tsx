"use client";

/**
 * /checkin — GPS + Face ID check-in flow
 *
 * Spec §3.2:
 *  1. Get GPS location
 *  2. Open camera → face-api.js real-time detection
 *  3. On user tap → capture embedding → POST /api/attendance/checkin
 *  4. Show result (success/error) → redirect to /home
 *
 * Upgraded to use realistic Lucide React icons.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getEmbeddingFromVideo } from "@/lib/face/embedding";
import { 
  ArrowLeft, 
  MapPin, 
  Camera, 
  ScanFace, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertTriangle 
} from "lucide-react";

type Step = "gps" | "camera" | "submitting" | "success" | "error";
type FaceState = "idle" | "no_face" | "detected";

export default function CheckinPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [step, setStep] = useState<Step>("gps");
  const [faceState, setFaceState] = useState<FaceState>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [modelsReady, setModelsReady] = useState(false);

  // ── Load models ───────────────────────────────────────────────────────────
  useEffect(() => {
    import("@/lib/face/faceApi")
      .then(({ loadModels }) => loadModels())
      .then(() => setModelsReady(true))
      .catch(() => setErrorMsg("Yuz aniqlash modeli yuklanmadi. Sahifani yangilang."));
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (detectRef.current) clearInterval(detectRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Step 1: Get GPS ───────────────────────────────────────────────────────
  const requestGps = useCallback(() => {
    setErrorMsg(null);
    if (!navigator.geolocation) {
      setErrorMsg("Brauzeringiz GPS ni qo'llab-quvvatlamaydi.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStep("camera");
        startCamera();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMsg("GPS ruxsati rad etildi. Brauzer sozlamalaridan joylashuvga ruxsat bering.");
        } else {
          setErrorMsg("Joylashuv aniqlanmadi. Qaytadan urinib ko'ring.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 2: Start camera ──────────────────────────────────────────────────
  const startCamera = async () => {
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
      startDetection();
    } catch {
      setErrorMsg("Kamera ochilmadi. Ruxsat berilganini tekshiring.");
      setStep("gps");
    }
  };

  // ── Real-time detection loop ──────────────────────────────────────────────
  const startDetection = () => {
    if (detectRef.current) clearInterval(detectRef.current);
    detectRef.current = setInterval(async () => {
      if (!videoRef.current) return;
      try {
        const { faceapi } = await import("@/lib/face/faceApi");
        const det = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
          .withFaceLandmarks();
        setFaceState(det ? "detected" : "no_face");
      } catch { /* silent */ }
    }, 600);
  };

  // ── Step 3: Capture + submit ──────────────────────────────────────────────
  const handleCapture = async () => {
    if (!videoRef.current || !coords || faceState !== "detected") return;

    if (detectRef.current) clearInterval(detectRef.current);
    setStep("submitting");

    try {
      const embedding = await getEmbeddingFromVideo(videoRef.current);
      if (!embedding) {
        setErrorMsg("Yuz aniqlanmadi. Yaxshiroq yorug'likda qaytadan urinib ko'ring.");
        setStep("camera");
        startDetection();
        return;
      }

      streamRef.current?.getTracks().forEach((t) => t.stop());

      const res = await fetch("/api/attendance/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: coords.lat,
          longitude: coords.lng,
          embedding,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        let msg = "Muvaffaqiyatli check-in!";
        if (data.lateMinutes > 0) {
          msg += `\nSiz ${data.lateMinutes} daqiqa kechikdingiz.`;
          if (data.fineAmount > 0) {
            msg += `\nJarima: ${(data.fineAmount as number).toLocaleString()} so'm`;
          }
        }
        setResultMsg(msg);
        setStep("success");
        setTimeout(() => router.push("/home"), 2500);
      } else {
        setErrorMsg(data.error ?? "Xato yuz berdi");
        setStep("error");
      }
    } catch {
      setErrorMsg("Tarmoq xatosi. Qaytadan urinib ko'ring.");
      setStep("error");
    }
  };

  const ovalClass =
    faceState === "detected"
      ? "ax-face-oval detected"
      : step === "submitting"
      ? "ax-face-oval capturing"
      : "ax-face-oval";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <button
          id="back-btn"
          onClick={() => router.push("/home")}
          style={{ 
            background: "rgba(255,255,255,0.08)", 
            border: "1px solid rgba(255,255,255,0.15)", 
            borderRadius: "0.6rem", 
            color: "#fff", 
            padding: "0.5rem 0.75rem", 
            cursor: "pointer", 
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="ax-heading" style={{ fontSize: "1.25rem" }}>Check In</h1>
      </div>

      {/* Progress steps */}
      <div className="ax-steps" style={{ marginBottom: "1.25rem" }}>
        {["GPS", "Yuz", "Natija"].map((label, i) => {
          const stepIndex = step === "gps" ? 0 : step === "camera" || step === "submitting" ? 1 : 2;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div className={`ax-step-dot ${stepIndex === i ? "active" : stepIndex > i ? "done" : ""}`} />
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.65rem" }}>{label}</span>
            </div>
          );
        })}
      </div>

      {/* Camera view (always in DOM so videoRef is stable) */}
      <div
        className="ax-camera-container"
        style={{
          marginBottom: "1rem",
          display: (step === "camera" || step === "submitting") ? "block" : "none"
        }}
      >
        <video ref={videoRef} id="checkin-video" autoPlay playsInline muted />
        <div className="ax-camera-overlay">
          <div className={ovalClass} />
        </div>
      </div>

      {/* ── Step: GPS ── */}
      {step === "gps" && (
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "1.25rem",
            padding: "2rem 1.5rem",
            textAlign: "center",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.25rem",
          }}
        >
          <div style={{ background: "rgba(59, 130, 246, 0.15)", padding: "1rem", borderRadius: "50%", display: "inline-flex" }}>
            <MapPin size={48} style={{ color: "#3b82f6" }} />
          </div>
          <div>
            <h2 className="ax-heading" style={{ fontSize: "1.1rem", marginBottom: "0.35rem" }}>
              Joylashuvni aniqlash
            </h2>
            <p className="ax-subtext" style={{ fontSize: "0.875rem" }}>
              Filial hududida ekanligingizni tekshirish uchun joylashuvingiz kerak
            </p>
          </div>
          {errorMsg && (
            <div style={{ 
              padding: "0.75rem 1rem", 
              borderRadius: "0.75rem", 
              background: "rgba(220,38,38,0.15)", 
              border: "1px solid rgba(248,113,113,0.3)", 
              color: "#f87171", 
              fontSize: "0.85rem", 
              width: "100%", 
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem"
            }}>
              <AlertTriangle size={16} />
              {errorMsg}
            </div>
          )}
          <button
            id="request-gps-btn"
            className="ax-btn-primary"
            onClick={requestGps}
            disabled={!modelsReady}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", width: "100%" }}
          >
            {!modelsReady ? <><Loader2 size={16} className="ax-spinner" /> Yuklanmoqda...</> : <><MapPin size={16} /> Joylashuvni aniqlash</>}
          </button>
        </div>
      )}

      {/* ── Step: Camera ── */}
      {(step === "camera" || step === "submitting") && (
        <>
          <div style={{ textAlign: "center", marginBottom: "1rem" }}>
            {faceState === "no_face" && (
              <span className="ax-badge ax-badge-warning" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                <ScanFace size={12} /> Yuz aniqlanmadi — to'g'rilang
              </span>
            )}
            {faceState === "detected" && (
              <span className="ax-badge ax-badge-success" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                <CheckCircle2 size={12} /> Tayyor — tugmani bosing
              </span>
            )}
            {step === "submitting" && (
              <span className="ax-badge ax-badge-info" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                <Loader2 size={12} className="ax-spinner" /> Yuborilmoqda...
              </span>
            )}
          </div>

          {coords && (
            <p className="ax-subtext" style={{ textAlign: "center", fontSize: "0.75rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem" }}>
              <MapPin size={10} /> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          )}

          <button
            id="confirm-checkin-btn"
            className="ax-btn-primary"
            onClick={handleCapture}
            disabled={faceState !== "detected" || step === "submitting"}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
          >
            {step === "submitting" ? <><Loader2 size={16} className="ax-spinner" /> Tekshirilmoqda...</> : <><Camera size={16} /> Check In tasdiqlash</>}
          </button>
        </>
      )}

      {/* ── Step: Success ── */}
      {step === "success" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "1.25rem" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(74,222,128,0.15)", border: "2px solid #4ade80", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 size={40} style={{ color: "#4ade80" }} />
          </div>
          <div>
            {resultMsg?.split("\n").map((line, i) => (
              <p key={i} className={i === 0 ? "ax-heading" : "ax-subtext"} style={{ fontSize: i === 0 ? "1.25rem" : "0.95rem", margin: "0.25rem 0" }}>
                {line}
              </p>
            ))}
          </div>
          <Loader2 size={24} className="ax-spinner" style={{ color: "#3b82f6" }} />
        </div>
      )}

      {/* ── Step: Error ── */}
      {step === "error" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "1.25rem" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(239,68,68,0.15)", border: "2px solid #ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <XCircle size={40} style={{ color: "#ef4444" }} />
          </div>
          <div style={{ padding: "1rem", borderRadius: "1rem", background: "rgba(220,38,38,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}>
            {errorMsg}
          </div>
          <button className="ax-btn-primary" onClick={() => { setStep("gps"); setErrorMsg(null); }} id="retry-checkin-btn" style={{ width: "100%" }}>
            Qaytadan urinish
          </button>
          <button className="ax-btn-ghost" onClick={() => router.push("/home")} id="back-home-btn" style={{ width: "100%" }}>
            Bosh sahifaga qaytish
          </button>
        </div>
      )}
    </div>
  );
}
