# GX 444 — Educational Random-Number Simulator

**GX 444** is a lightweight, mobile-first dark gaming UI web application built with **HTML5, CSS3, and Vanilla JavaScript**. It demonstrates transparent local random-number generation (`0–9`), `BIG` / `SMALL` classification, real-time statistical tracking, and `localStorage` persistence.

> **Educational Disclaimer:** GX 444 is strictly an educational simulator. It uses `crypto.getRandomValues()` locally on your device, contains **no Period ID tracking**, connects to **no external prediction APIs**, and **cannot predict real gambling outcomes**.

---

## Features

- **Demo Access Lock**: Client-side UI demo lock (`GX444`) with show/hide passcode toggle and error feedback (clearly labeled as a UI demo lock, not secure authentication).
- **Dashboard Simulator**:
  - Signal card (`WAITING` / `DEMO RESULT`)
  - Number card (`0–9`) with `BIG` (5–9) / `SMALL` (0–4) classification
  - 30-second countdown timer with Pause/Resume and accurate Android background-tab synchronization
  - Working **HIDE**, **HISTORY**, **REFRESH**, and **RESET** buttons
- **Crypto RNG Engine (`random-engine.js`)**: Unbiased `0–9` integer generation using `crypto.getRandomValues()` with rejection sampling.
- **History System (`history.js`)**: Saves results to `localStorage`, displays the latest 100 records, supports search, `ALL` / `BIG` / `SMALL` filtering, confirmation-protected clearing, and CSV export.
- **Statistical Analysis (`statistics.js`)**: Calculates totals, BIG/SMALL ratios, `0–9` frequency bar chart, recent 10 chips, recent 50 breakdown, and longest BIG/SMALL streaks strictly from stored results.
- **External Website Section**: Safe `OPEN WEBSITE` link for `https://dkwin9.com/` and an optional preview iframe that respects `X-Frame-Options` / CSP without bypassing security policies or collecting credentials.
- **Settings**: Web Audio synthesized sound toggle, Android vibration toggle, Dark Theme profiles (`Neon Carbon` / `OLED Obsidian`), data reset controls, and About section.

---

## Setup Instructions (Android Phone or Desktop)

1. Create a folder named `GX-444`.
2. Save all 7 files inside `GX-444/`:
   - `index.html`
   - `style.css`
   - `random-engine.js`
   - `history.js`
   - `statistics.js`
   - `script.js`
   - `README.md`
3. Open `index.html` directly in Chrome on Android (or serve locally using any static server), enter demo passcode **`GX444`**, and explore the simulator.