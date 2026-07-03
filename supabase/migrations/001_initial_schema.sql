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
