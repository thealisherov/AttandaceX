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
type ScanStatus = "idle" | "no_face" | "liveness" | "processing" | "success" | "unmatched" | "liveness_failed" | "error";

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
}

export default function TerminalPage() {
  const supabase = createClient();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<number | null>(null);
  const landmarksHistoryRef = useRef<{ x: number; y: number }[][]>([]);

  // State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [mode, setMode] = useState<TerminalMode>("scan");
  
  // Loading & Readiness
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  
  // Scanner state
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [statusText, setStatusText] = useState("Kamera yuklanmoqda...");
  const [lastScannedName, setLastScannedName] = useState("");
  const [lastScannedAction, setLastScannedAction] = useState("");
  const [lastScannedTime, setLastScannedTime] = useState("");
  const [consecutiveFailed, setConsecutiveFailed] = useState(0);

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

        // Return to scanning state after 3 seconds
        setTimeout(() => {
          if (streamRef.current) {
            setScanStatus("no_face");
            setStatusText("Kameraga qarang...");
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
            setScanStatus("no_face");
            setStatusText("Kameraga qarang...");
          }
        }, 3000);
      }
    } catch (err) {
      console.error(err);
      playErrorSound();
      setScanStatus("error");
      setStatusText("Ulanish xatosi. Qaytadan urinib ko'ring.");
      
      setTimeout(() => {
        if (streamRef.current) {
          setScanStatus("no_face");
          setStatusText("Kameraga qarang...");
        }
      }, 3000);
    }
  };

  // Liveness detection and scanning loop
  useEffect(() => {
    if (!cameraActive || !modelsReady || !videoRef.current || mode !== "scan") {
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
      if (!streamRef.current || video.paused || video.ended) return;

      const now = Date.now();
      // Process every 800ms to avoid overloading the CPU while maintaining high responsiveness
      if (now - lastProcessedTime < 800) {
        loopRef.current = requestAnimationFrame(processFrame);
        return;
      }

      if (isProcessingFrame || scanStatus === "processing" || scanStatus === "success" || scanStatus === "unmatched" || scanStatus === "liveness_failed") {
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

        if (detection) {
          // Face found
          const landmarkPoints = detection.landmarks.positions.map(p => ({ x: p.x, y: p.y }));
          
          if (scanStatus === "no_face" || scanStatus === "idle") {
            setScanStatus("liveness");
            setStatusText("Liveness tekshirilmoqda. Iltimos, qimirlang...");
            landmarksHistoryRef.current = [landmarkPoints];
          } else if (scanStatus === "liveness") {
            const history = landmarksHistoryRef.current;
            history.push(landmarkPoints);

            // Accumulate landmarks changes over 3 frames
            if (history.length >= 3) {
              // Calculate variation in landmarks to verify it's a moving human (liveness)
              let totalVariance = 0;
              const pointsCount = landmarkPoints.length;

              for (let i = 0; i < pointsCount; i++) {
                const xCoords = history.map(h => h[i].x);
                const yCoords = history.map(h => h[i].y);
                
                const avgX = xCoords.reduce((a, b) => a + b, 0) / xCoords.length;
                const avgY = yCoords.reduce((a, b) => a + b, 0) / yCoords.length;
                
                const varX = xCoords.reduce((sum, val) => sum + (val - avgX) ** 2, 0);
                const varY = yCoords.reduce((sum, val) => sum + (val - avgY) ** 2, 0);
                
                totalVariance += Math.sqrt(varX + varY);
              }

              const avgMovement = totalVariance / pointsCount;
              
              // Liveness test:
              // Static photo has very low variation (< 0.1px average movement).
              // Active face has micro movements (typically 0.3px to 10px).
              if (avgMovement < 0.05) {
                // Fails liveness
                playErrorSound();
                setScanStatus("liveness_failed");
                setStatusText("Liveness xatosi! (Statik tasvir aniqlandi)");
                
                const base64Img = captureFrameBase64();
                fetch("/api/attendance/terminal-scan", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    branchId: selectedBranchId,
                    isAlert: true,
                    alertType: "liveness_xato",
                    alertImage: base64Img,
                  }),
                }).catch(console.error);

                setTimeout(() => {
                  if (streamRef.current) {
                    setScanStatus("no_face");
                    setStatusText("Kameraga qarang...");
                  }
                }, 4000);

              } else {
                // Passes liveness -> proceed to scan match!
                const embedding = Array.from(detection.descriptor);
                await submitScan(embedding);
              }

              landmarksHistoryRef.current = [];
            }
          }
        } else {
          // No face detected
          if (scanStatus !== "no_face") {
            setScanStatus("no_face");
            setStatusText("Kameraga qarang...");
            landmarksHistoryRef.current = [];
          }
        }
      } catch (err) {
        console.error("Frame processing error:", err);
      } finally {
        isProcessingFrame = false;
      }

      loopRef.current = requestAnimationFrame(processFrame);
    };

    loopRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
        loopRef.current = null;
      }
    };
  }, [cameraActive, modelsReady, scanStatus, mode, selectedBranchId, playErrorSound]);

  // Handle Enrollment submit
  const handleEnroll = async () => {
    if (!selectedEmployeeId || !videoRef.current || enrollLoading) return;
    setEnrollLoading(true);
    setStatusText("Yuz tahlil qilinmoqda...");
    
    try {
      const { getEmbeddingFromVideo } = await import("@/lib/face/embedding");
      const embedding = await getEmbeddingFromVideo(videoRef.current);
      
      if (!embedding) {
        toast.error("Yuz aniqlanmadi. Iltimos, kameraga to'g'ri qarang.");
        setStatusText("Xato: Yuz aniqlanmadi.");
        setEnrollLoading(false);
        return;
      }

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
        <AlertCircle size={48} style={{ color: "#ef4444" }} />
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", margin: 0 }}>Ruxsat etilmagan</h2>
        <p style={{ color: "rgba(255, 255, 255, 0.6)", maxWidth: "420px", margin: 0 }}>
          Super Admin terminaldan bevosita foydalana olmaydi. Terminaldan foydalanish uchun filial admini bo'lgan hisob bilan kiring.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 1000, margin: "0 auto", width: "100%" }}>
      
      {/* Top Banner / Breadcrumb */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="ax-heading" style={{ fontSize: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ScanFace style={{ color: "#3b82f6" }} /> Filial Check-in Terminali
          </h1>
          <p className="ax-subtext" style={{ fontSize: "0.85rem", marginTop: "0.2rem" }}>
            Xodimlarning yuzini skanerlash va davomatni avtomatik yozish tizimi.
          </p>
        </div>

        {/* Sound setting */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "0.75rem",
            color: soundEnabled ? "#3b82f6" : "rgba(255,255,255,0.4)",
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        
        {/* Left Side: Camera terminal screen */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          
          <div className="ax-camera-container" style={{ aspectRatio: "4/3", maxWidth: "400px", height: "auto" }}>
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
                  scanStatus === "processing" || scanStatus === "liveness"
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
                background: "linear-gradient(90deg, transparent, #3b82f6, transparent)",
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

          {/* Status Display Card below camera */}
          <div style={{
            background: 
              scanStatus === "success" 
                ? "rgba(22, 163, 74, 0.1)" 
                : scanStatus === "unmatched" || scanStatus === "liveness_failed"
                ? "rgba(220, 38, 38, 0.1)"
                : "rgba(255, 255, 255, 0.05)",
            border: `1px solid ${
              scanStatus === "success" 
                ? "rgba(74, 222, 128, 0.25)" 
                : scanStatus === "unmatched" || scanStatus === "liveness_failed"
                ? "rgba(248, 113, 113, 0.25)"
                : "rgba(255, 255, 255, 0.1)"
            }`,
            borderRadius: "1rem",
            padding: "1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.85rem"
          }}>
            {scanStatus === "processing" && <Loader2 className="ax-spinner" style={{ color: "#3b82f6" }} />}
            {scanStatus === "success" && <CheckCircle2 size={24} style={{ color: "#4ade80" }} />}
            {(scanStatus === "unmatched" || scanStatus === "liveness_failed" || scanStatus === "error") && <AlertCircle size={24} style={{ color: "#f87171" }} />}
            {scanStatus !== "processing" && scanStatus !== "success" && scanStatus !== "unmatched" && scanStatus !== "liveness_failed" && scanStatus !== "error" && (
              <Camera size={24} style={{ color: "rgba(255,255,255,0.4)" }} />
            )}

            <div style={{ flex: 1 }}>
              <p className="ax-subtext" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Terminal holati</p>
              <h3 className="ax-heading" style={{ fontSize: "0.95rem", marginTop: "0.1rem" }}>{statusText}</h3>
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
              background: "linear-gradient(135deg, rgba(22,163,74,0.2) 0%, rgba(22,163,74,0.05) 100%)",
              border: "1px solid rgba(74,222,128,0.3)",
              borderRadius: "1rem",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem"
            }}>
              <h4 style={{ color: "#4ade80", fontSize: "0.9rem", fontWeight: 700 }}>Muvaffaqiyatli ro'yxatdan o'tdi</h4>
              <p style={{ fontSize: "1.2rem", fontWeight: 800 }}>{lastScannedName}</p>
              <div style={{ display: "flex", gap: "1rem", fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>
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
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "1.25rem",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem"
          }}>
            
            {/* Branch Selection */}
            <div>
              <label className="ax-label" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <Building size={12} /> Filialni tanlang
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                style={{
                  width: "100%",
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "0.75rem",
                  padding: "0.65rem 0.85rem",
                  color: "#fff",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} style={{ background: "#0f172a", color: "#fff" }}>
                    {b.nomi}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode selection toggle */}
            <div>
              <label className="ax-label">Ish rejimi</label>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                background: "rgba(0,0,0,0.2)",
                padding: "3px",
                borderRadius: "0.75rem",
                border: "1px solid rgba(255,255,255,0.08)"
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
                    background: mode === "scan" ? "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)" : "transparent",
                    color: mode === "scan" ? "#fff" : "rgba(255,255,255,0.6)"
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
                    background: mode === "enroll" ? "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)" : "transparent",
                    color: mode === "enroll" ? "#fff" : "rgba(255,255,255,0.6)"
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
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: "1.25rem",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                flex: 1
              }}>
                <h3 className="ax-heading" style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "1rem" }}>
                  <History size={16} style={{ color: "#3b82f6" }} /> Bugungi skanerlashlar
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
                    <p className="ax-subtext" style={{ fontSize: "0.85rem", textAlign: "center", padding: "2rem 0" }}>
                      Skanerlashlar tarixi hali bo'sh.
                    </p>
                  ) : (
                    scanLogs.map((log) => (
                      <div
                        key={log.id}
                        style={{
                          background: log.error ? "rgba(220,38,38,0.08)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${log.error ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.08)"}`,
                          borderRadius: "0.75rem",
                          padding: "0.6rem 0.85rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <div>
                          <p style={{ fontWeight: 700, fontSize: "0.88rem" }}>{log.employeeName}</p>
                          <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>
                            {log.action} {log.status === "kechikdi" && "• Kechikdi"}
                          </p>
                        </div>
                        <span style={{ 
                          fontSize: "0.8rem", 
                          fontVariantNumeric: "tabular-nums", 
                          color: log.error ? "#f87171" : "#4ade80" 
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
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: "1.25rem",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                flex: 1,
                gap: "1rem"
              }}>
                <h3 className="ax-heading" style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <UserPlus size={16} style={{ color: "#3b82f6" }} /> Ro'yxatga olish
                </h3>

                {/* Search bar */}
                <div style={{ position: "relative" }}>
                  <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)" }} />
                  <input
                    type="text"
                    placeholder="Xodim ismini qidiring..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "0.75rem",
                      padding: "0.5rem 0.75rem 0.5rem 2.25rem",
                      color: "#fff",
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
                            ? "rgba(59, 130, 246, 0.15)" 
                            : "rgba(255,255,255,0.03)",
                          border: `1px solid ${
                            isSelected ? "rgba(96,165,250,0.4)" : "rgba(255,255,255,0.06)"
                          }`,
                          borderRadius: "0.6rem",
                          padding: "0.5rem 0.75rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                          textAlign: "left",
                          color: "#fff"
                        }}
                      >
                        <div>
                          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{emp.ism} {emp.familiya}</span>
                        </div>
                        <span style={{ fontSize: "0.7rem" }}>
                          {hasEmbedding ? (
                            <span style={{ color: "#4ade80", display: "flex", alignItems: "center", gap: "0.2rem" }}>
                              <Check size={10} /> Face ID bor
                            </span>
                          ) : (
                            <span style={{ color: "rgba(255,255,255,0.4)" }}>Face ID yo'q</span>
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
                      padding: "0.75rem"
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
