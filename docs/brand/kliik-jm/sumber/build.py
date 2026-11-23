# Susun aset KLIIK JM dari path hasil telusur (traced.json).
import json
import os
import sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
d = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "traced.json")))

NAVY = "#1A2189"
CYAN = "#008CD7"
WHITE = "#FFFFFF"


def join(items, pred=lambda x0: True):
    return "".join(p for x0, p in sorted(items) if pred(x0))


cyan_all = join(d["word_cyan"])
navy_word = join(d["word_navy"])
tag = join(d["tag_navy"])
# K untuk ikon: geometri bersih yang diukur dari K logo (koordinat logo asli).
k_only = (
    "M92 97L140.5 97L140.5 156.5L112 205.5L140.5 251L140.5 306.5L92 306.5Z"  # batang dengan takik
    "M187.5 97L240 97L176 205L239.5 306.5L186.7 306.5L121 205Z"  # chevron
)


def svg(view, body, title):
    x, y, w, h = view
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {w} {h}" role="img" aria-label="{title}">'
        f"<title>{title}</title>{body}</svg>\n"
    )


def save(name, text):
    open(os.path.join(OUT, name), "w", encoding="utf8").write(text)


# --- Logo
PAD = 16
full_view = (92 - PAD, 65 - PAD, 997 - 92 + 2 * PAD, 388 - 65 + 2 * PAD)
word_view = (92 - PAD, 65 - PAD, 997 - 92 + 2 * PAD, 340 - 65 + 2 * PAD)
T = "KLIIK JM — Klaten Timur II Kontrol Jurnal Mengaji"
for suffix, c_cyan, c_navy in [("", CYAN, NAVY), ("-putih", CYAN, WHITE), ("-mono", NAVY, NAVY), ("-mono-putih", WHITE, WHITE)]:
    body_word = f'<path fill="{c_cyan}" d="{cyan_all}"/><path fill="{c_navy}" d="{navy_word}"/>'
    save(f"kliik-jm-logo{suffix}.svg", svg(full_view, body_word + f'<path fill="{c_navy}" fill-rule="evenodd" d="{tag}"/>', T))
    save(f"kliik-jm-wordmark{suffix}.svg", svg(word_view, body_word, "KLIIK JM"))

# --- Ikon: K dari logo + centang. Bingkai K di gambar asli: x 92–239, y 97–306.
KX, KY, KW, KH = 92, 97, 147, 209


def k(color, size, cx, cy):
    """K setinggi `size`, titik tengahnya di (cx, cy)."""
    s = size / KH
    tx, ty = cx - (KX + KW / 2) * s, cy - (KY + KH / 2) * s
    return f'<path fill="{color}" transform="translate({tx:.2f} {ty:.2f}) scale({s:.4f})" d="{k_only}"/>'


def check(color, gap, w, pts):
    pl = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    common = 'fill="none" stroke-linecap="round" stroke-linejoin="round"'
    return (
        f'<polyline points="{pl}" {common} stroke="{gap}" stroke-width="{w * 1.9:.1f}"/>'
        f'<polyline points="{pl}" {common} stroke="{color}" stroke-width="{w:.1f}"/>'
    )


def k_cut(mid, color):
    """K dengan kaki bawah dipotong tegak lurus tepat di bawah lingkaran putih centang."""
    import math

    s = 300 / KH
    tx, ty = 222 - (KX + KW / 2) * s, 256 - (KY + KH / 2) * s
    a = (148.5 * s + tx, 205 * s + ty)  # garis tengah kaki bawah
    b = (213.1 * s + tx, 306.5 * s + ty)
    L = math.hypot(b[0] - a[0], b[1] - a[1])
    d = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
    p0 = (250, 318)  # ujung kiri centang
    t = (p0[0] - a[0]) * d[0] + (p0[1] - a[1]) * d[1]
    c = (a[0] + t * d[0], a[1] + t * d[1])
    n = (-d[1], d[0])
    poly = [(c[0] + 300 * n[0], c[1] + 300 * n[1]), (c[0] - 300 * n[0], c[1] - 300 * n[1])]
    poly += [(poly[1][0] + 600 * d[0], poly[1][1] + 600 * d[1]), (poly[0][0] + 600 * d[0], poly[0][1] + 600 * d[1])]
    pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in poly)
    return (
        f'<clipPath id="{mid}c"><rect x="195" y="0" width="400" height="600"/></clipPath>'
        f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="-100" y="-100" width="712" height="712">'
        f'<rect x="-100" y="-100" width="712" height="712" fill="#fff"/>'
        f'<polygon points="{pts}" fill="#000" clip-path="url(#{mid}c)"/></mask>'
        f'<g mask="url(#{mid})">{k(color, 300, 222, 256)}</g>'
    )


def mark(scale, bg, k_color, c_color, offset=(0, 0)):
    """Isi ikon pada kanvas 512 (K + centang), diskalakan dari tengah."""
    ox, oy = offset
    mid = f"km{abs(hash((bg, k_color, c_color))) % 10000}"
    body = k_cut(mid, k_color)
    pts = [(250, 318), (300, 366), (398, 262)]
    body += check(c_color, bg, 46, pts)
    return f'<g transform="translate({256 + ox} {256 + oy}) scale({scale}) translate(-256 -256)">{body}</g>'


def icon(name, bg, k_color, c_color, radius, scale, title="KLIIK JM"):
    rect = f'<rect width="512" height="512" rx="{radius}" fill="{bg}"/>'
    save(name, svg((0, 0, 512, 512), rect + mark(scale, bg, k_color, c_color, (-12, 0)), title))


icon("kliik-jm-icon.svg", WHITE, CYAN, NAVY, 112, 1.0)  # ikon aplikasi (seperti contoh klien)
icon("kliik-jm-icon-gelap.svg", NAVY, CYAN, WHITE, 112, 1.0)  # varian latar gelap
icon("kliik-jm-maskable.svg", WHITE, CYAN, NAVY, 0, 0.74)  # Android: isi dalam zona aman 80%
icon("kliik-jm-apple-touch.svg", WHITE, CYAN, NAVY, 0, 0.86)  # iOS membulatkan sudut sendiri
# Favicon: latar navy agar terlihat di tab terang & gelap, garis lebih tebal.
fav = (
    '<rect width="512" height="512" rx="128" fill="' + NAVY + '"/>'
    + '<g transform="translate(244 256) scale(1.18) translate(-256 -256)">'
    + k_cut("kf", WHITE)
    + check(CYAN, NAVY, 58, [(250, 318), (300, 366), (398, 262)])
    + "</g>"
)
save("kliik-jm-favicon.svg", svg((0, 0, 512, 512), fav, "KLIIK JM"))
print(sorted(os.listdir(OUT)))
