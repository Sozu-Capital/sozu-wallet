#!/usr/bin/env python3
"""Regenerate Sozu Wallet icons from the November 2026 logo.

Source of truth: public/brand/november-2026/logo.png
(white mark on black, 512×512). Requires Pillow.
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow is required: pip install pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "public" / "brand" / "november-2026" / "logo.png"
MARK = ROOT / "public" / "brand" / "november-2026" / "mark.png"
ICONS = ROOT / "public" / "icons"
FAVICON = ROOT / "public" / "favicon.ico"

ICON_SIZES = (72, 96, 128, 144, 152, 180, 192, 384, 512)
SPLASH_SIZE = 2732
SPLASH_ICON = 512


def to_mark(master: Image.Image) -> Image.Image:
    """White mark, alpha from luminance, so it sits on the black app UI."""
    src = master.convert("RGBA")
    out = Image.new("RGBA", src.size, (0, 0, 0, 0))
    spx = src.load()
    dpx = out.load()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, _a = spx[x, y]
            lum = (r + g + b) // 3
            dpx[x, y] = (255, 255, 255, lum)
    return out


def main() -> None:
    if not MASTER.is_file():
        print(f"Missing master logo: {MASTER}", file=sys.stderr)
        sys.exit(1)

    master = Image.open(MASTER).convert("RGBA")
    if master.size != (512, 512):
        master = master.resize((512, 512), Image.Resampling.LANCZOS)

    MARK.parent.mkdir(parents=True, exist_ok=True)
    ICONS.mkdir(parents=True, exist_ok=True)
    to_mark(master).save(MARK, "PNG", optimize=True)

    for size in ICON_SIZES:
        icon = master.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(ICONS / f"sozu_icon_{size}.png", "PNG", optimize=True)

    webp = master.resize((512, 512), Image.Resampling.LANCZOS)
    webp.save(ICONS / "sozu_icon.webp", "WEBP", quality=90, method=6)

    splash = Image.new("RGB", (SPLASH_SIZE, SPLASH_SIZE), (0, 0, 0))
    tile = master.resize((SPLASH_ICON, SPLASH_ICON), Image.Resampling.LANCZOS).convert("RGB")
    offset = (SPLASH_SIZE - SPLASH_ICON) // 2
    splash.paste(tile, (offset, offset))
    splash.save(ICONS / "sozu_splash.png", "PNG", optimize=True)

    master.save(
        FAVICON,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    print(f"Wrote icons from {MASTER.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
