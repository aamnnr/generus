/**
 * Contoh target dari dokumen Tim Kurikulum PPG Klaten Timur 1:
 * "Target Materi Pembelajaran Remaja Semester 1 - 2026, Periode Bulan Oktober"
 * (5 Oktober – 7 November 2026). Dipakai untuk pengembangan & uji coba.
 */
import { toIndex } from "../../src/lib/quran";

export type Aspek = "alim" | "faqih" | "akhlaq" | "mandiri";

export interface SeedMateri {
  title: string;
  body?: string;
  arabic?: string;
  translation?: string;
  source?: string;
  /** Default: generus. */
  assessment?: "generus" | "kelompok";
}

export interface SeedKitab {
  title: string;
  unit: "ayat" | "halaman" | "bab";
  total: number;
  sortOrder: number;
}

export interface SeedTarget {
  aspek: Aspek;
  mapel: string;
  strategy?: string;
  optional?: boolean;
  gender?: "L" | "P";
  materi?: SeedMateri;
  kitab?: { title: string; from: number; to: number; note?: string };
}

export interface SeedPeriod {
  name: string;
  semester: string;
  startsOn: string;
  endsOn: string;
  /** Nama jenjang sasaran (tanpa kategori = Pelajar & Mandiri sama). */
  jenjang: string;
  kitab: SeedKitab[];
  targets: SeedTarget[];
}

const S_HAFALAN = "Disampaikan dalam KBM @ 2 x sebulan";
const S_AKHLAQ =
  "Disampaikan dalam kegiatan: 1) PROGRES; 2) Nasehat 5 unsur dalam KBM 1 x sebulan; 3) Kegiatan suplementer dari bidang KMM dan Keputrian";
const S_KEMANDIRIAN = "Materi untuk 2 bulan";
const S_ORAS =
  "Bersifat extra/pilihan: bisa diadakan tiap Minggu pagi atau berkala sesuai program/hasil musyawarah kelompok masing-masing";

const group = (aspek: Aspek, mapel: string, strategy: string | undefined, items: (SeedMateri & { gender?: "L" | "P" })[], extra: Partial<SeedTarget> = {}): SeedTarget[] =>
  items.map(({ gender, ...materi }) => ({ aspek, mapel, strategy, gender, materi, ...extra }));

const kelompok = (title: string, body?: string): SeedMateri => ({ title, body, assessment: "kelompok" });

export const KURIKULUM_OKTOBER_2026: SeedPeriod = {
  name: "Oktober 2026",
  semester: "1 - 2026",
  startsOn: "2026-10-05",
  endsOn: "2026-11-07",
  jenjang: "Remaja",
  kitab: [
    // Bacaan & Makna Al-Qur'an sudah ada dari migrasi; Total K. Janaiz perkiraan — sesuaikan dengan kitab asli.
    { title: "Makna Hadist K. Janaiz", unit: "halaman", total: 100, sortOrder: 3 },
  ],
  targets: [
    // 1. ALIM
    {
      aspek: "alim",
      mapel: "Bacaan",
      strategy: "Disampaikan dalam KBM 1 jam pelajaran per minggu, ditambah nderes di rumah",
      kitab: { title: "Bacaan Al-Qur'an", from: toIndex(2, 253), to: toIndex(3, 91), note: "Juz 3" },
    },
    {
      aspek: "alim",
      mapel: "Keilmuan",
      strategy: "Disampaikan dalam KBM @ 2 jam pelajaran per minggu",
      kitab: { title: "Makna Al-Qur'an", from: toIndex(7, 144), to: toIndex(7, 187), note: "Juz 9" },
    },
    {
      aspek: "alim",
      mapel: "Keilmuan",
      strategy: "Disampaikan dalam KBM @ 2 jam pelajaran per minggu",
      kitab: { title: "Makna Hadist K. Janaiz", from: 26, to: 38 },
    },
    ...group("alim", "Hafalan", S_HAFALAN, [
      { title: "Menjaga hafalan surat An-Nas s.d. An-Naba'" },
      { title: "Asmaul Husna 1–99" },
      {
        title: "Dalil Membela",
        body: "Lanjutan hafalan dalil 5 bab (3)",
        arabic: "وَمَآ أَنْفَقْتُمْ مِّنْ شَيْءٍ فَهُوَ يُخْلِفُهُ",
        translation: "Dan apa-apa yang kalian infaqkan, maka Alloh akan menggantinya.",
        source: "QS Saba' 39",
      },
      {
        title: "Dalil Jamaah",
        body: "Lanjutan hafalan dalil 5 bab (4)",
        arabic: "وَاعْتَصِمُوْا بِحَبْلِ اللّٰهِ جَمِيْعًا وَّلَا تَفَرَّقُوْا",
        translation: "Berpegang teguhlah kalian pada tali (agama) Alloh dengan berjamaah, dan janganlah kalian berpecah belah.",
        source: "QS Ali 'Imran 103",
      },
      {
        title: "Dalil Thoat",
        body: "Lanjutan hafalan dalil 5 bab (5)",
        arabic: "وَمَنْ يُّطِعِ اللّٰهَ وَرَسُوْلَهٗ يُدْخِلْهُ جَنّٰتٍ تَجْرِيْ مِنْ تَحْتِهَا الْاَنْهٰرُ خٰلِدِيْنَ فِيْهَا",
        translation:
          "Barang siapa yang thoat kepada Alloh dan Rosul-Nya, maka Alloh akan memasukkan orang tersebut ke dalam surga yang di dalamnya mengalir beberapa sungai, dan dia kekal di dalamnya.",
        source: "QS An-Nisa' 13",
      },
      {
        title: "Do'a minta kebaikan dunia akhirat",
        arabic: "رَبَّنَآ اٰتِنَا فِى الدُّنْيَا حَسَنَةً وَّفِى الْاٰخِرَةِ حَسَنَةً وَّقِنَا عَذَابَ النَّارِ",
        translation: "Ya Tuhan kami, berilah kami kebaikan di dunia dan kebaikan di akhirat, dan lindungilah kami dari siksa neraka.",
        source: "QS Al-Baqarah 201",
      },
      {
        title: "Do'a memakai pakaian",
        arabic: "اَلْحَمْدُ لِلّٰهِ الَّذِيْ كَسَانِيْ هٰذَا الثَّوْبَ وَرَزَقَنِيْهِ مِنْ غَيْرِ حَوْلٍ مِّنِّيْ وَلَا قُوَّةٍ",
        translation: "Segala puji bagi Alloh yang memberiku pakaian ini dan memberikannya kepadaku tanpa daya dan kekuatan dariku.",
        source: "HR Abu Dawud",
      },
      {
        title: "Do'a ketetapan iman",
        arabic:
          "رَبَّنَا لَا تُزِغْ قُلُوْبَنَا بَعْدَ اِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَّدُنْكَ رَحْمَةً ۚ اِنَّكَ اَنْتَ الْوَهَّابُ\nيَا مُقَلِّبَ الْقُلُوْبِ ثَبِّتْ قَلْبِيْ عَلٰى دِيْنِكَ",
        translation:
          "Ya Tuhan kami, janganlah Engkau condongkan hati kami setelah Engkau beri petunjuk, dan karuniakanlah rahmat dari sisi-Mu; sesungguhnya Engkau Maha Pemberi. Wahai Dzat yang membolak-balikkan hati, teguhkanlah hatiku di atas agama-Mu.",
        source: "QS Ali 'Imran 8; HR Tirmidzi",
      },
      { title: "Menjaga dan mempraktikkan do'a-do'a harian yang telah dihafal" },
    ]),

    // FAQIH
    ...group("faqih", "Kefahaman Agama", undefined, [
      kelompok("Memahami tentang kewajiban beribadah kepada Alloh berdasarkan Al-Qur'an dan Al-Hadist"),
      kelompok("Memahami tentang Rukun Iman"),
      kelompok("Memahami tentang Rukun Islam"),
      kelompok("Memahami tentang Qur'an Hadist Jama'ah"),
      kelompok("Mengerti tentang Halal dan Haram"),
    ]),
    ...group("faqih", "Praktek Ibadah", undefined, [{ title: "Mempraktikkan menjaga kesucian (mengenal suci najis)" }]),

    // 2. AKHLAQUL KARIMAH
    ...group("akhlaq", "Akhlaq: Keluarga", S_AKHLAQ, [
      kelompok(
        "Terbiasa berbuat baik kepada orang tua",
        "Ta'at, ta'dhim, bersyukur, tawadhu'/rendah hati, perhatian/gemati, ridho, balas budi, kasih sayang, menerima keadaan orang tua.",
      ),
      kelompok(
        "Terbiasa berbuat baik kepada saudara dan kerabat",
        "Rukun, kompak, kerjasama yang baik (6 thobi'at luhur), hormat terhadap yang lebih tua, sayang terhadap yang lebih muda, dan pema'af, perhatian, gemati, kasih sayang.",
      ),
    ]),
    ...group("akhlaq", "Akhlaq: Ulil Amri, Guru dan Mubaligh-Mubalighot", S_AKHLAQ, [
      kelompok(
        "Terbiasa berbuat baik kepada Ulil Amri, guru, mubaligh-mubalighot",
        "Bersyukur, ta'dhim/hormat, ta'at, tawadhu'/rendah hati, husnudhon, senang, sabar, jujur, amanah, taubat, sakdermo, ridho, pemaaf.",
      ),
    ]),
    ...group("akhlaq", "Tata Krama", S_AKHLAQ, [
      kelompok(
        "Tatakrama menghormati saudara yang lebih tua dan menyayangi saudara yang lebih muda",
        "1) Mengucapkan salam/menyapa dan menjawab salam\n2) Berjabat tangan sambil agak menundukkan kepala kepada yang lebih tua\n3) Segera menjawab dan mendatangi bila dipanggil\n4) Bertutur kata dengan bahasa yang baik dan sopan\n5) Saling mensyukuri & saling mendo'akan",
      ),
      kelompok(
        "Tatakrama menghormati guru, mubaligh-mubalighot",
        "1) Mengucapkan salam/menyapa dan menjawab salam\n2) Berjabat tangan dengan cium tangan (perempuan dengan mubalighot dan laki-laki dengan mubaligh)\n3) Bertutur kata dengan bahasa yang halus, sopan (boso)\n4) Mendengarkan dan memperhatikan ketika menerima materi pelajaran dari guru dan mubaligh-mubalighot\n5) Bila melintas di depannya mengucapkan permisi sambil agak membungkukkan badan\n6) Bersyukur dan mendo'akan kepada guru dan mubaligh-mubalighot & bila menunjukkan sesuatu menggunakan ibu jari tangan kanan",
      ),
    ]),

    // 3. MANDIRI
    ...group("mandiri", "Kemandirian", S_KEMANDIRIAN, [
      { ...kelompok("Mengenal instalasi listrik"), gender: "L" },
      { ...kelompok("Mengenal peralatan servis sepeda"), gender: "L" },
      { ...kelompok("Mengenal bumbu masak (bumbon-bumbon)"), gender: "P" },
      { ...kelompok("Memasak air, nasi, mie instan, dan menggoreng telor"), gender: "P" },
      kelompok("Membuat minuman teh, kopi, susu, dan yang sejenis"),
      { ...kelompok("Mengenal make up sederhana"), gender: "P" },
    ]),
    ...group(
      "mandiri",
      "Olahraga & Seni (ORAS)",
      S_ORAS,
      [kelompok("Persinas ASAD"), kelompok("Senam Barokah"), kelompok("Jalan Santai"), kelompok("Sepakbola / futsal")],
      { optional: true },
    ),
  ],
};
