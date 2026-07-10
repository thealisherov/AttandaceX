import React from "react";
import { History } from "lucide-react";

interface ScanLog {
  id: string;
  employeeName: string;
  action: string;
  time: string;
  status?: string;
  error?: boolean;
  warning?: boolean;
}

interface RecentScanLogsProps {
  scanLogs: ScanLog[];
}

export const RecentScanLogs: React.FC<RecentScanLogsProps> = React.memo(({ scanLogs }) => {
  return (
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
  );
});

RecentScanLogs.displayName = "RecentScanLogs";
