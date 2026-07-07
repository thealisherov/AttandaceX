"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Coins, AlertTriangle, CheckCircle, Info, Calendar } from "lucide-react";

interface FineRecord {
  id: string;
  summa: number;
  sabab: string;
  status: "aktiv" | "bekor_qilingan";
  izoh: string | null;
  created_at: string;
}

export default function FinesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [fines, setFines] = useState<FineRecord[]>([]);
  const [totals, setTotals] = useState({
    activeSum: 0,
    cancelledCount: 0,
  });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const userId = session.user.id;

      const { data, error } = await supabase
        .from("fines")
        .select("id, summa, sabab, status, izoh, created_at")
        .eq("employee_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching fines history:", error);
      } else if (data) {
        setFines(data as unknown as FineRecord[]);

        let activeSum = 0;
        let cancelledCount = 0;
        data.forEach((fine) => {
          if (fine.status === "aktiv") {
            activeSum += Number(fine.summa);
          } else {
            cancelledCount++;
          }
        });

        setTotals({ activeSum, cancelledCount });
      }

      setLoading(false);
    })();
  }, [supabase, router]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate();
    const monthIndex = d.getMonth();
    const year = d.getFullYear();

    const monthsUz = [
      "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
      "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"
    ];

    return `${day}-${monthsUz[monthIndex]}, ${year}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("uz-UZ", {
      style: "currency",
      currency: "UZS",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="ax-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
      
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 className="ax-heading" style={{ fontSize: "1.5rem", marginBottom: "0.25rem", color: "#111827" }}>Jarimalar tarixi</h1>
        <p className="ax-subtext" style={{ fontSize: "0.85rem", color: "#4b5563" }}>Kechikish va kelmaslik uchun hisoblangan jarimalar</p>
      </div>

      {/* Summary Stats */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        
        {/* Active Fines Total */}
        <div
          style={{
            flex: 1,
            background: "rgba(220, 38, 38, 0.05)",
            border: "1px solid #fecaca",
            borderRadius: "1rem",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <p className="ax-subtext" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.02em", color: "#b91c1c", fontWeight: 600 }}>
            Faol jarimalar summasi
          </p>
          <p style={{ color: "#dc2626", fontSize: "1.3rem", fontWeight: 800, marginTop: "0.15rem" }}>
            {formatCurrency(totals.activeSum)}
          </p>
        </div>

        {/* Cancelled Fines Count */}
        <div
          style={{
            flex: 1,
            background: "#ffffff",
            border: "1px solid #edf2f7",
            borderRadius: "1rem",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)"
          }}
        >
          <p className="ax-subtext" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.02em", color: "#6b7280", fontWeight: 600 }}>
            Bekor qilinganlar
          </p>
          <p style={{ color: "#111827", fontSize: "1.3rem", fontWeight: 800, marginTop: "0.15rem" }}>
            {totals.cancelledCount} ta
          </p>
        </div>

      </div>

      {/* Fines List */}
      {fines.length === 0 ? (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #edf2f7",
            borderRadius: "1rem",
            padding: "2.5rem 1.5rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.75rem",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.03)"
          }}
        >
          <Coins size={36} style={{ color: "#9ca3af" }} />
          <p className="ax-heading" style={{ fontSize: "1rem", color: "#111827" }}>Sizda jarimalar mavjud emas</p>
          <p className="ax-subtext" style={{ fontSize: "0.8rem", maxWidth: 280, color: "#6b7280" }}>
            Intizom va ish vaqtlariga amal qilganingiz uchun tashakkur!
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {fines.map((record) => {
            const isCancelled = record.status === "bekor_qilingan";

            return (
              <div
                key={record.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #edf2f7",
                  borderRadius: "1rem",
                  padding: "1rem 1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  opacity: isCancelled ? 0.65 : 1,
                  position: "relative",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)"
                }}
              >
                {/* Top Row: Reason and Badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 
                      className="ax-heading" 
                      style={{ 
                        fontSize: "0.95rem",
                        textDecoration: isCancelled ? "line-through" : "none",
                        color: isCancelled ? "#9ca3af" : "#111827"
                      }}
                    >
                      {record.sabab}
                    </h3>
                    <p className="ax-subtext" style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.15rem", color: "#6b7280" }}>
                      <Calendar size={11} /> {formatDate(record.created_at)}
                    </p>
                  </div>
                  <div>
                    {isCancelled ? (
                      <span className="ax-badge ax-badge-info" style={{ fontSize: "0.68rem" }}>
                        <CheckCircle size={10} /> Bekor qilindi
                      </span>
                    ) : (
                      <span className="ax-badge ax-badge-error" style={{ fontSize: "0.68rem" }}>
                        <AlertTriangle size={10} /> Faol
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Amount & Details */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTop: "1px solid #edf2f7",
                    paddingTop: "0.5rem",
                    marginTop: "0.25rem",
                  }}
                >
                  <span className="ax-subtext" style={{ fontSize: "0.78rem", color: "#6b7280" }}>Jarima summasi:</span>
                  <span 
                    style={{ 
                      color: isCancelled ? "#9ca3af" : "#dc2626", 
                      fontWeight: 700, 
                      fontSize: "1.05rem",
                      textDecoration: isCancelled ? "line-through" : "none"
                    }}
                  >
                    {formatCurrency(record.summa)}
                  </span>
                </div>

                {/* Cancellation Note */}
                {isCancelled && record.izoh && (
                  <div
                    style={{
                      background: "#f9fafb",
                      border: "1px solid #edf2f7",
                      borderRadius: "0.5rem",
                      padding: "0.5rem 0.75rem",
                      marginTop: "0.25rem",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.35rem",
                    }}
                  >
                    <Info size={12} style={{ color: "#9ca3af", flexShrink: 0, marginTop: "0.1rem" }} />
                    <p style={{ color: "#6b7280", fontSize: "0.72rem", margin: 0 }}>
                      <strong style={{ color: "#4b5563" }}>Izoh:</strong> {record.izoh}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
