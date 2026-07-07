"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Coins, AlertTriangle, CheckCircle, Info, Calendar } from "lucide-react";
import EmployeeHeader from "../EmployeeHeader";

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

    const monthsUzShort = [
      "Jan", "Fev", "Mar", "Apr", "May", "Iyun",
      "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"
    ];

    return `${day} ${monthsUzShort[monthIndex]} ${year}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US").format(amount);
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="ax-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8fafc", minHeight: "100vh" }}>
      <EmployeeHeader title="Mening jarimalarim" />
      
      <div style={{ display: "flex", flexDirection: "column", padding: "1.25rem", maxWidth: 480, margin: "0 auto", width: "100%", gap: "1.25rem" }}>
        {/* Top Summary Card */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "1.25rem",
            padding: "1.5rem",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.02), 0 2px 8px rgba(0, 0, 0, 0.01)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
            border: "1px solid #f1f5f9",
          }}
        >
          <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", fontWeight: 700 }}>
            SHU OYDA JAMI
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
            <span style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
              {formatCurrency(totals.activeSum)}
            </span>
            <span style={{ fontSize: "0.95rem", color: "#64748b", fontWeight: 500 }}>
              so'm
            </span>
          </div>
        </div>

        {/* Section Title */}
        <div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.75rem 0" }}>Tarix</h2>
        </div>

        {/* Fines List */}
        {fines.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "1.25rem",
              padding: "3rem 1.5rem",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.01)"
            }}
          >
            <Coins size={36} style={{ color: "#94a3b8" }} />
            <p style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Sizda jarimalar mavjud emas</p>
            <p style={{ fontSize: "0.8rem", maxWidth: 280, color: "#64748b", margin: 0 }}>
              Intizom va ish vaqtlariga amal qilganingiz uchun tashakkur!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingBottom: "2rem" }}>
            {fines.map((record) => {
              const isCancelled = record.status === "bekor_qilingan";

              return (
                <div
                  key={record.id}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "1rem",
                    padding: "1.25rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.01)",
                    transition: "transform 0.2s ease",
                  }}
                >
                  {/* Left Column info */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: 1, paddingRight: "1rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>
                      {formatDate(record.created_at)}
                    </span>
                    <h3
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        margin: 0,
                        textDecoration: isCancelled ? "line-through" : "none",
                        color: isCancelled ? "#94a3b8" : "#0f172a",
                        lineHeight: 1.3
                      }}
                    >
                      {record.sabab}
                      {isCancelled && " (Kechirim qilingan)"}
                    </h3>
                    <div style={{ display: "flex", marginTop: "0.1rem" }}>
                      {isCancelled ? (
                        <span
                          style={{
                            background: "#f1f5f9",
                            color: "#64748b",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.6rem",
                            borderRadius: "2rem",
                          }}
                        >
                          Bekor qilingan
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "#fee2e2",
                            color: "#ef4444",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.6rem",
                            borderRadius: "2rem",
                          }}
                        >
                          Faol
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column amount */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                    <span
                      style={{
                        color: isCancelled ? "#94a3b8" : "#ef4444",
                        fontWeight: 750,
                        fontSize: "1.05rem",
                        textDecoration: isCancelled ? "line-through" : "none",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {formatCurrency(record.summa)} so'm
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
