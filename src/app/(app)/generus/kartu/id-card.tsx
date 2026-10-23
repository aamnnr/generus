import { LOGO_COLORS, LogoGlyph } from "@/components/brand/logo";
import { FitName } from "./fit-name";

// Kartu identitas generus: ukuran KTP berdiri (54 × 85,6 mm), untuk lanyard.
// Gaya ada di globals.css (.idc-*) memakai satuan mm agar cetak presisi.

export interface IdCardData {
  id: string;
  name: string;
  gender: "L" | "P";
  kelompok: string;
  desa: string;
  daerah: string;
  jenjang: string;
  token: string;
  /** SVG QR berisi qrPayload(token). */
  svg: string;
}

/** Token dikelompokkan 4-4 agar mudah dibaca bila perlu diketik manual. */
const groupToken = (t: string) => t.match(/.{1,4}/g)?.join(" ") ?? t;

export function IdCard({ c }: { c: IdCardData }) {
  return (
    <article className="idc" aria-label={`Kartu ${c.name}`}>
      <header className="idc-top">
        <span className="idc-slot" aria-hidden />
        <svg className="idc-star" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={1}>
          <path d="M12 2l2.6 3.7L19 5l-.7 4.4L22 12l-3.7 2.6L19 19l-4.4-.7L12 22l-2.6-3.7L5 19l.7-4.4L2 12l3.7-2.6L5 5l4.4.7z" />
        </svg>
        <div className="idc-brand">
          <LogoGlyph variant="icon" mosque={LOGO_COLORS.cream} id={`idc-${c.id}`} className="idc-mark" />
          <span className="idc-brand-text">
            <span className="idc-app">KARTU GENERUS</span>
            <span className="idc-daerah">{/^daerah\b/i.test(c.daerah) ? c.daerah : `Daerah ${c.daerah}`}</span>
          </span>
        </div>
      </header>

      <div className="idc-body">
        <FitName name={c.name} />
        <div className="idc-meta">
          Kelompok {c.kelompok} · Desa {c.desa}
        </div>
        <span className="idc-pill">
          {c.jenjang} · {c.gender === "L" ? "Putra" : "Putri"}
        </span>
        <div className="idc-qr" dangerouslySetInnerHTML={{ __html: c.svg }} />
        <div className="idc-token">{groupToken(c.token)}</div>
      </div>

      <footer className="idc-foot">Tunjukkan kartu ini saat presensi pengajian</footer>
    </article>
  );
}
