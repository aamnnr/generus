/**
 * Data uji coba Desa Samber, Daerah Klaten Timur 1 — nama generus per kelompok
 * dari berkas kartu presensi (docs/KARTU PRESENSI, nama file = nama generus).
 *
 * Jenis kelamin ditebak dari nama; jenjang, kategori, dan tanggal lahir adalah
 * PERKIRAAN deterministik (ditandai di kolom catatan) dan harus dikoreksi admin.
 */
import type { SeedData, SeedGenerus, SeedJenjang, SeedKategori } from "./generate";

export const SAMBER_DAERAH = "Klaten Timur 1";
export const SAMBER_DESA = "Samber";
export const ESTIMATE_NOTE = "Data perkiraan: jenis kelamin, tanggal lahir & jenjang — mohon dikoreksi.";

// "L Nama" / "P Nama" sesuai nama file asli (tanpa .png).
const RAW: Record<string, string> = {
  JAMBON: `L Ahmad Nouval A.|P Lutfi Dyah Ariani|P Maisara Sasmita|P Mey Anggita Sari|L Muh. Alvin Pratama|L Muh.aufar Firdaus|L Muh.denis Fauzan|L Muhamad Refan|L Muhammad Yoga P|P Mutiara Latifa|L Nur Fauzan|L Panji Ahmad F.R.|P Rahmadina Destiara|L Rifqi Awanda Putra|L Robet Ubaidilah|P Sabila Kartini|P Sania Nurul Azizah|L T.rachmat.r|L Zaki Raihan S.`,
  "JURANG KAJONG SELATAN": `P Afifta Khoirotun N|P Alfina Kusuma D|P Alwanda Dyah P|L Anas Khoirul|L Andika Bayu S|P Anggi Bellas|P Aninda Mutiara|P Anita Firda M|L Azzam Faruq Hazim|P Bella Nanda A|P Bertha Ayu E|L Brandon Nando A|L Brian Brain|P Celsica Cinta C|P Della Puspita|P Dhea Dessy V.P.|L Exfan Alfandi|L Krisna Alfatoni|P Lendi Nabella S|L M. Hafidudin A|L M.arifin|P Miftahul Oktivia|L Muhammad Yusron|L Naufal Abdul A.|P Putri Malika I|L Rehan Dwi S|P Risawati P.n|P Riska Septi Y|L Rizal Hari P|L Rizki Cahya Putra|L Royan Abdullah|P Santika I|P Shafa Putri M.|P Shela Ilma F|P Sita Umi Hasna|P Sofiya Ardita R.a|L Very Gunawan|L Yudha Ananda P`,
  "JURANG KAJONG UTARA": `L Achzan Rofit K.|L Adam Ahmad H|P Adella Cholish F|P Aisyah Puspita N.|P Al Fatimah Fail N|P Alfina Nur Hasanah|L Andi Purwanto|P Arisma Nur H.|L Aziz Gunawan|P Azzahra Arum R|L Briyan Syaifuddin|P Fatimah Naura N.|L Habib Mutawalil|L Hasan Permadana|P Khayla Azzalea M.|L M. Iqbal|L M.dezri Risdan|L Muhammad Wildan A|L Nofal Fathur R|L Okvel Tifdzan D.|P Valencia Reva A|P Yesy Puspaningtyas|P Zemimma Dany A.`,
  KALANGAN: `L Aji|L Alung|L Fajar|L Gilang|L Ian|P Icha|P Ilma|P Mey Ferdiana M.|L Miftakhul F.R.P.|P Mila Latifah E.F.|P Nia|L Rafa|P Raya|P Zulfa|L Zulfi`,
  "KARANG JATI 1": `L Adi Kurniawan|L Ahmad Triyas S.|P Aisyah K.H.|P Ananda Isna B N|P Aqilla Azzahra|L Arvien Manda|P Calista Azaria H.p|L Fajar Fuziu|L Fernando Adinata U|P Fina Meliana|L Hafi Ahmad A|L M.qoirul Arifin|L Mohammad Anas|L Reza Adi Setyawan|P Rosa Dina Valida|L Royan Ubaidulloh|P Sahda Nabila|P Septi Nur Rochmah|L Sholikan Nur Huda|P Syadida Fauziah P|P Talita Hasna H|L Zuhruf Alaska G.`,
  "KARANG JATI 2": `L Ahmad Amar Bara|L Alfahri Putra M.|P Dinda Aprilia M.|L Evandra Ardi S.|P Fatimah Putri A.|L Galih Dimas I.|P Intan Anggun M.|L Iqbal Arfa F.|P Keysha Amelya S.|L Muh. Fattah A.|L Muh. Kayis P.|L Muh. Nur Faiz|P Queenza Azalia R.|P Yuslikha Milati R.`,
  KERINGAN: `L Ahmad Amar Bara|P Aisya Khaylila Q.|P Aisya Queen M.a|L Alfarizai Rakamas|L Athaya Kaito Al G.|L Brillian C.P.|P Cendekia S.P.|P Chusnaine Syifa R|L Erizkiyawan Nada S|L Fathan Masykuri|L Hend Patriot Cipto|L Husein A.C.|L Imron Sahid|P Lina Febiana|P Merisa Nisfi Laili|P Meritsa Sakyka A.|P Nazla Anastasya P|P Nazwanda Sofia R|L Pristinian S.|P Sekar Jagad E.W.`,
  "NGASEM BARAT": `P Afika Azka Arliana|P Aira Zahra A.|P Amelia Dewi S.|P Azka Aulia Azzahwa|L Darul Ma_arif|L Devo Maulana|P Elok Lailani|L Fahri Abdul Dhohir|L Farid Gilang R|L Jibran Naufal M|L Joko|L Khasabian Khinan A|L M. Azza Reza Al-m|P Murni Nurisa M|P Nindya Anggraini|P Nova Khorina|P Octavia M|L Rangga Salasan|L Sulthon|P Talenta S.|L Verdian Yuda S|L Yoga Dafa Saputra|P Zevaniya Nazwa.a|L Zidan Rivai F`,
  "NGASEM TIMUR": `L Aditya Wildan S|P Alma Nurhisari|L Alvin Nur Wasilah|L Ardian Julian K.|P Cendana Aprilia J.|L David|P Dea Mutia Pratiwi|P Dian Aprilia K.|P Dina Tri Verawati|L Diyego Vernando R|P Fadila Nur Aini|P Inka Mutmainah|L Iwan Fahri I.|P Kinasih Nidji M|L Luky Aditya|L M.adi Igo Saputra|L M.arham Arvino|L M.erwin A|L Muh.rendryan A|P Nimas Febriatun|L Pandu Wicaksono|L Rafi Afandi|P Riris Galuh S.|L Rofik|L Syahrul|P Syifa Septia Aulia|P Ursela Daydara|L Warih Kusuma`,
  SAMBER: `L Ahmad Affandi|P Anisa Nur Fadhila|P Aqilah Mirza B.|L Ivan Satya Ramdhan|P Laila Ratna W.|L Luthfi Eka Wijaya|P Maya Maunira|P Miftakhul Azizah|P Qaila Ratifa S|P Rida Lutfiah A.|P Rika Herlinda P.N.|P Sarah Nurida Dewi|P Titik Budiyarti|L Ubaid Dinar Atsani|P Vika Uyun Nurfaah`,
  "WANGLU BARAT": `P Aina Apriliana|L Akbar Adhitama|P Alka Aynal Hayat|P Anisa Mawar S.|P Annisa Faridhotun|P Aura Silvia L.F.|P Belinda Dhiva K.S.|P Cantika Aisya S.|P Chikal Nafisa I.|P Davina Aulya I.H.|P Descha Amira P.|L Fadil Adib El K.|P Indah Laila A|L Lucky Ghozi P.|P Lutfiya Zia Zahira|L Muh. Adnan Al F.|L Muh. Gilang R.|L Muh. Tiger J.B.|P Nabila Ramadhani A|P Nayla Mayrisha F|P Nazira Rida A.|L Rauf Murfiatul A|L Ryan Yogi Kusuma|P Selly Ardiani|P Syarofa Faza Z.`,
  "WANGLU TIMUR": `L Abdulloh Mirza F|P Artika Yumna F|L Askharulloh Ijas D|L Bastian Ilham P.|L Charles Abdulloh R|P Dian Aprilia K.|P Dian Aprilia K.D.|P Dinar Alfa Izza|P Dinda Safira R|P Egi Febila S.|L El Mahesa Jagad|L Endhoven August R|L Fathan Zahid Al K.|P Fauziyah Rizki F.|P Hafiza Nazalal H.|L Haykal R.P.|P Ifna Ranggita|P Kalila Octavia P|L Khoirul Anam|L M. Ali Abdul R.|L M.khasbi Diknan|P Nanda Vania S.A.|L Prima Dias Bagus|L Revandra Diko A|P Reviana Umi Zar_in|P Revina Naura R|P Sidatul Nisa|P Sidqia Ais N.A.|P Syakirana Makayla|P Syifa Nazalla Z.|P Ulya Widyawati|P Vika Rahmalia P.|P Vindy Afifa Risya|L Yukhsin Arsyalloh`,
  WONOSARI: `P Aisya Zahra C.|P Akifa Nuha Zahira|P Anastasya Gisca|L Arkha Banisa A.|P Arum Candra Alfi|P Chayra Hasna M|P Dela Isnaini Aulia|L Ernesto|L Ferdinan Ramadhan|P Gharnisha Ceryl F.|P Gisela Viryln F.r|P Gracelia Avriel F.|L Ilham Rusdiansyah|P Khiyara Fathan A|L Langit R.|P Lathifa Dwi Anyani|P Luthfi Hanik S.R.|L Martio Catur A.S.|L Muh.ilham Fauzi S.|L Muh.wahyu Aji S.|P Najwa Maulina R|L Naufal Reyhan A|P Rizka Tutut S.|P Velysha B.D.|P Zidni Muthmainah`,
};

const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);

/**
 * Rapikan nama dari nama file: "_" (pengganti apostrof) → "'", spasi setelah
 * singkatan ("Muh.aufar" → "Muh. Aufar"), inisial huruf besar ("P.n" → "P.N.").
 */
export function normalizeName(raw: string): string {
  return raw
    .replace(/_/g, "'")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) => {
      if (!token.includes(".")) return [token.split("-").map(cap).join("-")];
      const parts = token.split(".").filter(Boolean);
      if (parts.every((p) => p.length === 1)) return [parts.map((p) => p.toUpperCase()).join(".") + "."];
      return parts.map((p, i) => {
        if (p.length === 1) return `${p.toUpperCase()}.`;
        // Singkatan di depan ("Muh.aufar" → "Muh. Aufar"); kata biasa tanpa titik.
        return i === 0 && p.length <= 3 ? `${cap(p)}.` : cap(p);
      });
    })
    .join(" ");
}

/** Hash FNV-1a 32-bit untuk perkiraan yang stabil per nama. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function estimate(key: string): { jenjang: SeedJenjang; kategori: SeedKategori; birthDate: string } {
  const h = hash(key);
  const r = h % 100;
  const day = 1 + ((h >>> 8) % 28);
  const month = 1 + ((h >>> 13) % 12);
  const pad = (n: number) => String(n).padStart(2, "0");
  // ±35% Pra Remaja (usia SLTP), ±45% Remaja Pelajar, ±20% Remaja Mandiri.
  if (r < 35) return { jenjang: "Pra Remaja", kategori: null, birthDate: `${2011 + ((h >>> 17) % 3)}-${pad(month)}-${pad(day)}` };
  if (r < 80) return { jenjang: "Remaja", kategori: "Pelajar", birthDate: `${2007 + ((h >>> 17) % 4)}-${pad(month)}-${pad(day)}` };
  return { jenjang: "Remaja", kategori: "Mandiri", birthDate: `${2000 + ((h >>> 17) % 7)}-${pad(month)}-${pad(day)}` };
}

/** "JURANG KAJONG SELATAN" → "Jurang Kajong Selatan". */
export const kelompokName = (folder: string) => folder.toLowerCase().split(" ").map(cap).join(" ");

export function generateSamberData(): SeedData {
  const kelompok = Object.entries(RAW).map(([folder, list]) => ({
    name: kelompokName(folder),
    generus: list.split("|").map((entry): SeedGenerus => {
      const gender = entry[0] as "L" | "P";
      const raw = entry.slice(2);
      return {
        name: normalizeName(raw),
        gender,
        ...estimate(`${folder}/${raw}`),
        school: null,
        guardianName: null,
        guardianPhone: null,
        notes: ESTIMATE_NOTE,
      };
    }),
  }));
  return { daerah: SAMBER_DAERAH, desa: [{ name: SAMBER_DESA, kelompok }] };
}
