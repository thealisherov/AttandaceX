"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  ShieldAlert, 
  Search, 
  FileSpreadsheet,
  FileText
} from "lucide-react";
import ExcelJS from "exceljs";
import { toast } from "sonner";
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Split components
import { FinesTable } from "@/components/admin/fines/FinesTable";
import { CancelFineModal } from "@/components/admin/fines/CancelFineModal";

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

// PDF Document Component
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
      <Text style={styles.title}>iStudy Attendance - Jarimalar Hisoboti</Text>
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [branchEmployeeIds, setBranchEmployeeIds] = useState<Set<string>>(new Set());

  // Cancellation Modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedFineId, setSelectedFineId] = useState<string | null>(null);
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

      // Fines (via a server-side route — see app/api/admin/fines/route.ts)
      // and branches are independent — fetch them concurrently.
      const [finesRes, branchesRes] = await Promise.all([
        fetch("/api/admin/fines"),
        role === "super_admin"
          ? supabase.from("branches").select("id, nomi").order("nomi", { ascending: true })
          : supabase.from("admin_branches").select("branch_id, branches(id, nomi)"),
      ]);

      if (finesRes.ok) {
        const { fines: finesData } = await finesRes.json();
        setFines(finesData as Fine[]);
      } else {
        console.error("Failed to fetch fines:", await finesRes.text());
        toast.error("Jarimalarni yuklashda xatolik yuz berdi");
      }

      if (role === "super_admin") {
        if (branchesRes.data) setBranches(branchesRes.data as Branch[]);
      } else if (branchesRes.data) {
        const mappedBranches = (branchesRes.data as any[])
          .map((ab) => ab.branches)
          .filter(Boolean) as Branch[];
        setBranches(mappedBranches);
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
  const handleCancelFineSubmit = useCallback(async (reason: string) => {
    if (!selectedFineId || !reason.trim()) return;

    setCancelling(true);
    try {
      const res = await fetch("/api/admin/cancel-fine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fine_id: selectedFineId,
          izoh: reason.trim(),
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
            ? { ...f, status: "bekor_qilingan", izoh: reason.trim() }
            : f
        )
      );

      setCancelModalOpen(false);
      setSelectedFineId(null);
    } catch (err: any) {
      toast.error(err.message || "Xatolik yuz berdi");
    } finally {
      setCancelling(false);
    }
  }, [selectedFineId]);

  const openCancelModal = useCallback((fineId: string) => {
    setSelectedFineId(fineId);
    setCancelModalOpen(true);
  }, []);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("uz-UZ", {
      style: "currency",
      currency: "UZS",
      maximumFractionDigits: 0,
    }).format(amount);
  }, []);

  // Filters calculation
  const filteredFines = useMemo(() => {
    return fines.filter((f) => {
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
  }, [fines, searchQuery, statusFilter, selectedBranch, branchEmployeeIds, startDate, endDate]);

  // Excel Export Functionality
  const exportToExcel = useCallback(async () => {
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
  }, [filteredFines]);

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
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, color: "#111827", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ShieldAlert style={{ color: "#dc2626" }} /> Jarimalar boshqaruvi
          </h1>
          <p style={{ color: "#4b5563", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
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
          background: "#ffffff",
          border: "1px solid #edf2f7",
          padding: "1rem",
          borderRadius: "0.75rem",
          alignItems: "center",
          flexWrap: "wrap",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)"
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
          <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
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
          <span style={{ fontSize: "0.85rem", color: "#4b5563", fontWeight: 500 }}>Filial:</span>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={filterSelectStyle}
          >
            <option value="all">Barcha filiallar</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.nomi}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.85rem", color: "#4b5563", fontWeight: 500 }}>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={filterSelectStyle}
          >
            <option value="all">Barcha jarimalar</option>
            <option value="aktiv">Faol</option>
            <option value="bekor_qilingan">Bekor qilingan</option>
          </select>
        </div>

        {/* Date Filter (Start) */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.85rem", color: "#4b5563", fontWeight: 500 }}>Dan:</span>
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
          <span style={{ fontSize: "0.85rem", color: "#4b5563", fontWeight: 500 }}>Gacha:</span>
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
      <FinesTable
        fines={filteredFines}
        onCancel={openCancelModal}
        formatCurrency={formatCurrency}
      />

      {/* Cancellation Modal */}
      <CancelFineModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onSubmit={handleCancelFineSubmit}
        cancelling={cancelling}
      />

    </div>
  );
}

// Styling objects
const filterInputStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: "0.5rem",
  padding: "0.5rem 1rem 0.5rem 2.25rem",
  color: "#111827",
  fontSize: "0.9rem",
  outline: "none",
  width: "100%"
};

const filterSelectStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: "0.5rem",
  padding: "0.5rem 1.75rem 0.5rem 0.75rem",
  color: "#111827",
  fontSize: "0.9rem",
  outline: "none",
  cursor: "pointer",
};

const actionButtonOutlineStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  color: "#374151",
  borderRadius: "0.5rem",
  padding: "0.55rem 1rem",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  transition: "all 0.2s",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
};
