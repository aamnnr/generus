import type { Metadata, Viewport } from "next";
import { Amiri, Geist_Mono, Lora, Plus_Jakarta_Sans } from "next/font/google";
import { ConfirmHost } from "@/components/confirm";
import { FormValidation } from "@/components/form-validation";
import { Pwa } from "@/components/pwa";
import { APP_NAME, BRAND_COLOR } from "@/lib/app-icon";
import { BRAND } from "@/lib/brand";
import "./globals.css";

// Tipografi: docs/DESIGN.md §3.
const sans = Plus_Jakarta_Sans({ variable: "--font-sans", subsets: ["latin"] });
const display = Lora({ variable: "--font-display", subsets: ["latin"], weight: ["600"] });
const arabic = Amiri({ variable: "--font-arabic", subsets: ["arabic"], weight: ["400", "700"] });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Judul halaman cukup "Agenda"; nama aplikasi ditambahkan otomatis.
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Pemantauan ketertiban generus: presensi, target materi, dan progres kitab",
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: BRAND_COLOR,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      data-brand={BRAND}
      // Kelas merek (bukan selector atribut): build CSS produksi membuang aturan [data-brand="…"].
      className={`${sans.variable} ${display.variable} ${arabic.variable} ${geistMono.variable} brand-${BRAND} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Pwa />
        {children}
        <ConfirmHost />
        <FormValidation />
      </body>
    </html>
  );
}
