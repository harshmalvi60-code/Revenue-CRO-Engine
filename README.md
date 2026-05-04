# Revenue CRO Engine

Senior-consultant-grade conversion audit tool for D2C brands. Built by Yuvaan Technologies.

## Stack

- React 18 + Vite
- Tailwind CSS (CDN at runtime, plus PostCSS for utilities)
- Anthropic Claude API (Sonnet 4) via Vercel serverless proxy
- localStorage for client-side persistence

## Local development

```bash
npm install
cp .env.example .env
# add your real ANTHROPIC_API_KEY
npm run dev
```

For full local testing including the `/api/claude` serverless function, install the [Vercel CLI](https://vercel.com/docs/cli) and run:

```bash
vercel dev
```

## Configure before deploying

Open `src/App.jsx` and replace the placeholder URLs:

- `APPS_SCRIPT_URL` — your Google Apps Script Web App `/exec` URL (handles lead capture POSTs)
- `STRATEGY_CALL_URL` — your Calendly / Cal.com booking link

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Set the environment variable in **Settings → Environment Variables**:
   - `ANTHROPIC_API_KEY` = your Claude API key
4. Deploy. Vercel auto-detects Vite and exposes `api/claude.js` as a serverless function.

## Apps Script for lead capture

In your Google Sheet → Extensions → Apps Script, paste:

```js
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()
    .appendRow([new Date(), data.name, data.email, data.country]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Deploy as Web App → Anyone access → copy the `/exec` URL into `APPS_SCRIPT_URL`.

## Project structure

```
revenue-cro-engine/
├── api/
│   └── claude.js          # Anthropic API proxy (Vercel function)
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx            # Full app (dashboard, wizard, report, modals)
│   ├── main.jsx           # Entry + window.storage shim
│   └── index.css          # Tailwind + base styles
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vercel.json
└── vite.config.js
```
