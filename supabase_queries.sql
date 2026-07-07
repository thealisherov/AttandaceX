-- =========================================================================
-- ATTENDANCEX - SUPABASE DATABASE QUERIES & SCHEMA DEFINITIONS
-- =========================================================================
-- Ushbu faylda loyiha boshidan boshlab Supabase ma'lumotlar bazasida
-- bajarilgan barcha SQL so'rovlari (jadval yaratish, enumlar, indekslar,
-- RLS qoidalari va super_admin seeder/tozalash so'rovlari) jamlangan.
-- =========================================================================

-- Custom Enums
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'user');
CREATE TYPE attendance_status AS ENUM ('keldi', 'kechikdi', 'kelmadi');
CREATE TYPE fine_status AS ENUM ('aktiv', 'bekor_qilingan');
CREATE TYPE security_alert_type AS ENUM ('yuz_mos_kelmadi', 'gps_buzildi');

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: employees
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ism VARCHAR(255) NOT NULL,
    familiya VARCHAR(255) NOT NULL,
    telegram_username VARCHAR(255),
    telegram_chat_id BIGINT UNIQUE,
    telefon VARCHAR(20),
    face_embedding JSONB,
    rol user_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: branches
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nomi VARCHAR(255) NOT NULL,
    manzil TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    radius_metr INTEGER NOT NULL DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: admin_branches
CREATE TABLE admin_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(admin_id, branch_id)
);

-- Table: schedules
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    hafta_kuni INTEGER NOT NULL CHECK (hafta_kuni >= 0 AND hafta_kuni <= 6),
    kelish_vaqti TIME,
    ketish_vaqti TIME,
    is_dayoff BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(employee_id, hafta_kuni)
);

-- Table: schedule_overrides
CREATE TABLE schedule_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    sana DATE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    turi VARCHAR(50) NOT NULL,
    izoh TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(employee_id, sana)
);

-- Table: attendance
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    sana DATE NOT NULL,
    check_in_vaqti TIMESTAMP WITH TIME ZONE,
    check_out_vaqti TIMESTAMP WITH TIME ZONE,
    status attendance_status NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    face_match_score DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(employee_id, sana)
);

-- Table: fines
CREATE TABLE fines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE,
    summa NUMERIC(10, 2) NOT NULL,
    sabab TEXT NOT NULL,
    status fine_status NOT NULL DEFAULT 'aktiv',
    bekor_qilgan_admin_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    izoh TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: fine_rules
CREATE TABLE fine_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    min_daqiqa INTEGER NOT NULL,
    max_daqiqa INTEGER,
    summa NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: security_alerts
CREATE TABLE security_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    turi security_alert_type NOT NULL,
    rasm_url TEXT,
    vaqt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: telegram_auth_sessions
CREATE TABLE telegram_auth_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    otp_code VARCHAR(10) NOT NULL,
    chat_id BIGINT NOT NULL,
    telegram_id BIGINT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    user_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_attendance_employee_sana ON attendance(employee_id, sana);
CREATE INDEX idx_schedules_employee ON schedules(employee_id);
CREATE INDEX idx_admin_branches_admin ON admin_branches(admin_id);
CREATE INDEX idx_admin_branches_branch ON admin_branches(branch_id);

-- Enable RLS on all tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fine_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_auth_sessions ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
-- NOTE: Must live in public schema — Supabase forbids creating functions in the auth schema.
-- SECURITY DEFINER + search_path = public ensures it can read public.employees safely.
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol::text FROM public.employees WHERE id = auth.uid() LIMIT 1;
$$;

-- Employees Table Policies
CREATE POLICY "Super admin has full access to employees" ON employees
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view employees in their branches" ON employees
  FOR SELECT USING (
    public.user_role() = 'admin' AND
    EXISTS (
      SELECT 1 FROM admin_branches ab
      JOIN schedules s ON s.branch_id = ab.branch_id
      WHERE ab.admin_id = auth.uid() AND s.employee_id = employees.id
    )
  );

CREATE POLICY "User can view their own profile" ON employees
  FOR SELECT USING (auth.uid() = id);

-- Branches Table Policies
CREATE POLICY "Super admin has full access to branches" ON branches
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view all branches" ON branches
  FOR SELECT USING (public.user_role() = 'admin');

-- Admin Branches Table Policies
CREATE POLICY "Super admin has full access to admin_branches" ON admin_branches
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view their own branch assignments" ON admin_branches
  FOR SELECT USING (auth.uid() = admin_id);

-- Schedules Table Policies
CREATE POLICY "Super admin has full access to schedules" ON schedules
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view and edit schedules in their branches" ON schedules
  FOR ALL USING (
    public.user_role() = 'admin' AND
    branch_id IN (SELECT branch_id FROM admin_branches WHERE admin_id = auth.uid())
  );

CREATE POLICY "User can view their own schedules" ON schedules
  FOR SELECT USING (employee_id = auth.uid());

-- Schedule Overrides Table Policies
CREATE POLICY "Super admin has full access to schedule_overrides" ON schedule_overrides
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view and edit overrides in their branches" ON schedule_overrides
  FOR ALL USING (
    public.user_role() = 'admin' AND
    (
      branch_id IN (SELECT branch_id FROM admin_branches WHERE admin_id = auth.uid()) OR
      EXISTS (
        SELECT 1 FROM schedules s
        WHERE s.employee_id = schedule_overrides.employee_id
          AND s.branch_id IN (SELECT branch_id FROM admin_branches WHERE admin_id = auth.uid())
      )
    )
  );

CREATE POLICY "User can view their own schedule overrides" ON schedule_overrides
  FOR SELECT USING (employee_id = auth.uid());

-- Attendance Table Policies
CREATE POLICY "Super admin has full access to attendance" ON attendance
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view attendance in their branches" ON attendance
  FOR SELECT USING (
    public.user_role() = 'admin' AND
    branch_id IN (SELECT branch_id FROM admin_branches WHERE admin_id = auth.uid())
  );

CREATE POLICY "User can view their own attendance" ON attendance
  FOR SELECT USING (employee_id = auth.uid());

-- Users can insert their own attendance (usually done via service_role/edge function, but if client does it)
CREATE POLICY "User can insert their own attendance" ON attendance
  FOR INSERT WITH CHECK (employee_id = auth.uid());

-- Fines Table Policies
CREATE POLICY "Super admin has full access to fines" ON fines
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view and edit fines in their branches" ON fines
  FOR ALL USING (
    public.user_role() = 'admin' AND
    EXISTS (
      SELECT 1 FROM attendance a
      WHERE a.id = fines.attendance_id
        AND a.branch_id IN (SELECT branch_id FROM admin_branches WHERE admin_id = auth.uid())
    )
  );

CREATE POLICY "User can view their own fines" ON fines
  FOR SELECT USING (employee_id = auth.uid());

-- Fine Rules Table Policies
CREATE POLICY "Super admin has full access to fine_rules" ON fine_rules
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view and edit fine rules in their branches" ON fine_rules
  FOR ALL USING (
    public.user_role() = 'admin' AND
    (branch_id IS NULL OR branch_id IN (SELECT branch_id FROM admin_branches WHERE admin_id = auth.uid()))
  );

CREATE POLICY "User can view fine rules" ON fine_rules
  FOR SELECT USING (true);

-- Security Alerts Table Policies
CREATE POLICY "Super admin has full access to security_alerts" ON security_alerts
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "Admin can view security alerts in their branches" ON security_alerts
  FOR SELECT USING (
    public.user_role() = 'admin' AND
    EXISTS (
      SELECT 1 FROM schedules s
      WHERE s.employee_id = security_alerts.employee_id
        AND s.branch_id IN (SELECT branch_id FROM admin_branches WHERE admin_id = auth.uid())
    )
  );

-- Telegram Auth Sessions Indexes & Configuration
-- Add expires_at column for OTP TTL (5 minutes by default)
ALTER TABLE telegram_auth_sessions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE
    NOT NULL DEFAULT (timezone('utc'::text, now()) + INTERVAL '5 minutes');

-- Index: quickly find a pending session by OTP code + telegram_id
CREATE INDEX IF NOT EXISTS idx_tas_otp_tgid
  ON telegram_auth_sessions (otp_code, telegram_id)
  WHERE status = 'pending';

-- Index: quickly find sessions by telegram_id (for "Get Code" deduplication)
CREATE INDEX IF NOT EXISTS idx_tas_telegram_id
  ON telegram_auth_sessions (telegram_id);

-- Index: quickly find sessions by chat_id
CREATE INDEX IF NOT EXISTS idx_tas_chat_id
  ON telegram_auth_sessions (chat_id);


-- =========================================================================
-- SUPER ADMIN SEED & MAINTENANCE QUERIES
-- =========================================================================

-- 1. Bog'langan admin filiallari va xodimlarni o'chirish/tozalash
-- DELETE FROM public.admin_branches WHERE admin_id IN ('69e54372-a20f-4d6d-8f84-05df145c6d11', '9411f978-1239-4235-bef7-da327de2388d');
-- DELETE FROM public.employees WHERE id IN ('69e54372-a20f-4d6d-8f84-05df145c6d11', '9411f978-1239-4235-bef7-da327de2388d') OR telefon IN ('998901988585', '998990000000');

-- 2. Auth tizimidagi bog'liqliklarni tozalash
-- DELETE FROM auth.identities WHERE user_id IN ('69e54372-a20f-4d6d-8f84-05df145c6d11', '9411f978-1239-4235-bef7-da327de2388d');
-- DELETE FROM auth.users WHERE id IN ('69e54372-a20f-4d6d-8f84-05df145c6d11', '9411f978-1239-4235-bef7-da327de2388d');

-- 3. Super Adminni auth.users dagi emaili orqali public.employees ga bog'lab yaratish
-- INSERT INTO public.employees (id, ism, familiya, telefon, rol)
-- SELECT id, 'Yusufxon', 'Xayrulloyev', '998901988585', 'super_admin'
-- FROM auth.users
-- WHERE email = '998901988585@attendancex.uz'
-- LIMIT 1;
