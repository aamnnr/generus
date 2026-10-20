import {
  type AnyPgColumn,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  bigserial,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";

// Lihat docs/ARCHITECTURE.md §4. Fungsi, trigger, dan RLS ada di drizzle/*_rls.sql
// karena drizzle-kit tidak membuatnya dari skema ini.

/** Jalur hierarki wilayah, mis. `u<daerah>.u<desa>.u<kelompok>`. Butuh ekstensi ltree. */
export const ltree = customType<{ data: string }>({
  dataType: () => "ltree",
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ---------------------------------------------------------------------------
// Wilayah & akun
// ---------------------------------------------------------------------------

export const unitLevel = pgEnum("unit_level", ["daerah", "desa", "kelompok"]);
export const appRole = pgEnum("app_role", ["superadmin", "kurikulum", "admin", "kyai"]);

export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references((): AnyPgColumn => units.id, { onDelete: "restrict" }),
    level: unitLevel("level").notNull(),
    name: text("name").notNull(),
    // Diisi trigger dari parent; jangan diisi manual.
    path: ltree("path").notNull().default(sql`''::ltree`).unique(),
    ...timestamps,
  },
  (t) => [
    index("units_path_gist").using("gist", t.path),
    unique("units_parent_name_unique").on(t.parentId, t.name),
  ],
);

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Salinan auth.users.email (dipelihara trigger) agar bisa dibaca lewat RLS.
  email: text("email"),
  phone: text("phone"),
  active: boolean("active").notNull().default(true),
  // True untuk akun yang dibuat/di-reset superadmin dengan password sementara.
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  ...timestamps,
});

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    role: appRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("user_roles_unique").on(t.userId, t.unitId, t.role), index("user_roles_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Jenjang
// ---------------------------------------------------------------------------

export const jenjang = pgTable("jenjang", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull(),
});

export const jenjangKategori = pgTable(
  "jenjang_kategori",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jenjangId: uuid("jenjang_id")
      .notNull()
      .references(() => jenjang.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [unique("jenjang_kategori_unique").on(t.jenjangId, t.name)],
);

// ---------------------------------------------------------------------------
// Generus
// ---------------------------------------------------------------------------

export const gender = pgEnum("gender", ["L", "P"]);
export const generusStatus = pgEnum("generus_status", ["aktif", "pindah_sambung", "menikah"]);

export const generus = pgTable(
  "generus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kelompokId: uuid("kelompok_id")
      .notNull()
      .references(() => units.id, { onDelete: "restrict" }),
    // Salinan units.path milik kelompok; dipelihara trigger, dipakai RLS & laporan.
    unitPath: ltree("unit_path").notNull().default(sql`''::ltree`),
    name: text("name").notNull(),
    gender: gender("gender").notNull(),
    birthDate: date("birth_date").notNull(),
    jenjangId: uuid("jenjang_id")
      .notNull()
      .references(() => jenjang.id, { onDelete: "restrict" }),
    kategoriId: uuid("kategori_id").references(() => jenjangKategori.id, { onDelete: "restrict" }),
    school: text("school"),
    guardianName: text("guardian_name"),
    guardianPhone: text("guardian_phone"),
    notes: text("notes"),
    // Token acak di kartu QR; bukan data pribadi.
    qrToken: text("qr_token")
      .notNull()
      .unique()
      .default(sql`upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))`),
    qrActive: boolean("qr_active").notNull().default(true),
    status: generusStatus("status").notNull().default("aktif"),
    statusDate: date("status_date"),
    statusNote: text("status_note"),
    ...timestamps,
  },
  (t) => [
    index("generus_unit_path_gist").using("gist", t.unitPath),
    index("generus_kelompok_idx").on(t.kelompokId),
  ],
);

/** Pindah kelompok di dalam daerah. Diisi trigger. */
export const generusMutations = pgTable("generus_mutations", {
  id: uuid("id").primaryKey().defaultRandom(),
  generusId: uuid("generus_id")
    .notNull()
    .references(() => generus.id, { onDelete: "cascade" }),
  fromUnitId: uuid("from_unit_id")
    .notNull()
    .references(() => units.id),
  toUnitId: uuid("to_unit_id")
    .notNull()
    .references(() => units.id),
  mutatedAt: timestamp("mutated_at", { withTimezone: true }).notNull().defaultNow(),
  mutatedBy: uuid("mutated_by"),
});

/** Riwayat perubahan status (aktif ↔ menikah / pindah sambung). Diisi trigger. */
export const generusStatusHistory = pgTable("generus_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  generusId: uuid("generus_id")
    .notNull()
    .references(() => generus.id, { onDelete: "cascade" }),
  fromStatus: generusStatus("from_status").notNull(),
  toStatus: generusStatus("to_status").notNull(),
  statusDate: date("status_date").notNull(),
  note: text("note"),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  changedBy: uuid("changed_by"),
});

// ---------------------------------------------------------------------------
// Agenda & presensi (Fase 2)
// ---------------------------------------------------------------------------

export const agendas = pgTable(
  "agendas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "restrict" }),
    // Salinan units.path pemilik agenda; dipelihara trigger.
    unitPath: ltree("unit_path").notNull().default(sql`''::ltree`),
    title: text("title").notNull(),
    location: text("location"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** Hadir setelah waktu ini dihitung terlambat. */
    lateAfter: timestamp("late_after", { withTimezone: true }).notNull(),
    // Sasaran. Kosong = semua. Filter kategori hanya berlaku untuk jenjang yang punya kategori.
    targetJenjangIds: uuid("target_jenjang_ids").array().notNull().default(sql`'{}'::uuid[]`),
    targetKategoriIds: uuid("target_kategori_ids").array().notNull().default(sql`'{}'::uuid[]`),
    targetGender: gender("target_gender"),
    /** Agenda mingguan berbagi recurrence_id yang sama. */
    recurrenceId: uuid("recurrence_id"),
    /** Batas admin kelompok melengkapi presensi anggotanya (delegasi); juga saat dikunci otomatis. */
    delegateUntil: timestamp("delegate_until", { withTimezone: true }).notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (t) => [
    index("agendas_unit_path_gist").using("gist", t.unitPath),
    index("agendas_starts_at_idx").on(t.startsAt),
    index("agendas_recurrence_idx").on(t.recurrenceId),
  ],
);

export const attendanceStatus = pgEnum("attendance_status", ["hadir", "terlambat", "izin", "sakit", "alpa"]);
export const attendanceMethod = pgEnum("attendance_method", ["manual", "scan", "delegasi", "search", "self", "otomatis"]);

export const attendance = pgTable(
  "attendance",
  {
    // Boleh dibuat di klien (antrian offline) agar pengiriman ulang idempoten.
    id: uuid("id").primaryKey().defaultRandom(),
    agendaId: uuid("agenda_id")
      .notNull()
      .references(() => agendas.id, { onDelete: "cascade" }),
    generusId: uuid("generus_id")
      .notNull()
      .references(() => generus.id, { onDelete: "cascade" }),
    status: attendanceStatus("status").notNull(),
    method: attendanceMethod("method").notNull().default("manual"),
    note: text("note"),
    recordedBy: uuid("recorded_by"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    unique("attendance_agenda_generus_unique").on(t.agendaId, t.generusId),
    index("attendance_generus_idx").on(t.generusId),
  ],
);

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id"),
    tableName: text("table_name").notNull(),
    rowId: uuid("row_id"),
    action: text("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_row_idx").on(t.tableName, t.rowId)],
);
