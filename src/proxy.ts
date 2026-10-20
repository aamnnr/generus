import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Memperbarui cookie sesi Supabase di setiap request dan mengarahkan
// pengunjung yang belum login ke /login. Otorisasi sebenarnya tetap
// diperiksa di server (src/lib/auth.ts) dan database (RLS).

const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (pathname === "/") return redirectWithCookies(request, response, loggedIn ? "/beranda" : "/login");
  if (!loggedIn && !isPublic) return redirectWithCookies(request, response, "/login");
  return response;
}

function redirectWithCookies(request: NextRequest, response: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  // Bawa cookie sesi yang baru di-refresh agar tidak hilang saat redirect.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  // Aset publik PWA (manifest, ikon, service worker, halaman offline, template)
  // tidak melewati proxy agar bisa diambil tanpa sesi login.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icon|apple-icon|icons/|templates/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xlsx)$).*)",
  ],
};
