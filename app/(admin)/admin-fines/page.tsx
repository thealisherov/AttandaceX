"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  ShieldAlert, 
  Search, 
  MapPin, 
  X, 
  CheckCircle, 
  AlertCircle,
  FileSpreadsheet,
  FileText,
  User,
  Calendar,
  Coins,
  Ban
} from "lucide-react";
import ExcelJS from "exceljs";
import { toast } from "sonner";
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

interface Fine {
  id: string;
  employee_id: string;
  attendance_id: string | null;
  summa: number;
  sabab: string;
  status: "aktiv" | "bekor_qilingan";
  bekor_qilgan_admin_id: string | null;
  izoh: string | null;
  created_at: string;
  employees: {
    ism: string;
    familiya: string;
    telefon: string | null;
  } | null;
  attendance: {
    sana: string;
  } | null;
}

interface Branch {
  id: string;
  nomi: string;
}

// ---------------------------------------------------------------------------
// PDF Document Component
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  page: { padding: 30, backgroundColor: "#fff", fontFamily: "Helvetica" },
  title: { fontSize: 20, marginBottom: 20, textAlign: "center", fontWeight: "bold" },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 20, textAlign: "center" },
  table: { display: "flex", width: "auto", borderStyle: "solid", borderWidth: 1, borderColor: "#bfbfbf", marginBottom: 10 },
  tableRow: { flexDirection: "row" },
  tableColHeader: { width: "20%", borderStyle: "solid", borderWidth: 1, borderColor: "#bfbfbf", backgroundColor: "#e0e0e0", padding: 5 },
  tableCol: { width: "20%", borderStyle: "solid", borderWidth: 1, borderColor: "#bfbfbf", padding: 5 },
  tableCellHeader: { fontSize: 10, fontWeight: "bold" },
  tableCell: { fontSize: 9 }
});

const FinesPDFDocument = ({ fines }: { fines: Fine[] }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>AttendanceX - Jarimalar Hisoboti</Text>
      <Text style={styles.subtitle}>Sanasi: {new Date().toLocaleDateString()}</Text>
      <View style={styles.table}>
        {/* Header */}
        <View style={[styles.tableRow, { backgroundColor: "#f0f0f0" }]}>
          <View style={[styles.tableColHeader, { width: "25%" }]}><Text style={styles.tableCellHeader}>Xodim</Text></View>
          <View style={[styles.tableColHeader, { width: "15%" }]}><Text style={styles.tableCellHeader}>Sana</Text></View>
          <View style={[styles.tableColHeader, { width: "30%" }]}><Text style={styles.tableCellHeader}>Sabab</Text></View>
          <View style={[styles.tableColHeader, { width: "15%" }]}><Text style={styles.tableCellHeader}>Summa</Text></View>
          <View style={[styles.tableColHeader, { width: "15%" }]}><Text style={styles.tableCellHeader}>Status</Text></View>
        </View>
        {/* Rows */}
        {fines.map((f) => (
          <View key={f.id} style={styles.tableRow}>
            <View style={[styles.tableCol, { width: "25%" }]}>
              <Text style={styles.tableCell}>{f.employees ? `${f.employees.ism} ${f.employees.familiya}` : "Noma'lum"}</Text>
            </View>
            <View style={[styles.tableCol, { width: "15%" }]}>
              <Text style={styles.tableCell}>{f.attendance?.sana || new Date(f.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={[styles.tableCol, { width: "30%" }]}>
              <Text style={styles.tableCell}>{f.sabab}</Text>
            </View>
            <View style={[styles.tableCol, { width: "15%" }]}>
              <Text style={styles.tableCell}>{f.summa.toLocaleString()} UZS</Text>
            </View>
            <View style={[styles.tableCol, { width: "15%" }]}>
              <Text style={styles.tableCell}>{f.status === "aktiv" ? "Faol" : "Bekor qilindi"}</Text>
            </View>
          </View>
        ))}
      </View>
    </Page>
  </Document>
);

export default function AdminFines() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [fines, setFines] = useState<Fine[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userRole, setUserRole] = useState<string>("user");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all, aktiv, bekor_qilingan
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [branchEmployeeIds, setBranchEmployeeIds] = useState<Set<string>>(new Set());

  // Cancellation Modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedFineId, setSelectedFineId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // 1. Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch user role
      const { data: userProfile } = await supabase
        .from("employees")
        .select("rol")
        .eq("id", session.user.id)
        .single();
      
      const role = userProfile?.rol || "user";
      setUserRole(role);

      // Fetch fines (RLS automatically filters if not super_admin)
      const { data: finesData } = await supabase
        .from("fines")
        .select("*, employees(ism, familiya, telefon, telegram_chat_id), attendance(sana)")
        .order("created_at", { ascending: false });

      if (finesData) {
        setFines(finesData as unknown as Fine[]);
      }

      // Fetch branches
      if (role === "super_admin") {
        const { data: bData } = await supabase
          .from("branches")
          .select("id, nomi")
          .order("nomi", { ascending: true });
        if (bData) setBranches(bData as Branch[]);
      } else {
        const { data: adminBData } = await supabase
          .from("admin_branches")
          .select("branch_id, branches(id, nomi)");

        if (adminBData) {
          const mappedBranches = adminBData
            .map((ab: any) => ab.branches)
            .filter(Boolean) as Branch[];
          setBranches(mappedBranches);
        }
      }

    } catch (err) {
      console.error("Error loading fines page:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Fetch employee IDs assigned to selected branch when branch filter changes
  useEffect(() => {
    if (selectedBranch === "all") {
      setBranchEmployeeIds(new Set());
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("schedules")
        .select("employee_id")
        .eq("branch_id", selectedBranch);

      if (data) {
        const ids = new Set<string>(data.map((s) => s.employee_id));
        setBranchEmployeeIds(ids);
      }
    })();
  }, [selectedBranch]);

  // 3. Handle Cancel Fine Submission
  const handleCancelFineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFineId || !cancelReason.trim()) return;

    setCancelling(true);
    try {
      const res = await fetch("/api/admin/cancel-fine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fine_id: selectedFineId,
          izoh: cancelReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Jarima bekor qilishda xatolik yuz berdi");
      }

      toast.success("Jarima muvaffaqiyatli bekor qilindi va xodimga xabar yuborildi!");
      
      // Update local state
      setFines((prev) =>
        prev.map((f) =>
          f.id === selectedFineId
            ? { ...f, status: "bekor_qilingan", izoh: cancelReason.trim() }
            : f
        )
      );

      setCancelModalOpen(false);
      setCancelReason("");
      setSelectedFineId(null);
    } catch (err: any) {
      toast.error(err.message || "Xatolik yuz berdi");
    } finally {
      setCancelling(false);
    }
  };

  // 4. Excel Export Functionality
  const exportToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Jarimalar");

      // Set columns
      worksheet.columns = [
        { header: "Xodim", key: "xodim", width: 25 },
        { header: "Sana", key: "sana", width: 15 },
        { header: "Sabab", key: "sabab", width: 35 },
        { header: "Jarima Summasi", key: "summa", width: 20 },
        { header: "Status", key: "status", width: 18 },
        { header: "Izoh", key: "izoh", width: 30 },
      ];

      // Format Header Row
      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "2563EB" }, // Blue color
      };

      // Add Data Rows
      filteredFines.forEach((f) => {
        worksheet.addRow({
          xodim: f.employees ? `${f.employees.ism} ${f.employees.familiya}` : "Noma'lum",
          sana: f.attendance?.sana || new Date(f.created_at).toLocaleDateString(),
          sabab: f.sabab,
          summa: f.summa,
          status: f.status === "aktiv" ? "Faol" : "Bekor qilingan",
          izoh: f.izoh || "",
        });
      });

      // Format currency column
      worksheet.getColumn("summa").numFmt = '#,##0" UZS"';

      // Download trigger
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendancex_jarimalar_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Excel eksportda xatolik:", err);
      toast.error("Excel fayl yaratishda xatolik yuz berdi.");
    }
  };

  const openCancelModal = (fineId: string) => {
    setSelectedFineId(fineId);
    setCancelReason("");
    setCancelModalOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("uz-UZ", {
      style: "currency",
      currency: "UZS",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Filters calculation
  const filteredFines = fines.filter((f) => {
    const fullName = f.employees ? `${f.employees.ism} ${f.employees.familiya}`.toLowerCase() : "";
    const matchesSearch = fullName.includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || f.status === statusFilter;
    const matchesBranch = selectedBranch === "all" || branchEmployeeIds.has(f.employee_id);

    const fineDateStr = f.attendance?.sana || new Date(f.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
    const matchesDate = 
      (!startDate || fineDateStr >= startDate) && 
      (!endDate || fineDateStr <= endDate);

    return matchesSearch && matchesStatus && matchesBranch && matchesDate;
  });

  if (loading) {
    return (
      <div style={{ display: "flex", flex: 1, height: "80vh", alignItems: "center", justifyContent: "center" }}>
        <span className="ax-spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      {/* Title & Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ShieldAlert style={{ color: "#ef4444" }} /> Jarimalar boshqaruvi
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
            Xodimlarning kechikish va kelmaslik jarimalari tarixi va bekor qilish
          </p>
        </div>

        {/* Exports */}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={exportToExcel}
            style={actionButtonOutlineStyle}
          >
            <FileSpreadsheet size={16} /> Excel Eksport
          </button>
          
          <PDFDownloadLink
            document={<FinesPDFDocument fines={filteredFines} />}
            fileName={`attendancex_jarimalar_${new Date().toISOString().slice(0, 10)}.pdf`}
            style={{ textDecoration: "none" }}
          >
            {({ loading: pdfLoading }) => (
              <button style={actionButtonOutlineStyle} disabled={pdfLoading}>
                <FileText size={16} /> {pdfLoading ? "PDF tayyorlanmoqda..." : "PDF Eksport"}
              </button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Filter Row */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          padding: "1rem",
          borderRadius: "0.75rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
          <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)" }} />
          <input
            type="text"
            placeholder="Xodim ismi orqali qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={filterInputStyle}
          />
        </div>

        {/* Branch Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>Filial:</span>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={filterSelectStyle}
          >
            <option value="all" style={{ background: "#111827" }}>Barcha filiallar</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id} style={{ background: "#111827" }}>{b.nomi}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={filterSelectStyle}
          >
            <option value="all" style={{ background: "#111827" }}>Barcha jarimalar</option>
            <option value="aktiv" style={{ background: "#111827" }}>Faol</option>
            <option value="bekor_qilingan" style={{ background: "#111827" }}>Bekor qilingan</option>
          </select>
        </div>

        {/* Date Filter (Start) */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>Dan:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              ...filterInputStyle,
              paddingLeft: "0.75rem",
              width: "135px",
            }}
          />
        </div>

        {/* Date Filter (End) */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>Gacha:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              ...filterInputStyle,
              paddingLeft: "0.75rem",
              width: "135px",
            }}
          />
        </div>
      </div>

      {/* Table grid */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "1.25rem",
          padding: "1.5rem",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <th style={thStyle}>Xodim</th>
              <th style={thStyle}>Sana</th>
              <th style={thStyle}>Sabab</th>
              <th style={thStyle}>Jarima summasi</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Bekor qilinish izohi</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Amallar</th>
            </tr>
          </thead>
          <tbody>
            {filteredFines.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "3rem", textAlign: "center", color: "rgba(255,255,255,0.35)" }}>
                  Jarimalar topilmadi.
                </td>
              </tr>
            ) : (
              filteredFines.map((f) => (
                <tr key={f.id} style={trStyle}>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <User size={14} style={{ color: "#3b82f6" }} />
                      <span style={{ fontWeight: 600, color: "#fff" }}>
                        {f.employees ? `${f.employees.ism} ${f.employees.familiya}` : "Noma'lum"}
                      </span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <Calendar size={13} style={{ color: "rgba(255,255,255,0.4)" }} />
                      <span>{f.attendance?.sana || new Date(f.created_at).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>{f.sabab}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontWeight: 700, color: f.status === "bekor_qilingan" ? "rgba(255,255,255,0.3)" : "#ef4444", textDecoration: f.status === "bekor_qilingan" ? "line-through" : "none" }}>
                      <Coins size={14} />
                      {formatCurrency(f.summa)}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {f.status === "aktiv" ? (
                      <span className="ax-badge ax-badge-error" style={{ fontSize: "0.68rem" }}>Faol</span>
                    ) : (
                      <span className="ax-badge ax-badge-info" style={{ fontSize: "0.68rem" }}>Bekor qilingan</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, color: "rgba(255,255,255,0.45)", fontSize: "0.825rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.izoh || "—"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {f.status === "aktiv" && (
                      <button
                        onClick={() => openCancelModal(f.id)}
                        style={cancelBtnStyle}
                      >
                        <Ban size={13} /> Bekor qilish
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cancellation Modal */}
      {cancelModalOpen && (
        <div style={modalOverlayStyle} onClick={() => setCancelModalOpen(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 750, margin: 0, color: "#fff" }}>
                Jarimani bekor qilish
              </h2>
              <button onClick={() => setCancelModalOpen(false)} style={closeBtnStyle}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleCancelFineSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label style={labelStyle}>Bekor qilish sababi (Xodimning Telegramiga yuboriladi)</label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Masalan: Tizim xatoligi tufayli / Sababli kechikish..."
                  style={textareaStyle}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setCancelModalOpen(false)} style={modalCancelBtnStyle}>Bekor qilish</button>
                <button type="submit" disabled={cancelling} style={modalSubmitBtnStyle}>
                  {cancelling ? "Saqlanmoqda..." : "Tasdiqlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// Styling objects
const thStyle: React.CSSProperties = {
  padding: "0.85rem 1rem",
  color: "rgba(255, 255, 255, 0.4)",
  fontWeight: 600,
  fontSize: "0.8rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const trStyle: React.CSSProperties = {
  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
  transition: "background 0.2s",
};

const tdStyle: React.CSSProperties = {
  padding: "1rem",
  fontSize: "0.875rem",
  color: "rgba(255, 255, 255, 0.75)",
};

const filterInputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.2)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "0.5rem",
  padding: "0.5rem 1rem 0.5rem 2.25rem",
  color: "#fff",
  fontSize: "0.9rem",
  outline: "none",
};

const filterSelectStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.2)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "0.5rem",
  padding: "0.5rem 1.75rem 0.5rem 0.75rem",
  color: "#fff",
  fontSize: "0.9rem",
  outline: "none",
  cursor: "pointer",
};

const actionButtonOutlineStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  color: "#fff",
  borderRadius: "0.5rem",
  padding: "0.55rem 1rem",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  transition: "all 0.2s",
};

const cancelBtnStyle: React.CSSProperties = {
  background: "rgba(239, 68, 68, 0.12)",
  color: "#f87171",
  border: "1px solid rgba(239, 68, 68, 0.2)",
  borderRadius: "0.4rem",
  padding: "0.4rem 0.75rem",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  transition: "all 0.2s",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.6)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "1.25rem",
  width: "100%",
  maxWidth: "460px",
  padding: "1.75rem",
  color: "#fff",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  color: "rgba(255, 255, 255, 0.45)",
  marginBottom: "0.4rem",
  fontWeight: 500,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(0, 0, 0, 0.25)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "0.5rem",
  padding: "0.75rem",
  color: "#fff",
  fontSize: "0.9rem",
  outline: "none",
  resize: "vertical",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "rgba(255, 255, 255, 0.4)",
  cursor: "pointer",
  padding: "0.25rem",
};

const modalCancelBtnStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.03)",
  color: "#fff",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "0.5rem",
  padding: "0.625rem 1.25rem",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
};

const modalSubmitBtnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
  color: "#fff",
  border: "none",
  borderRadius: "0.5rem",
  padding: "0.625rem 1.25rem",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(239, 68, 68, 0.25)",
};
