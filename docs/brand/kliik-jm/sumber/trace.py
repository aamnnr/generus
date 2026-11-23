# Telusuri logo KLIIK JM (PNG dari klien) menjadi path SVG per warna.
# Huruf logo hampir semuanya bersudut tegas, jadi poligon hasil approxPolyDP sudah rapi;
# tagline (huruf kecil membulat) ditelusuri dari gambar yang diperbesar agar halus.
import json
import sys

import cv2
import numpy as np

SRC, OUT = sys.argv[1], sys.argv[2]
NAVY = np.array([137, 33, 26])  # BGR #1A2189
CYAN = np.array([215, 140, 0])  # BGR #008CD7
SCALE = 6

img = cv2.imread(SRC).astype(np.float32)


def mask_for(color, blur=0.45):
    d = np.linalg.norm(img - color, axis=2)
    # 0..1: semakin dekat warna, semakin tinggi; tepi antialias ikut halus.
    m = np.clip(1 - (d - 40) / 90, 0, 1)
    big = cv2.resize(m, None, fx=SCALE, fy=SCALE, interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), SCALE * blur)
    return (big > 0.5).astype(np.uint8) * 255


def paths(mask, keep, eps):
    """Kontur (dengan lubang) yang kontur luarnya lolos `keep(tinggi_px)`."""
    contours, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    for i, c in enumerate(contours):
        parent = hier[0][i][3]
        outer = c if parent < 0 else contours[parent]
        _, _, _, h = cv2.boundingRect(outer)
        if not keep(h / SCALE) or cv2.contourArea(c) < (1.5 * SCALE) ** 2:
            continue
        a = cv2.approxPolyDP(c, eps * SCALE, True).reshape(-1, 2) / SCALE
        out.append((float(a[:, 0].min()), "M" + "L".join(f"{x:.2f} {y:.2f}" for x, y in a) + "Z"))
    return out


navy, cyan = mask_for(NAVY), mask_for(CYAN)
# Huruf besar bersudut tegas: blur kecil + toleransi lebih besar agar sudut tetap lancip.
navy_sharp, cyan_sharp = mask_for(NAVY, 0.2), mask_for(CYAN, 0.2)
data = {
    "word_cyan": paths(cyan_sharp, lambda h: h > 100, 1.0),
    "word_navy": paths(navy_sharp, lambda h: h > 100, 1.0),
    "tag_navy": paths(navy, lambda h: h <= 100, 0.25),
}
json.dump(data, open(OUT, "w"))
print({k: len(v) for k, v in data.items()})
