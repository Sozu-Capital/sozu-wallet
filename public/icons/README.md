# PWA icons

These icons are generated from the November 2026 logo (`public/brand/november-2026/logo.png`). See `docs/brand/november-2026-logo.md`.

## Files

- `sozu_icon_72.png` through `sozu_icon_512.png` — manifest and Apple touch icons
- `sozu_icon_180.png` — Apple touch icon
- `sozu_icon.webp` — webp copy of the 512 master
- `sozu_splash.png` — iOS startup image

## Regenerating

From the repo root, with Pillow installed:

```bash
python3 scripts/generate-icons.py
```
