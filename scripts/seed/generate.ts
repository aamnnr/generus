import { fakerID_ID as faker } from "@faker-js/faker";

// Pembuat data contoh untuk development. Murni (tanpa DB) supaya bisa dites
// dan dipakai ulang, mis. untuk mengekspor ke format template Excel.

export type SeedJenjang = "Pra Remaja" | "Remaja";
export type SeedKategori = "Pelajar" | "Mandiri" | null;

export interface SeedGenerus {
  name: string;
  gender: "L" | "P";
  birthDate: string; // YYYY-MM-DD
  jenjang: SeedJenjang;
  kategori: SeedKategori;
  school: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
}

export interface SeedKelompok {
  name: string;
  generus: SeedGenerus[];
}

export interface SeedDesa {
  name: string;
  kelompok: SeedKelompok[];
}

export interface SeedData {
  daerah: string;
  desa: SeedDesa[];
}

export interface SeedOptions {
  /** Benih acak; nilai sama → data sama. */
  seed?: number;
  desaCount?: number;
  kelompokPerDesa?: number;
  /** Rata-rata generus per kelompok (±30%). */
  generusPerKelompok?: number;
  /** Tanggal acuan untuk menghitung usia. */
  referenceDate?: Date;
}

const DESA_NAMES = [
  "Sukamaju", "Sukamulya", "Mekarsari", "Sindangsari", "Cibeureum",
  "Margahayu", "Karangsari", "Tegalrejo", "Sumberjo", "Wonosari",
  "Sidomulyo", "Banjarsari", "Jatimulyo", "Purwodadi", "Tanjungsari",
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function birthDateForAge(ref: Date, minAge: number, maxAge: number): string {
  const to = new Date(ref);
  to.setFullYear(to.getFullYear() - minAge);
  const from = new Date(ref);
  from.setFullYear(from.getFullYear() - maxAge - 1);
  from.setDate(from.getDate() + 1);
  return isoDate(faker.date.between({ from, to }));
}

function makeGenerus(ref: Date): SeedGenerus {
  const sex = faker.helpers.arrayElement(["male", "female"] as const);
  const roll = faker.number.float({ min: 0, max: 1 });
  const guardianLast = faker.person.lastName();

  let jenjang: SeedJenjang;
  let kategori: SeedKategori;
  let birthDate: string;
  let school: string | null;

  if (roll < 0.35) {
    jenjang = "Pra Remaja";
    kategori = null;
    birthDate = birthDateForAge(ref, 12, 15);
    school = `SMP ${faker.number.int({ min: 1, max: 12 })} kelas ${faker.number.int({ min: 7, max: 9 })}`;
  } else if (roll < 0.7) {
    jenjang = "Remaja";
    kategori = "Pelajar";
    const kuliah = faker.datatype.boolean({ probability: 0.4 });
    birthDate = kuliah ? birthDateForAge(ref, 18, 23) : birthDateForAge(ref, 15, 18);
    school = kuliah
      ? `Kuliah semester ${faker.number.int({ min: 1, max: 8 })}`
      : `SMA ${faker.number.int({ min: 1, max: 8 })} kelas ${faker.number.int({ min: 10, max: 12 })}`;
  } else {
    jenjang = "Remaja";
    kategori = "Mandiri";
    birthDate = birthDateForAge(ref, 18, 30);
    school = null;
  }

  return {
    name: faker.person.fullName({ sex }),
    gender: sex === "male" ? "L" : "P",
    birthDate,
    jenjang,
    kategori,
    school,
    guardianName: faker.datatype.boolean({ probability: 0.8 })
      ? `${faker.person.firstName("male")} ${guardianLast}`
      : null,
    guardianPhone: faker.datatype.boolean({ probability: 0.7 })
      ? `08${faker.string.numeric({ length: { min: 9, max: 11 } })}`
      : null,
  };
}

export function generateSeedData(opts: SeedOptions = {}): SeedData {
  const {
    seed = 20261020,
    desaCount = 10,
    kelompokPerDesa = 6,
    generusPerKelompok = 83,
    referenceDate = new Date("2026-10-20T00:00:00Z"),
  } = opts;
  if (desaCount > DESA_NAMES.length) {
    throw new Error(`desaCount maksimal ${DESA_NAMES.length}`);
  }
  faker.seed(seed);

  return {
    daerah: "Daerah Contoh",
    desa: DESA_NAMES.slice(0, desaCount).map((desaName) => ({
      name: desaName,
      kelompok: Array.from({ length: kelompokPerDesa }, (_, i) => {
        const n = faker.number.int({
          min: Math.round(generusPerKelompok * 0.7),
          max: Math.round(generusPerKelompok * 1.3),
        });
        return {
          name: `${desaName} ${i + 1}`,
          generus: Array.from({ length: n }, () => makeGenerus(referenceDate)),
        };
      }),
    })),
  };
}

/** Akun uji per peran. Unit: daerah, desa pertama, kelompok pertama desa itu. */
export const TEST_ACCOUNTS = [
  { email: "superadmin@generus.test", name: "Superadmin", role: "superadmin", unit: "daerah" },
  { email: "kurikulum@generus.test", name: "Tim Kurikulum", role: "kurikulum", unit: "daerah" },
  { email: "admin.daerah@generus.test", name: "Admin Daerah", role: "admin", unit: "daerah" },
  { email: "kyai.daerah@generus.test", name: "Kyai Daerah", role: "kyai", unit: "daerah" },
  { email: "admin.desa@generus.test", name: "Admin Desa", role: "admin", unit: "desa" },
  { email: "kyai.desa@generus.test", name: "Kyai Desa", role: "kyai", unit: "desa" },
  { email: "admin.kelompok@generus.test", name: "Admin Kelompok", role: "admin", unit: "kelompok" },
  { email: "kyai.kelompok@generus.test", name: "Kyai Kelompok", role: "kyai", unit: "kelompok" },
] as const;
