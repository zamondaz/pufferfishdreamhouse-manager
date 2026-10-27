-- Pufferfish Manager Database Schema (Supabase / PostgreSQL)

-- Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Beds Table (12 beds total across 4 rooms)
CREATE TABLE IF NOT EXISTS beds (
  id SERIAL PRIMARY KEY,
  room_name VARCHAR(50) NOT NULL,
  bed_number INT NOT NULL,
  UNIQUE (room_name, bed_number)
);

-- 2. Reservations Table
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name VARCHAR(100) NOT NULL,
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('M', 'F')),
  bed_id INT NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  group_code VARCHAR(50) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (check_out > check_in)
);

-- 3. Staff Table (2 Resident Staff Members)
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('M', 'F')),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  current_bed_id INT NULL REFERENCES beds(id) ON DELETE SET NULL,
  location_note VARCHAR(20) NOT NULL DEFAULT '침대' CHECK (location_note IN ('침대', '거실', '사장님방', '외부'))
);

-- Disable RLS on all 3 tables (solo guesthouse owner app)
ALTER TABLE beds DISABLE ROW LEVEL SECURITY;
ALTER TABLE reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;

-- Seed Data: 12 Beds
-- 5인실 (Beds 1-5), 4인실 (Beds 1-4), 2인실 (Beds 1-2), 1인실 (Bed 1)
INSERT INTO beds (id, room_name, bed_number) VALUES
  (1, '5인실', 1),
  (2, '5인실', 2),
  (3, '5인실', 3),
  (4, '5인실', 4),
  (5, '5인실', 5),
  (6, '4인실', 1),
  (7, '4인실', 2),
  (8, '4인실', 3),
  (9, '4인실', 4),
  (10, '2인실', 1),
  (11, '2인실', 2),
  (12, '1인실', 1)
ON CONFLICT (id) DO NOTHING;

-- Reset serial sequence to max id
SELECT setval(pg_get_serial_sequence('beds', 'id'), (SELECT MAX(id) FROM beds));

-- Seed Data: 2 Initial Staff Members (스태프A, 스태프B)
INSERT INTO staff (name, gender, check_in, check_out, current_bed_id, location_note) VALUES
  ('스태프A', 'M', CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE + INTERVAL '60 days', 5, '침대'),
  ('스태프B', 'F', CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '45 days', 9, '침대');
