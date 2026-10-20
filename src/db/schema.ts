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
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  bigserial,
  check,
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

/** Akses sementara "petugas scan" untuk satu agenda (Fase 3). */
export const agendaScanners = pgTable(
  "agenda_scanners",
  {
    agendaId: uuid("agenda_id")
      .notNull()
      .references(() => agendas.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    grantedBy: uuid("granted_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.agendaId, t.userId] }), index("agenda_scanners_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Kurikulum, target & capaian (Fase 4) — format dokumen target Tim Kurikulum PPG
// ---------------------------------------------------------------------------

export const aspek = pgEnum("aspek", ["alim", "faqih", "akhlaq", "mandiri"]);
/** Satuan posisi lintasan kitab. Al-Qur'an memakai `ayat` = nomor ayat urut mushaf (1–6236). */
export const kitabUnit = pgEnum("kitab_unit", ["ayat", "halaman", "bab"]);
/** Cara penilaian materi: per generus (belum/proses/tuntas) atau per kelompok (sudah disampaikan). */
export const assessmentMode = pgEnum("assessment_mode", ["generus", "kelompok"]);
export const achievementStatus = pgEnum("achievement_status", ["belum", "proses", "tuntas"]);

/** Periode target, mis. "Oktober 2026" = 5 Okt – 7 Nov 2026. Bukan bulan kalender. */
export const curriculumPeriods = pgTable(
  "curriculum_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    semester: text("semester").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    /** Kosong = draf, hanya terlihat oleh tim kurikulum & superadmin. */
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (t) => [check("curriculum_periods_range", sql`${t.endsOn} >= ${t.startsOn}`), index("curriculum_periods_starts_idx").on(t.startsOn)],
);

/** Lintasan progres berurutan, mis. Bacaan Al-Qur'an, Makna Al-Qur'an, Makna Hadist K. Janaiz. */
export const kitab = pgTable(
  "kitab",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull().unique(),
    unit: kitabUnit("unit").notNull(),
    total: integer("total").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
    ...timestamps,
  },
  (t) => [check("kitab_total_positive", sql`${t.total} > 0`)],
);

/** Pustaka materi; dipakai ulang lintas periode (hafalan, dalil, doa, akhlaq, …). */
export const materi = pgTable(
  "materi",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aspek: aspek("aspek").notNull(),
    mapel: text("mapel").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    arabic: text("arabic"),
    translation: text("translation"),
    source: text("source"),
    assessment: assessmentMode("assessment").notNull().default("generus"),
    archived: boolean("archived").notNull().default(false),
    ...timestamps,
  },
  (t) => [unique("materi_unique").on(t.aspek, t.mapel, t.title)],
);

/** Satu baris target dalam periode untuk satu jenjang: materi dari pustaka, atau rentang kitab. */
export const periodTargets = pgTable(
  "period_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    periodId: uuid("period_id")
      .notNull()
      .references(() => curriculumPeriods.id, { onDelete: "cascade" }),
    jenjangId: uuid("jenjang_id")
      .notNull()
      .references(() => jenjang.id, { onDelete: "restrict" }),
    // Kosong = semua kategori / kedua jenis kelamin.
    kategoriId: uuid("kategori_id").references(() => jenjangKategori.id, { onDelete: "restrict" }),
    gender: gender("gender"),
    sortOrder: integer("sort_order").notNull().default(0),
    aspek: aspek("aspek").notNull(),
    mapel: text("mapel").notNull(),
    materiId: uuid("materi_id").references(() => materi.id, { onDelete: "restrict" }),
    kitabId: uuid("kitab_id").references(() => kitab.id, { onDelete: "restrict" }),
    rangeFrom: integer("range_from"),
    rangeTo: integer("range_to"),
    /** Keterangan tambahan, mis. "Juz 3". */
    note: text("note"),
    strategy: text("strategy"),
    /** Materi pilihan/extra: tidak dihitung dalam persentase capaian. */
    optional: boolean("optional").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    check(
      "period_targets_kind",
      sql`(${t.materiId} IS NOT NULL AND ${t.kitabId} IS NULL AND ${t.rangeFrom} IS NULL AND ${t.rangeTo} IS NULL)
        OR (${t.materiId} IS NULL AND ${t.kitabId} IS NOT NULL AND ${t.rangeFrom} >= 1 AND ${t.rangeTo} >= ${t.rangeFrom})`,
    ),
    index("period_targets_period_idx").on(t.periodId, t.jenjangId, t.sortOrder),
  ],
);

/** Capaian per generus untuk target materi ber-penilaian `generus`. */
export const achievements = pgTable(
  "achievements",
  {
    targetId: uuid("target_id")
      .notNull()
      .references(() => periodTargets.id, { onDelete: "restrict" }),
    generusId: uuid("generus_id")
      .notNull()
      .references(() => generus.id, { onDelete: "cascade" }),
    status: achievementStatus("status").notNull(),
    note: text("note"),
    updatedBy: uuid("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.targetId, t.generusId] }), index("achievements_generus_idx").on(t.generusId)],
);

/** Tanda "sudah disampaikan" per kelompok untuk target materi ber-penilaian `kelompok`. */
export const targetDeliveries = pgTable(
  "target_deliveries",
  {
    targetId: uuid("target_id")
      .notNull()
      .references(() => periodTargets.id, { onDelete: "restrict" }),
    kelompokId: uuid("kelompok_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    // Salinan units.path kelompok; dipelihara trigger.
    unitPath: ltree("unit_path").notNull().default(sql`''::ltree`),
    deliveredOn: date("delivered_on").notNull(),
    note: text("note"),
    recordedBy: uuid("recorded_by"),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.targetId, t.kelompokId] }), index("target_deliveries_unit_path_gist").using("gist", t.unitPath)],
);

/** Riwayat posisi kitab per generus (append-only). Posisi terkini = baris terbaru per (generus, kitab). */
export const kitabProgress = pgTable(
  "kitab_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    generusId: uuid("generus_id")
      .notNull()
      .references(() => generus.id, { onDelete: "cascade" }),
    kitabId: uuid("kitab_id")
      .notNull()
      .references(() => kitab.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    recordedOn: date("recorded_on").notNull().default(sql`current_date`),
    note: text("note"),
    recordedBy: uuid("recorded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("kitab_progress_latest_idx").on(t.generusId, t.kitabId, t.recordedOn, t.createdAt)],
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
