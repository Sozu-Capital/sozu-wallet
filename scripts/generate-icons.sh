#!/bin/bash
# Regenerate PWA icons, splash, and favicon from the November 2026 logo.
# Source: public/brand/november-2026/logo.png
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/generate-icons.py
