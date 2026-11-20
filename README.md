# VayuAI — Urban Air Quality & Winter Smog Intelligence
**PromptWars Virtual — [Challenge 6] Urban Air Quality Assistant**

## 1. Project Overview
**VayuAI** is a zero-API-key, responsive web application that helps Indian families, university hostels, and residential communities navigate severe winter smog. It unifies real-time [Open-Meteo CAMS](https://open-meteo.com/en/docs/air-quality-api) city telemetry, India CPCB National Air Quality Index (NAQI) piecewise breakpoints, CAQM GRAP Stages I–IV, WHO 2021 Air Quality Guidelines, Berkeley Earth cigarette-equivalent health risk, DIY MERV-13 CADR room filtration physics, and ITF-OECD sustainable transit math into a clean 4-tab workspace.

## 2. Problem Statement
During winter temperature inversions across urban India, the atmospheric boundary layer drops below 100 metres and traps `PM2.5` near ground level. Families and students need actionable guidance on:
1. **Timing & Respiratory Safety**: Identifying peak morning inversion traps (`06:00–09:00`) vs. the afternoon solar mixing window (`13:00–16:00`), and understanding how unsealed masks leak `27%–58%` of PM2.5.
2. **Affordable Indoor Air Filtration**: Comparing commercial True HEPA purifiers (`282 CFM`, `~$549`) against peer-reviewed DIY MERV-13 Corsi-Rosenthal boxes (`293–850 CFM`, `~$35–$65`, `70%–92%` PM2.5 reduction).
3. **Quantified Sustainable Swaps**: Visualizing direct carbon and health impacts of switching from private/shared cars to electric buses (`-71%` to `-79%`) or cycling (`-75%`).

## 3. Features
- **Overview**: Radial SVG CPCB AQI gauge, free keyless Open-Meteo Live City Sync (`Sync Live`), 4 verified Indian city presets (`Delhi NCR`, `Jodhpur`, `Jaipur`, `Mumbai`), Berkeley Earth cigarette equivalence (`22 µg/m³` = 1 cig/day), bilingual English/Hinglish Assistant with Voice Read-Aloud, 24-hour smog curve (`Chart.js`), and expandable CPCB/GRAP standards drawer.
- **Daily Shield**: Interactive 6-slot Low-Emission Routine checklist with live keyword filtering, empty-state handling, and Respirator Mask Fit-Leakage Lab (`N95 Sealed 97.2%` vs `N95 Loose 70%`, `FFP2 94%`, `Surgical 70%`, `Cloth 41.6%`).
- **Home Air**: Room CADR & 60-minute PM2.5 decay simulator, interactive 2D 4-Zone Home/Hostel Floorplan (`Z1–Z4`), Zero-Cost Home Air Hacks, and NASA Clean Air Study VOC plants companion.
- **Impact & Export**: ITF-OECD & Our World in Data Sustainable Commute Swap calculator (`₹12,118/tCO₂e` WRI abatement value), Community & Hostel Shield, downloadable `.SVG` protocol poster, bilingual WhatsApp advisory, `.JSON`/`.MD`/PDF export, and collapsible PromptWars submission answers.

## 4. Technology Stack
- **Frontend**: Semantic HTML5, Tailwind CSS (`3.4.17`), Strict-Mode Modular Vanilla ES2022 JavaScript (`IIFE` + event delegation + safe DOM construction), Chart.js (`4.4.1`), Web Speech API (`speechSynthesis`).
- **Live Data (Zero API Key)**: Open-Meteo Geocoding (`geocoding-api.open-meteo.com`) & CAMS Air Quality (`air-quality-api.open-meteo.com`).
- **Optional Serverless Proxy**: Node.js Vercel Serverless Function (`api/gemini.js`) reading `process.env.GEMINI_API_KEY`.
- **Testing & QA**: Python 3 (`unittest`, `BeautifulSoup4`) + Node.js (`v18+`) test harness (`tests/test_suite.py`).

## 5. Architecture
```text
Air_Ai/
├── api/
│   └── gemini.js            # Vercel Serverless Function proxy (server-side GEMINI_API_KEY)
├── tests/
│   └── test_suite.py        # 15-test automated QA, security, API, code-quality & DOM suite
├── index.html               # Self-contained, strict-mode IIFE SPA (zero global pollution)
├── vercel.json              # Vercel rewrites + HTTP security headers
├── .env.example             # Environment variable template
├── .gitignore               # Excludes .env, node_modules, .vercel
├── SUBMISSION_ANSWERS.txt   # Ready-to-paste PromptWars submission copy
└── README.md                # Architecture, testing & deployment guide
```

## 6. Installation Instructions
```bash
git clone https://github.com/ravindrajaipal/Air_Ai.git
cd Vayu_ai
python3 -m http.server 8080
# Open http://localhost:8080
```

## 7. Environment Variable Setup
No API keys are required to run VayuAI. To optionally enable the server-side Gemini proxy on Vercel:
```bash
cp .env.example .env.local
# Set GEMINI_API_KEY=your_key in .env.local or Vercel Project Settings -> Environment Variables
```

## 8. API Configuration
- **Zero-Key Live Air Quality**: Fetches live coordinates and hourly `PM2.5`/`PM10` from Open-Meteo (`8,000ms` `AbortController` timeout, automatic fallback to verified CPCB snapshots offline).
- **Optional Serverless Endpoint (`POST /api/gemini`)**: Validates object JSON body, clamps `aqi`/`pm25`, enforces `280`-char prompt limit, returns `204/400/405/503/502/504` status codes cleanly.

## 9. Testing Instructions
```bash
python3 tests/test_suite.py
```

## 10. Deployment Instructions
1. Push all files to your public GitHub repository (`ravindrajaipal/Air_Ai`).
2. Import into [Vercel](https://vercel.com) with **Framework Preset: Other** and click **Deploy** (or drag and drop onto [Netlify Drop](https://app.netlify.com/drop)).

## 11. Assumptions and Limitations
- **Zero-Key Deterministic Engine**: Without a Gemini API key, the assistant runs its built-in **Zero-Key CPCB/WHO Engine** and labels every card transparently.
- **Methodology Scope**: Berkeley Earth (`22 µg/m³` = 1 cig/day) is a population-level risk communication aid; NASA Clean Air plants serve as VOC/humidity companions alongside mechanical HEPA/MERV-13 filtration.

## 12. Scientific Methodology & Indoor Mass-Balance Model
- **Multi-Pollutant Sub-Index**: Computes `max(CPCB_PM2.5_subindex, CPCB_PM10_subindex)` using official CPCB 24-hr breakpoints and explicitly labels outputs `Est. AQI` (never claiming a 1–2 pollutant estimate is an official 8-pollutant 24-hr CPCB station bulletin).
- **Regulatory GRAP Scope**: CAQM GRAP Stages I–IV are displayed strictly for Delhi-NCR jurisdictions; non-NCR cities display CPCB Advisory Bands.
- **Single-Zone Mass-Balance Equation**: `C_ss = (P * lambda_inf * C_out + S_in) / (lambda_inf + k_dep + ACH_cadr)` with residential deposition `k_dep = 0.39 h⁻¹` and analytical exponential decay `C(t) = C_ss + (C_0 - C_ss) * exp(-k_loss * t_hr)`.
