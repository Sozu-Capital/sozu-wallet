# November 2026 logo

The November 2026 mark is the Sozu Wallet logo. It replaces the earlier branching symbol in the app UI, onboarding slides, PWA icons, iOS splash, and favicon.

The mark is a single white ribbon on black. Product UI uses that artwork only.

## Files

| File | Use |
| --- | --- |
| `public/brand/november-2026/logo.png` | Canonical master. White mark on black, 512×512. |
| `public/brand/november-2026/mark.png` | Same placement, transparent background, for the app UI. |
| `public/favicon.ico` | Browser icon (16, 32, and 48), generated from the master. |
| `public/icons/sozu_icon_*.png` | PWA manifest and Apple touch icons. |
| `public/icons/sozu_splash.png` | iOS startup image. |

## Regenerating icons

From the repo root, with Pillow installed:

```bash
python3 scripts/generate-icons.py
```

That rewrites the favicon, PWA icons, splash, and `mark.png` from `logo.png`. It does not redraw the onboarding slides. Those are composited artwork that already uses this mark.
