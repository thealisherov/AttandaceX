"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Camera, 
  ScanFace, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Check, 
  Search, 
  UserPlus, 
  Volume2, 
  History, 
  Building,
  UserCheck
} from "lucide-react";
import { toast } from "sonner";

type TerminalMode = "scan" | "enroll";
type ScanStatus = "idle" | "no_face" | "processing" | "success" | "unmatched" | "day_off" | "wrong_branch" | "error";

interface Branch {
  id: string;
  nomi: string;
}

interface Employee {
  id: string;
  ism: string;
  familiya: string;
  face_embedding: number[] | null;
}

interface ScanLog {
  id: string;
  employeeName: string;
  action: string;
  time: string;
  status?: string;
  error?: boolean;
  warning?: boolean;
}

export default function TerminalPage() {
  const supabase = createClient();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<number | null>(null);
  // Mutable refs so the scanning loop closure can see the latest values
  // without depending on stale React state from the closure capture.
  const scanningActiveRef = useRef(false);
  const scanStatusRef = useRef<ScanStatus>("idle");

  // State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [mode, setMode] = useState<TerminalMode>("scan");
  
  // Loading & Readiness
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  
  // Scanner state — keep ref in sync for use inside rAF loop closure
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [statusText, setStatusText] = useState("Kamera yuklanmoqda...");
  const [lastScannedName, setLastScannedName] = useState("");
  const [lastScannedAction, setLastScannedAction] = useState("");
  const [lastScannedTime, setLastScannedTime] = useState("");
  const [consecutiveFailed, setConsecutiveFailed] = useState(0);
  const [scanningActive, setScanningActive] = useState(false);

  // Helper that keeps both state and ref in sync
  const setStatus = (s: ScanStatus) => {
    scanStatusRef.current = s;
    setScanStatus(s);
  };
  const startScanning = () => {
    scanningActiveRef.current = true;
    setScanningActive(true);
  };
  const stopScanning = () => {
    scanningActiveRef.current = false;
    setScanningActive(false);
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
  };

  // Enroll state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [enrollLoading, setEnrollLoading] = useState(false);

  // Logs & settings
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [userRole, setUserRole] = useState<string>("user");

  // Load sound effects
  const playSuccessSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error(e);
    }
  }, [soundEnabled]);

  const playErrorSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.setValueAtTime(130, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
      console.error(e);
    }
  }, [soundEnabled]);

  // Load face-api.js models on mount
  useEffect(() => {
    import("@/lib/face/faceApi")
      .then(({ loadModels }) => loadModels())
      .then(() => setModelsReady(true))
      .catch((err) => {
        console.error("Failed to load models:", err);
        setStatusText("Xato: Yuz ID modellarini yuklab bo'lmadi.");
        setScanStatus("error");
      });
  }, []);

  // Fetch branches & employees
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: emp } = await supabase
        .from("employees")
        .select("rol")
        .eq("id", session.user.id)
        .single();

      if (!emp) return;
      setUserRole(emp.rol);

      // Branches fetch
      if (emp.rol === "super_admin") {
        const { data } = await supabase.from("branches").select("id, nomi").order("nomi");
        if (data) {
          setBranches(data);
          const savedBranch = localStorage.getItem("terminal_branch_id");
          if (savedBranch && data.some(b => b.id === savedBranch)) {
            setSelectedBranchId(savedBranch);
          } else if (data.length > 0) {
            setSelectedBranchId(data[0].id);
          }
        }
      } else {
        const { data } = await supabase
          .from("admin_branches")
          .select("branch_id, branches(nomi)")
          .eq("admin_id", session.user.id);
        
        if (data) {
          const list = data.map((b: any) => ({
            id: b.branch_id,
            nomi: b.branches?.nomi ?? "Noma'lum filial",
          }));
          setBranches(list);
          const savedBranch = localStorage.getItem("terminal_branch_id");
          if (savedBranch && list.some(b => b.id === savedBranch)) {
            setSelectedBranchId(savedBranch);
          } else if (list.length > 0) {
            setSelectedBranchId(list[0].id);
          }
        }
      }

      // Employees fetch for enrollment
      const { data: emps } = await supabase
        .from("employees")
        .select("id, ism, familiya, face_embedding")
        .order("ism");
      if (emps) setEmployees(emps);
    })();
  }, [supabase]);

  // Persist selected branch
  const handleBranchChange = (id: string) => {
    setSelectedBranchId(id);
    localStorage.setItem("terminal_branch_id", id);
    setScanLogs([]);
  };

  // Start video stream
  const startCamera = useCallback(async () => {
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setScanStatus("no_face");
        setStatusText("Kameraga qarang...");
      }
    } catch (err) {
      console.error("Camera error:", err);
      setStatusText("Kamera ochilmadi. Ruxsat berilganligini tekshiring.");
      setScanStatus("error");
    }
  }, []);

  // Stop video stream
  const stopCamera = useCallback(() => {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setScanStatus("idle");
    setStatusText("Kamera o'chirilgan");
  }, []);

  // Control camera based on model readiness
  useEffect(() => {
    if (modelsReady) {
      startCamera();
    }
    return () => stopCamera();
  }, [modelsReady, startCamera, stopCamera]);

  // Capture canvas image to base64
  const captureFrameBase64 = (): string => {
    if (!videoRef.current || !canvasRef.current) return "";
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    
    // Draw mirrored image
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  };

  // 1:N Scan Face API request
  const submitScan = async (embedding: number[]) => {
    setScanStatus("processing");
    setStatusText("Tekshirilmoqda...");
    
    try {
      const res = await fetch("/api/attendance/terminal-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selectedBranchId,
          faceEmbedding: embedding,
        }),
      });

      if (!res.ok) {
        throw new Error("Tizimda xatolik yuz berdi");
      }

      const data = await res.json();
      
      if (data.success && data.match) {
        // Matched successfully
        playSuccessSound();
        setScanStatus("success");
        setLastScannedName(data.employeeName);
        setLastScannedAction(
          data.action === "check-in" 
            ? `Ishga keldi (${data.status === "kechikdi" ? "Kechikdi" : "Keldi"})` 
            : data.action === "check-out"
            ? "Ishdan ketdi"
            : "Bugun allaqachon qayd etilgan"
        );
        setLastScannedTime(data.time ?? new Date().toLocaleTimeString());
        setConsecutiveFailed(0);

        setScanLogs((prev) => [
          {
            id: Math.random().toString(),
            employeeName: data.employeeName,
            action: data.action === "check-in" ? "Kirdi" : data.action === "check-out" ? "Chiqdi" : "Qayd etilgan",
            time: data.time ?? new Date().toLocaleTimeString(),
            status: data.status,
          },
          ...prev.slice(0, 9),
        ]);

        // Return to scanning state after 3 seconds, then require button press again
        setTimeout(() => {
          if (streamRef.current) {
            setStatus("no_face");
            setStatusText("Kameraga qarang...");
            stopScanning();
          }
        }, 3000);

      } else if (data.match && (data.reason === "day_off" || data.reason === "wrong_branch")) {
        // Face WAS recognized — just not a valid check-in situation right now.
        // Don't treat this as an unrecognized-face failure (no consecutive-fail
        // counting, no "yuz tanilmadi" alert).
        setScanStatus(data.reason);
        setStatusText(data.message ?? (data.reason === "day_off" ? "Bugun dam olish kuni" : "Siz bugun ushbu filialda ishlamaysiz"));

        setScanLogs((prev) => [
          {
            id: Math.random().toString(),
            employeeName: data.employeeName ?? "Xodim",
            action: data.reason === "day_off" ? "Dam olish kuni" : "Boshqa filial",
            time: new Date().toLocaleTimeString(),
            warning: true,
          },
          ...prev.slice(0, 9),
        ]);

        setTimeout(() => {
          if (streamRef.current) {
            setStatus("no_face");
            setStatusText("Kameraga qarang...");
            stopScanning();
          }
        }, 3000);
      } else {
        // No match found
        playErrorSound();
        const nextFailed = consecutiveFailed + 1;
        setConsecutiveFailed(nextFailed);
        setScanStatus("unmatched");
        setStatusText("Yuz tanilmadi. Qayta urinib ko'ring.");

        // Log to scrolling list
        setScanLogs((prev) => [
          {
            id: Math.random().toString(),
            employeeName: "Noma'lum shaxs",
            action: "Tanilmadi",
            time: new Date().toLocaleTimeString(),
            error: true,
          },
          ...prev.slice(0, 9),
        ]);

        // Check if we need to send security alert (consecutive failed >= 3)
        if (nextFailed >= 3) {
          const base64Img = captureFrameBase64();
          fetch("/api/attendance/terminal-scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              branchId: selectedBranchId,
              isAlert: true,
              alertType: "yuz_tanilmadi",
              alertImage: base64Img,
            }),
          }).catch(console.error);

          setConsecutiveFailed(0);
          setStatusText("Ketma-ket xato! Xavfsizlik xizmatiga rasm yuborildi.");
        }

        setTimeout(() => {
          if (streamRef.current) {
            setStatus("no_face");
            setStatusText("Kameraga qarang...");
            stopScanning();
          }
        }, 3000);
      }
    } catch (err) {
      console.error(err);
      playErrorSound();
      setStatus("error");
      setStatusText("Ulanish xatosi. Qaytadan urinib ko'ring.");
      
      setTimeout(() => {
        if (streamRef.current) {
          setStatus("no_face");
          setStatusText("Kameraga qarang...");
          stopScanning();
        }
      }, 3000);
    }
  };

  // Face detection + scanning loop — only starts when scanningActive, stops via ref
  useEffect(() => {
    if (!cameraActive || !modelsReady || !videoRef.current || mode !== "scan" || !scanningActive) {
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
        loopRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    let isProcessingFrame = false;
    let lastProcessedTime = 0;

    const processFrame = async () => {
      // --- KEY FIX: check the ref immediately, stop if no longer active ---
      if (!scanningActiveRef.current) {
        loopRef.current = null;
        return;
      }

      if (!streamRef.current || video.paused || video.ended) return;

      const now = Date.now();
      if (now - lastProcessedTime < 800) {
        loopRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const currentStatus = scanStatusRef.current;
      if (isProcessingFrame || currentStatus !== "no_face") {
        loopRef.current = requestAnimationFrame(processFrame);
        return;
      }

      isProcessingFrame = true;
      lastProcessedTime = now;

      try {
        const { faceapi } = await import("@/lib/face/faceApi");

        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        // Check again after the async wait — user may have already stopped
        if (!scanningActiveRef.current) return;

        if (detection) {
          // Face found with sufficient confidence — submit immediately, stop loop
          stopScanning();
          const embedding = Array.from(detection.descriptor);
          await submitScan(embedding);
        } else if (scanStatusRef.current !== "no_face") {
          setStatus("no_face");
          setStatusText("Kameraga qarang...");
        }
      } catch (err) {
        console.error("Frame processing error:", err);
      } finally {
        isProcessingFrame = false;
      }

      // Only schedule next frame if still active
      if (scanningActiveRef.current) {
        loopRef.current = requestAnimationFrame(processFrame);
      } else {
        loopRef.current = null;
      }
    };

    loopRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
        loopRef.current = null;
      }
    };
  }, [cameraActive, modelsReady, mode, selectedBranchId, playErrorSound, scanningActive]);

  // Handle Enrollment submit — captures several good-quality frames and
  // averages them into one centroid embedding for a much more stable match.
  const handleEnroll = async () => {
    if (!selectedEmployeeId || !videoRef.current || enrollLoading) return;
    setEnrollLoading(true);
    setStatusText("Namuna olinmoqda: 0/5...");

    try {
      const { captureEnrollmentSamples, averageEmbeddings, ENROLLMENT_SAMPLE_COUNT } = await import("@/lib/face/embedding");
      const samples = await captureEnrollmentSamples(videoRef.current, ENROLLMENT_SAMPLE_COUNT, (p) => {
        setStatusText(`Namuna olinmoqda: ${p.captured}/${p.total}...`);
      });

      if (!samples) {
        toast.error("Yuz aniqlanmadi yoki sifat yetarli emas. Yorug'likni yaxshilab, kameraga to'g'ri qarab qayta urinib ko'ring.");
        setStatusText("Xato: Yetarli sifatli namuna olinmadi.");
        setEnrollLoading(false);
        return;
      }

      const embedding = averageEmbeddings(samples);
      setStatusText("Saqlanmoqda...");

      const res = await fetch("/api/face/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          embedding,
        }),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        playSuccessSound();
        toast.success("Yuz muvaffaqiyatli ro'yxatga olindi!");
        
        // Update local list
        setEmployees(prev => prev.map(e => e.id === selectedEmployeeId ? { ...e, face_embedding: embedding } : e));
        setSelectedEmployeeId("");
        setMode("scan");
        setScanStatus("no_face");
        setStatusText("Kameraga qarang...");
      } else {
        playErrorSound();
        toast.error(`Ro'yxatga olish xatosi: ${data.error}`);
        setStatusText("Ro'yxatga olish bajarilmadi.");
      }
    } catch (err) {
      console.error(err);
      playErrorSound();
      toast.error("Yuzni saqlashda xatolik yuz berdi.");
      setStatusText("Xato yuz berdi.");
    } finally {
      setEnrollLoading(false);
    }
  };

  // Filter employees for enrollment
  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.ism} ${emp.familiya}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  if (userRole === "super_admin") {
    return (
      <div style={{ display: "flex", flex: 1, height: "80vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", textAlign: "center" }}>
        <AlertCircle size={48} style={{ color: "#dc2626" }} />
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827", margin: 0 }}>Ruxsat etilmagan</h2>
        <p style={{ color: "#4b5563", maxWidth: "420px", margin: 0 }}>
          Super Admin terminaldan bevosita foydalana olmaydi. Terminaldan foydalanish uchun filial admini bo'lgan hisob bilan kiring.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 1000, margin: "0 auto", width: "100%" }}>
      {/* Responsive Styles */}
      <style>{`
        .terminal-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
        .terminal-grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; }
        .camera-col { display: flex; flex-direction: column; gap: 1rem; width: 100%; max-width: 480px; margin: 0 auto; }
        @media (min-width: 768px) {
          .terminal-grid { grid-template-columns: 1fr 1fr; }
          .camera-col { max-width: 100%; }
        }
      `}</style>
      
      {/* Top Banner / Breadcrumb */}
      <div className="terminal-header">
        <div>
          <h1 className="ax-heading" style={{ fontSize: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "#111827" }}>
            <ScanFace style={{ color: "#2563eb" }} /> Filial Check-in Terminali
          </h1>
          <p className="ax-subtext" style={{ fontSize: "0.85rem", marginTop: "0.2rem", color: "#4b5563" }}>
            Xodimlarning yuzini skanerlash va davomatni avtomatik yozish tizimi.
          </p>
        </div>

        {/* Sound setting */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          style={{
            background: "#ffffff",
            border: "1px solid #d1d5db",
            borderRadius: "0.75rem",
            color: soundEnabled ? "#2563eb" : "#6b7280",
            padding: "0.5rem 0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            cursor: "pointer",
            fontSize: "0.85rem"
          }}
        >
          <Volume2 size={16} />
          {soundEnabled ? "Ovoz Yoqilgan" : "Ovoz O'chirilgan"}
        </button>
      </div>

      <div className="terminal-grid">
        
        {/* Left Side: Camera terminal screen */}
        <div className="camera-col">
          
          <div className="ax-camera-container" style={{ aspectRatio: "4/3", width: "100%", height: "auto" }}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            
            {/* Camera Overlay Face Oval */}
            <div className="ax-camera-overlay">
              <div
                className={`ax-face-oval ${
                  scanStatus === "processing"
                    ? "capturing"
                    : scanStatus === "success"
                    ? "detected"
                    : ""
                }`}
              />
            </div>

            {/* Glowing scan lines / status on screen */}
            {scanStatus === "processing" && (
              <div style={{
                position: "absolute",
                top: 0, left: 0, right: 0, height: "4px",
                background: "linear-gradient(90deg, transparent, #2563eb, transparent)",
                animation: "scanLine 1.5s linear infinite"
              }} />
            )}

            <style jsx global>{`
              @keyframes scanLine {
                0% { top: 10%; }
                50% { top: 90%; }
                100% { top: 10%; }
              }
            `}</style>
          </div>

          {/* Manual Scan Trigger Button */}
          {mode === "scan" && cameraActive && (
            <div style={{ marginTop: "0.25rem" }}>
              {scanningActive ? (
                <div style={{ background: "#eff6ff", border: "1.5px solid #93c5fd", borderRadius: "1rem", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Loader2 size={22} className="ax-spinner" style={{ color: "#2563eb", flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: "#1e40af", fontSize: "0.9rem" }}>Face ID tekshirilmoqda...</p>
                    <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "#3b82f6" }}>Kameraga to'g'ri qarang va bir oz harakatlaning</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (!selectedBranchId) {
                      toast.error("Iltimos avval filialni tanlang");
                      return;
                    }
                    setScanStatus("no_face");
                    setStatusText("Kameraga qarang...");
                    startScanning();
                  }}
                  disabled={!cameraActive || !modelsReady || !selectedBranchId}
                  style={{
                    width: "100%",
                    background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "1rem",
                    padding: "1rem 1.5rem",
                    fontSize: "1rem",
                    fontWeight: 700,
                    cursor: cameraActive && modelsReady && selectedBranchId ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.625rem",
                    boxShadow: "0 8px 20px rgba(37, 99, 235, 0.25)",
                    opacity: cameraActive && modelsReady && selectedBranchId ? 1 : 0.6,
                    letterSpacing: "-0.01em",
                  }}
                >
                  <ScanFace size={22} />
                  Face ID Tekshirishni Boshlash
                </button>
              )}
            </div>
          )}
          <div style={{
            background:
              scanStatus === "success"
                ? "#f0fdf4"
                : scanStatus === "unmatched" || scanStatus === "error"
                ? "#fef2f2"
                : scanStatus === "day_off" || scanStatus === "wrong_branch"
                ? "#fffbeb"
                : "#ffffff",
            border: `1px solid ${
              scanStatus === "success"
                ? "#bbf7d0"
                : scanStatus === "unmatched" || scanStatus === "error"
                ? "#fecaca"
                : scanStatus === "day_off" || scanStatus === "wrong_branch"
                ? "#fde68a"
                : "#edf2f7"
            }`,
            borderRadius: "1rem",
            padding: "1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.85rem",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)"
          }}>
            {scanStatus === "processing" && <Loader2 className="ax-spinner" style={{ color: "#2563eb" }} />}
            {scanStatus === "success" && <CheckCircle2 size={24} style={{ color: "#22c55e" }} />}
            {(scanStatus === "unmatched" || scanStatus === "error") && <AlertCircle size={24} style={{ color: "#ef4444" }} />}
            {(scanStatus === "day_off" || scanStatus === "wrong_branch") && <AlertCircle size={24} style={{ color: "#d97706" }} />}
            {scanStatus !== "processing" && scanStatus !== "success" && scanStatus !== "unmatched" && scanStatus !== "error" && scanStatus !== "day_off" && scanStatus !== "wrong_branch" && (
              <Camera size={24} style={{ color: "#6b7280" }} />
            )}

            <div style={{ flex: 1 }}>
              <p className="ax-subtext" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>Terminal holati</p>
              <h3 className="ax-heading" style={{ fontSize: "0.95rem", marginTop: "0.1rem", color: "#111827" }}>{statusText}</h3>
            </div>

            {scanStatus === "success" && (
              <div style={{ textAlign: "right" }}>
                <span className="ax-badge ax-badge-success">Tanishildi</span>
              </div>
            )}
          </div>

          {/* Success Banner Detail Overlay */}
          {scanStatus === "success" && (
            <div style={{
              background: "linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.02) 100%)",
              border: "1px solid #bbf7d0",
              borderRadius: "1rem",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem"
            }}>
              <h4 style={{ color: "#22c55e", fontSize: "0.9rem", fontWeight: 700 }}>Muvaffaqiyatli ro'yxatdan o'tdi</h4>
              <p style={{ fontSize: "1.2rem", fontWeight: 800, color: "#111827" }}>{lastScannedName}</p>
              <div style={{ display: "flex", gap: "1rem", fontSize: "0.85rem", color: "#4b5563" }}>
                <span>Harakat: <b>{lastScannedAction}</b></span>
                <span>Vaqt: <b>{lastScannedTime}</b></span>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Settings, Mode selection & Logs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Branch & Mode Selection Panel */}
          <div style={{
            background: "#ffffff",
            border: "1px solid #edf2f7",
            borderRadius: "1.25rem",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)"
          }}>
            
            {/* Branch Selection */}
            <div>
              <label className="ax-label" style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#4b5563" }}>
                <Building size={12} /> Filialni tanlang
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                style={{
                  width: "100%",
                  background: "#ffffff",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.75rem",
                  padding: "0.65rem 0.85rem",
                  color: "#111827",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nomi}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode selection toggle */}
            <div>
              <label className="ax-label" style={{ color: "#4b5563", marginBottom: "0.35rem", display: "block" }}>Ish rejimi</label>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                background: "#f3f4f6",
                padding: "3px",
                borderRadius: "0.75rem",
                border: "1px solid #edf2f7"
              }}>
                <button
                  onClick={() => { setMode("scan"); setScanStatus("no_face"); setStatusText("Kameraga qarang..."); }}
                  style={{
                    padding: "0.5rem",
                    borderRadius: "0.6rem",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    background: mode === "scan" ? "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)" : "transparent",
                    color: mode === "scan" ? "#fff" : "#4b5563"
                  }}
                >
                  Yo'qlama Scanneri
                </button>
                <button
                  onClick={() => { setMode("enroll"); setStatusText("Xodimni tanlang..."); setSelectedEmployeeId(""); }}
                  style={{
                    padding: "0.5rem",
                    borderRadius: "0.6rem",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    background: mode === "enroll" ? "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)" : "transparent",
                    color: mode === "enroll" ? "#fff" : "#4b5563"
                  }}
                >
                  Yangi Yuz Ro'yxatga olish
                </button>
              </div>
            </div>
          </div>

          {/* Mode-specific content panel */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            
            {mode === "scan" ? (
              // Scan Mode: List of recent logs
              <div style={{
                background: "#ffffff",
                border: "1px solid #edf2f7",
                borderRadius: "1.25rem",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                flex: 1,
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)"
              }}>
                <h3 className="ax-heading" style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "1rem", color: "#111827" }}>
                  <History size={16} style={{ color: "#2563eb" }} /> Bugungi skanerlashlar
                </h3>

                <div style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: "0.65rem", 
                  maxHeight: "260px", 
                  overflowY: "auto",
                  paddingRight: "0.25rem"
                }}>
                  {scanLogs.length === 0 ? (
                    <p className="ax-subtext" style={{ fontSize: "0.85rem", textAlign: "center", padding: "2rem 0", color: "#6b7280" }}>
                      Skanerlashlar tarixi hali bo'sh.
                    </p>
                  ) : (
                    scanLogs.map((log) => (
                      <div
                        key={log.id}
                        style={{
                          background: log.error ? "#fef2f2" : log.warning ? "#fffbeb" : "#f9fafb",
                          border: `1px solid ${log.error ? "#fecaca" : log.warning ? "#fde68a" : "#edf2f7"}`,
                          borderRadius: "0.75rem",
                          padding: "0.6rem 0.85rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <div>
                          <p style={{ fontWeight: 700, fontSize: "0.88rem", color: "#111827" }}>{log.employeeName}</p>
                          <p style={{ fontSize: "0.75rem", color: log.error ? "#ef4444" : log.warning ? "#b45309" : "#4b5563" }}>
                            {log.action} {log.status === "kechikdi" && "• Kechikdi"}
                          </p>
                        </div>
                        <span style={{
                          fontSize: "0.8rem",
                          fontVariantNumeric: "tabular-nums",
                          color: log.error ? "#ef4444" : log.warning ? "#b45309" : "#22c55e"
                        }}>
                          {log.time}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              // Enroll Mode: Employee enrollment list
              <div style={{
                background: "#ffffff",
                border: "1px solid #edf2f7",
                borderRadius: "1.25rem",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                flex: 1,
                gap: "1rem",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)"
              }}>
                <h3 className="ax-heading" style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.4rem", color: "#111827" }}>
                  <UserPlus size={16} style={{ color: "#2563eb" }} /> Ro'yxatga olish
                </h3>

                {/* Search bar */}
                <div style={{ position: "relative" }}>
                  <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                  <input
                    type="text"
                    placeholder="Xodim ismini qidiring..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      background: "#ffffff",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.75rem",
                      padding: "0.5rem 0.75rem 0.5rem 2.25rem",
                      color: "#111827",
                      outline: "none",
                      fontSize: "0.85rem"
                    }}
                  />
                </div>

                {/* Employee list */}
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  maxHeight: "180px",
                  overflowY: "auto"
                }}>
                  {filteredEmployees.map((emp) => {
                    const hasEmbedding = emp.face_embedding !== null;
                    const isSelected = selectedEmployeeId === emp.id;
                    
                    return (
                      <button
                        key={emp.id}
                        onClick={() => setSelectedEmployeeId(emp.id)}
                        style={{
                          background: isSelected 
                            ? "rgba(37, 99, 235, 0.08)" 
                            : "#f9fafb",
                          border: `1px solid ${
                            isSelected ? "rgba(37, 99, 235, 0.25)" : "#edf2f7"
                          }`,
                          borderRadius: "0.6rem",
                          padding: "0.5rem 0.75rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                          textAlign: "left",
                          color: "#111827"
                        }}
                      >
                        <div>
                          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{emp.ism} {emp.familiya}</span>
                        </div>
                        <span style={{ fontSize: "0.7rem" }}>
                          {hasEmbedding ? (
                            <span style={{ color: "#22c55e", display: "flex", alignItems: "center", gap: "0.2rem" }}>
                              <Check size={10} /> Face ID bor
                            </span>
                          ) : (
                            <span style={{ color: "#6b7280" }}>Face ID yo'q</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Submit Enrollment */}
                {selectedEmployeeId && (
                  <button
                    onClick={handleEnroll}
                    disabled={enrollLoading || !cameraActive}
                    className="ax-btn-primary"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      fontSize: "0.9rem",
                      padding: "0.75rem",
                      background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
                      boxShadow: "0 4px 12px rgba(37, 99, 235, 0.15)",
                      color: "#ffffff"
                    }}
                  >
                    {enrollLoading ? (
                      <Loader2 className="ax-spinner" />
                    ) : (
                      <UserCheck size={18} />
                    )}
                    Yuzni namuna sifatida saqlash
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Hidden Canvas for Alert Captures */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
