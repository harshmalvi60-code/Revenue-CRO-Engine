import { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, Building2, Users, Settings, Plus, ArrowRight, ArrowLeft,
  Upload, Loader2, Download, Trash2, Zap, AlertOctagon,
  AlertTriangle, CheckCircle2, Sparkles, FileText, X, ChevronRight,
  Globe, Target, MapPin, DollarSign, TrendingUp, Eye, MessageSquare,
  ShieldCheck, ImageIcon, Wand2, ListChecks, Copy, Check, Mail, UserPlus
} from 'lucide-react';

// ---------- Theme ----------
const C = {
  bg: '#ffffff',
  surface: '#ffffff',
  surface2: '#fafaf7',     // hover / subtle elevation
  surface3: '#f4f1ec',     // pressed / divider blocks
  border: '#e8e4dd',
  borderSoft: '#f0ece5',
  text: '#0a0a0a',         // near-black
  textMute: '#6b6760',
  textDim: '#a8a39a',
  accent: '#ff5a1f',       // primary orange — everything that has color
  accentSoft: '#fff1ea',   // tinted backgrounds
  accentDeep: '#d94715',
  black: '#0a0a0a',
};

const FONT_DISPLAY = '"Montserrat", system-ui, sans-serif';
const FONT_SANS = '"Glacial Indifference", "Outfit", "Inter", system-ui, sans-serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

// ---------- Inject fonts + global styles ----------
function useGlobalStyles() {
  useEffect(() => {
    // Google Fonts: Montserrat, Outfit (Glacial Indifference fallback), JetBrains Mono
    const id = 'audit-fonts';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap';
      document.head.appendChild(link);
    }
    // Glacial Indifference from CDN (with graceful fallback to Outfit if it fails)
    const id2 = 'audit-fonts-gi';
    if (!document.getElementById(id2)) {
      const link2 = document.createElement('link');
      link2.id = id2;
      link2.rel = 'stylesheet';
      link2.href = 'https://fonts.cdnfonts.com/css/glacial-indifference-2';
      document.head.appendChild(link2);
    }

    const styleId = 'audit-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        body { background: ${C.bg}; }
        .scrollbar-thin::-webkit-scrollbar { width: 8px; height: 8px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: ${C.textDim}; }
        .fade-in { animation: fadeIn 0.4s ease forwards; opacity: 0; }
        @keyframes fadeIn { to { opacity: 1; } }
        .pulse-dot { animation: pulse 1.4s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        .marquee-num { font-feature-settings: "tnum" on, "lnum" on; }
        .heading { font-family: ${FONT_DISPLAY}; font-weight: 600; letter-spacing: -0.02em; }

        /* Default: print-only blocks hidden on screen */
        .print-only { display: none; }

        /* Print styles for clean PDF export */
        @media print {
          @page { margin: 14mm 12mm; size: A4; }
          html, body { background: #ffffff !important; color: #0a0a0a !important; }
          /* Force all colors to render in PDF */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          /* Hide chrome — sidebar, action buttons, modals */
          .no-print { display: none !important; }
          /* Show print-only stacked content */
          .print-only { display: block !important; }
          .screen-only { display: none !important; }
          /* Reset scroll containers so all content prints */
          .print-root, .print-root > * { height: auto !important; overflow: visible !important; }
          /* Avoid awkward page breaks */
          h1, h2, h3 { page-break-after: avoid; }
          .print-keep, .print-keep * { page-break-inside: avoid; }
          /* Tighten card shadows for cleaner print */
          .print-root [class*="rounded-2xl"] { box-shadow: none !important; }
        }
      `;
      document.head.appendChild(style);
    }

    // Auto-expand all <details> elements before print, restore after.
    // This makes the "X leaks — view fixes" collapses appear fully in the PDF.
    const beforePrint = () => {
      document.querySelectorAll('details').forEach(d => {
        d.dataset._wasOpen = d.open ? '1' : '0';
        d.open = true;
      });
    };
    const afterPrint = () => {
      document.querySelectorAll('details').forEach(d => {
        d.open = d.dataset._wasOpen === '1';
        delete d.dataset._wasOpen;
      });
    };
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, []);
}

// ---------- Storage helpers ----------
const store = {
  async get(key, fallback = null) {
    try {
      const r = await window.storage.get(key);
      if (!r) return fallback;
      try { return JSON.parse(r.value); } catch { return r.value; }
    } catch { return fallback; }
  },
  async set(key, value) {
    try {
      await window.storage.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      return true;
    } catch { return false; }
  },
  async delete(key) {
    try { await window.storage.delete(key); return true; } catch { return false; }
  },
  async list(prefix = '') {
    try {
      const r = await window.storage.list(prefix);
      return r?.keys || [];
    } catch { return []; }
  }
};

// ---------- Lead capture + booking config ----------
// TODO: replace with your Google Apps Script Web App deployment URL.
// Your doPost(e) should read JSON from e.postData.contents and append to your sheet.
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOYMENT_ID/exec';

// TODO: replace with your Calendly / Cal.com / booking link
const STRATEGY_CALL_URL = 'https://calendly.com/yuvaan-technologies/strategy-call';

async function submitLead({ name, email, country }) {
  try {
    const payload = { name, email, country, submittedAt: new Date().toISOString() };
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',                       // Apps Script doesn't return CORS headers; no-cors keeps the request fire-and-forget so the browser doesn't reject it
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // With mode: 'no-cors' the response is opaque, so a resolved fetch is our success signal.
    console.log('[submitLead] data sent successfully:', payload);
    return true;
  } catch (e) {
    // Best-effort — never block the audit on lead capture
    console.warn('[submitLead] submission failed:', e);
    return false;
  }
}

// ---------- Utilities ----------
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDateTime = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// Conversion Potential Score: prefer new field, fall back to inverting old leak score for older audits.
const getPotentialScore = (e) => {
  if (!e) return 0;
  if (typeof e.conversionPotentialScore === 'number') return e.conversionPotentialScore;
  if (typeof e.revenueLeakScore === 'number') return Math.max(0, 100 - e.revenueLeakScore);
  return 0;
};

async function fileToResizedBase64(file, maxW = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- Anthropic API analysis ----------
const SYSTEM_PROMPT = `You are a senior conversion rate optimization consultant who has personally guided 500+ direct-to-consumer brands to combined revenue over $2B. You've worked with brands across the price spectrum — from $20 essentials to $2,000 luxury — in markets from Mumbai to Manhattan to Berlin.

You spot conversion opportunities in seconds. You don't deliver vague advice — you deliver specific, implementable guidance. When you say "the hero copy could be sharper," you rewrite it. When you say "the page needs more trust," you list exactly which signals to add and where.

Your tone is direct, founder-to-founder, expert and insightful — but always guiding and constructive. You diagnose with care, frame issues as opportunities, and pair every observation with a clear path forward. You sound like the seasoned operator coaching a promising founder, not a critic tearing apart their work. Acknowledge what's working. Be specific about what to improve and why. Make every fix feel achievable.

You always respond with valid JSON only. No preamble, no markdown code fences, no explanation outside the JSON. Start your response with { and end with }.`;

function buildContextBlock(audit) {
  const c = audit.context;
  return `# Brand Context
Brand: ${audit.brandName}
Industry: ${c.industry || 'D2C'}
Target audience: ${c.audience || 'not specified'}
Primary market / country: ${c.country || 'not specified'}
Price range: ${c.priceRange || 'not specified'}
Primary traffic source: ${c.trafficSource || 'not specified'}
Brand description / positioning: ${c.description || 'not specified'}

# Pages provided (in order: homepage, collection, product page${audit.pages.extra?.screenshot ? ', additional page' : ''})
- Homepage URL: ${audit.pages.homepage.url || '(not provided)'}
- Collection page URL: ${audit.pages.collection.url || '(not provided)'}
- Product page URL: ${audit.pages.pdp.url || '(not provided)'}
${audit.pages.extra?.url ? `- Extra page (${audit.pages.extra.label || 'cart/checkout'}) URL: ${audit.pages.extra.url}` : ''}

Analyze the screenshots in the order listed above.`;
}

function buildImageBlocks(audit) {
  const blocks = [];
  ['homepage', 'collection', 'pdp', 'extra'].forEach(k => {
    const p = audit.pages[k];
    if (p?.screenshot) {
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: p.screenshot }
      });
    }
  });
  return blocks;
}

// Walk JSON-ish text and try to recover a parseable object even if truncated mid-stream.
function repairTruncatedJson(text) {
  let depth = [];
  let inString = false;
  let escape = false;
  let lastValidEnd = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (inString) {
      if (c === '\\') { escape = true; continue; }
      if (c === '"') { inString = false; continue; }
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{' || c === '[') depth.push(c);
    else if (c === '}') { if (depth[depth.length - 1] === '{') depth.pop(); lastValidEnd = i + 1; }
    else if (c === ']') { if (depth[depth.length - 1] === '[') depth.pop(); lastValidEnd = i + 1; }
    else if (c === ',' && depth.length > 0) lastValidEnd = i;
  }
  if (lastValidEnd === 0) return null;
  let prefix = text.slice(0, lastValidEnd).replace(/,\s*$/, '');
  // Recompute what's still open in the prefix
  depth = []; inString = false; escape = false;
  for (let i = 0; i < prefix.length; i++) {
    const c = prefix[i];
    if (escape) { escape = false; continue; }
    if (inString) {
      if (c === '\\') { escape = true; continue; }
      if (c === '"') { inString = false; continue; }
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{' || c === '[') depth.push(c);
    else if (c === '}' || c === ']') depth.pop();
  }
  while (depth.length) {
    const d = depth.pop();
    prefix += d === '{' ? '}' : ']';
  }
  try { return JSON.parse(prefix); } catch { return null; }
}

async function callClaude(audit, taskPrompt, maxTokens = 4000) {
  const messages = [{
    role: 'user',
    content: [
      ...buildImageBlocks(audit),
      { type: 'text', text: buildContextBlock(audit) + '\n\n' + taskPrompt }
    ]
  }];

  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();

  // Extract JSON — strip code fences and pre-amble before {
  let clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const firstBrace = clean.indexOf('{');
  if (firstBrace > 0) clean = clean.slice(firstBrace);

  try {
    return JSON.parse(clean);
  } catch (e) {
    const repaired = repairTruncatedJson(clean);
    if (repaired) return repaired;
    throw new Error(`JSON parse failed (${e.message.slice(0, 80)})`);
  }
}

const TASK_EXEC = `# Your task
Produce ONLY the executive summary. Return ONLY this JSON, no extra fields, no markdown fences:

{
  "executiveSummary": {
    "verdict": "2 sentences. Direct, founder-to-founder. Lead with what this store is doing well, then name the single biggest opportunity to lift conversion.",
    "conversionPotentialScore": <integer 0-100, where 100 = already highly optimized and 0 = significant fundamentals to address. This represents how well the funnel is currently positioned to convert>,
    "scoreReasoning": "one constructive sentence explaining the score",
    "estimatedConversionLift": "e.g. '+35-60% within 30 days if top 3 opportunities ship'",
    "topThreeLeaks": [
      { "title": "<short punchy opportunity title>", "severity": "critical|high|medium", "estImpact": "e.g. '~15-25% conversion lift'", "summary": "one sentence on the opportunity and the upside" }
    ]
  }
}

Exactly 3 items in topThreeLeaks. Frame each as an opportunity with clear upside, not a failure. Be specific to what you actually see in the screenshots.`;

const TASK_FUNNEL_HOME = `# Your task
Analyze ONLY the homepage (the FIRST screenshot). Return ONLY this JSON:

{
  "funnel": {
    "homepage": {
      "score": <0-100>,
      "firstFiveSeconds": "What does a cold visitor think/feel/understand in 5 seconds? Specific.",
      "strengths": ["2-3 short items"],
      "leaks": [
        { "title": "...", "severity": "critical|high|medium", "where": "specific section/element", "why": "what's costing this brand conversions and why", "fix": "the specific change to make — clear enough to ship today" }
      ]
    }
  }
}

3-4 opportunities max. Reference real elements you see (hero, nav, announcement bar, social proof strip, etc.). Frame each as an upside, not a failure.`;

const TASK_FUNNEL_REST = `# Your task
Analyze the collection page (SECOND screenshot) and product detail page (THIRD screenshot). Return ONLY this JSON:

{
  "funnel": {
    "collection": {
      "score": <0-100>,
      "firstFiveSeconds": "...",
      "strengths": ["2-3 items"],
      "leaks": [{ "title", "severity": "critical|high|medium", "where", "why", "fix" }]
    },
    "pdp": {
      "score": <0-100>,
      "firstFiveSeconds": "...",
      "strengths": ["2-3 items"],
      "leaks": [{ "title", "severity": "critical|high|medium", "where", "why", "fix" }]
    }
  }
}

3 opportunities per page max. Reference actual elements (product grid, filters, gallery, size selector, reviews block, sticky add-to-cart, etc.). Constructive framing.`;

const TASK_EXTRAS = `# Your task
Audit trust, offer/pricing, messaging fit, and product presentation. Return ONLY this JSON:

{
  "trust": {
    "score": <0-100>,
    "wouldANewUserBuy": "1-2 sentences — does a first-time visitor feel confident enough to buy? What would tip them over?",
    "presentSignals": ["what trust signals exist on the site"],
    "missingSignals": ["specific signals that should be there but aren't"],
    "leaks": [{ "title", "severity": "critical|high|medium", "where", "why", "fix" }]
  },
  "offerPricing": {
    "score": <0-100>,
    "perceivedValue": "Does perceived value match the price for this audience in this country?",
    "offerStrength": "Is the current offer compelling enough to act on?",
    "pricingForCountry": "How does pricing land for the stated market?",
    "leaks": [{ "title", "severity", "where", "why", "fix" }]
  },
  "messaging": {
    "score": <0-100>,
    "audienceAlignment": "Does the messaging speak to the stated audience?",
    "trafficIntentMatch": "Does the page match intent of the stated traffic source?",
    "leaks": [{ "title", "severity", "where", "why", "fix" }]
  },
  "presentation": {
    "score": <0-100>,
    "imageQuality": "Honest read on imagery — composition, lighting, consistency, lifestyle vs studio. What's working and what would lift it.",
    "branding": "Is the brand identity coherent and memorable? Where could it feel more premium?",
    "leaks": [{ "title", "severity", "where", "why", "fix" }]
  }
}

Max 2 opportunities per section. Be specific and constructive — every issue paired with a clear path forward.`;

const TASK_REWRITES = `# Your task
Produce copy-ready rewrites and a prioritized 30-day roadmap. Return ONLY this JSON:

{
  "rewrites": {
    "headlines": [
      { "context": "where this would go (e.g. 'Homepage hero H1')", "current": "what's there or 'inferred from screenshot'", "rewritten": "punchy new copy — specific, audience-aware", "reasoning": "one sentence on why this wins" }
    ],
    "ctas": [
      { "context": "...", "current": "...", "rewritten": "...", "reasoning": "..." }
    ],
    "valueProps": [
      { "context": "...", "current": "...", "rewritten": "...", "reasoning": "..." }
    ],
    "offerIdeas": [
      { "title": "name of the offer", "description": "what it is in 1-2 sentences", "expectedImpact": "rough impact on CVR or AOV" }
    ]
  },
  "roadmap": [
    { "priority": <integer>, "action": "specific thing to ship", "category": "copy|design|trust|offer|tech", "effort": "low|medium|high", "expectedLift": "e.g. '+8-15% on PDP CVR'", "rationale": "one sentence" }
  ]
}

3-4 headlines, 3 CTAs, 3 value props, 2-3 offer ideas, 6-7 roadmap items in priority order.`;

async function runFullAnalysis(audit, onStatus) {
  const tasks = [
    { key: 'exec',     prompt: TASK_EXEC,         max: 1500 },
    { key: 'home',     prompt: TASK_FUNNEL_HOME,  max: 2500 },
    { key: 'rest',     prompt: TASK_FUNNEL_REST,  max: 3500 },
    { key: 'extras',   prompt: TASK_EXTRAS,       max: 4000 },
    { key: 'rewrites', prompt: TASK_REWRITES,     max: 4000 },
  ];

  // Rotate status messages while we wait
  const messages = [
    'Reading the homepage like a cold visitor…',
    'Tracing the funnel — collection → PDP…',
    'Auditing trust signals and social proof…',
    'Stress-testing the offer for this market…',
    'Checking message-to-audience fit…',
    'Rewriting hooks and CTAs…',
    'Sequencing the 30-day fix roadmap…',
    'Stitching the diagnosis together…'
  ];
  let i = 0;
  onStatus?.(messages[0]);
  const interval = setInterval(() => {
    i++;
    onStatus?.(messages[i % messages.length]);
  }, 3500);

  try {
    const settled = await Promise.allSettled(
      tasks.map(t => callClaude(audit, t.prompt, t.max))
    );

    const failed = [];
    let merged = {};
    settled.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value && typeof r.value === 'object') {
        const v = r.value;
        // funnel is the only key that can come from two calls — deep-merge it
        if (v.funnel) merged.funnel = { ...(merged.funnel || {}), ...v.funnel };
        Object.keys(v).forEach(k => {
          if (k !== 'funnel') merged[k] = v[k];
        });
      } else {
        failed.push(tasks[idx].key);
        // eslint-disable-next-line no-console
        console.warn(`[leakfinder] ${tasks[idx].key} failed:`, r.reason?.message || r.reason);
      }
    });

    if (!merged.executiveSummary) {
      throw new Error(
        `Could not generate the executive summary${failed.length ? ` (${failed.length}/${tasks.length} sections failed)` : ''}. ` +
        `This is usually transient — try once more with the same inputs.`
      );
    }

    return { result: merged, failedSections: failed };
  } finally {
    clearInterval(interval);
  }
}

// ---------- Markdown export ----------
function auditToMarkdown(audit) {
  const r = audit.result || {};
  const e = r.executiveSummary || {};
  const f = r.funnel || {};
  const lines = [];
  lines.push(`# Revenue Audit — ${audit.brandName}`);
  lines.push(`*${fmtDateTime(audit.completedAt || audit.createdAt)} • ${audit.context.country || ''} • ${audit.context.priceRange || ''}*\n`);
  lines.push(`## Executive Summary\n`);
  lines.push(`**Conversion Potential Score: ${getPotentialScore(e)}/100** — ${e.scoreReasoning || ''}\n`);
  lines.push(`**Estimated lift if top 3 fixes ship:** ${e.estimatedConversionLift || '—'}\n`);
  lines.push(`> ${e.verdict || ''}\n`);
  lines.push(`### Top 3 Opportunities`);
  (e.topThreeLeaks || []).forEach((l, i) => {
    lines.push(`${i + 1}. **${l.title}** _(${l.severity})_ — ${l.summary} *(${l.estImpact})*`);
  });
  lines.push('');

  const renderPage = (key, label) => {
    const p = f[key]; if (!p) return;
    lines.push(`## ${label} — ${p.score}/100`);
    lines.push(`**First 5 seconds:** ${p.firstFiveSeconds}\n`);
    if (p.strengths?.length) lines.push(`**Strengths:** ${p.strengths.join(', ')}\n`);
    lines.push(`### Leaks`);
    (p.leaks || []).forEach(l => {
      lines.push(`- **${l.title}** _(${l.severity})_`);
      lines.push(`  - Where: ${l.where}`);
      lines.push(`  - Why: ${l.why}`);
      lines.push(`  - Fix: ${l.fix}`);
    });
    lines.push('');
  };
  renderPage('homepage', 'Homepage');
  renderPage('collection', 'Collection Page');
  renderPage('pdp', 'Product Page');

  const renderSection = (key, label) => {
    const s = r[key]; if (!s) return;
    lines.push(`## ${label} — ${s.score}/100`);
    Object.entries(s).forEach(([k, v]) => {
      if (k === 'score' || k === 'leaks') return;
      if (Array.isArray(v)) lines.push(`**${k}:** ${v.join(', ')}\n`);
      else if (typeof v === 'string') lines.push(`**${k}:** ${v}\n`);
    });
    if (s.leaks?.length) {
      lines.push(`### Leaks`);
      s.leaks.forEach(l => {
        lines.push(`- **${l.title}** _(${l.severity})_ — ${l.why}`);
        lines.push(`  - Fix: ${l.fix}`);
      });
    }
    lines.push('');
  };
  renderSection('trust', 'Trust & Credibility');
  renderSection('offerPricing', 'Offer & Pricing');
  renderSection('messaging', 'Messaging & Audience Fit');
  renderSection('presentation', 'Product Presentation');

  if (r.rewrites) {
    lines.push(`## Copy-Ready Rewrites\n`);
    const rw = r.rewrites;
    const sec = (label, arr) => {
      if (!arr?.length) return;
      lines.push(`### ${label}`);
      arr.forEach(x => {
        lines.push(`**${x.context}**`);
        lines.push(`- Current: ${x.current}`);
        lines.push(`- Rewritten: **${x.rewritten}**`);
        lines.push(`- Why: ${x.reasoning}\n`);
      });
    };
    sec('Headlines', rw.headlines);
    sec('CTAs', rw.ctas);
    sec('Value Props', rw.valueProps);
    if (rw.offerIdeas?.length) {
      lines.push(`### Offer Ideas`);
      rw.offerIdeas.forEach(o => lines.push(`- **${o.title}** — ${o.description} *(${o.expectedImpact})*`));
      lines.push('');
    }
  }

  if (r.roadmap?.length) {
    lines.push(`## 30-Day Priority Roadmap\n`);
    r.roadmap.forEach(item => {
      lines.push(`**${item.priority}. ${item.action}** _(${item.category} · ${item.effort} effort · ${item.expectedLift})_`);
      lines.push(`   ${item.rationale}\n`);
    });
  }

  return lines.join('\n');
}

function downloadMarkdown(audit) {
  const md = auditToMarkdown(audit);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-${audit.brandName.replace(/\s+/g, '-').toLowerCase()}-${audit.id}.md`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

// ---------- Small UI atoms ----------
function ScoreRing({ score, size = 140, label = 'leak score' }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, score ?? 0));
  const offset = c - (v / 100) * c;
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={C.surface3} strokeWidth="6" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={C.accent} strokeWidth="6" fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="marquee-num leading-none" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: size * 0.36, color: C.text, letterSpacing: '-0.04em' }}>
          {v}
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] mt-1" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
          /100
        </div>
      </div>
    </div>
  );
}

function SeverityDot({ severity }) {
  const styles = {
    critical: { bg: C.accent, fg: '#ffffff', dot: '#ffffff', border: C.accent },
    high:     { bg: C.accentSoft, fg: C.accentDeep, dot: C.accent, border: C.accent + '50' },
    medium:   { bg: C.surface3, fg: C.textMute, dot: C.textMute, border: C.border },
    low:      { bg: C.surface3, fg: C.textDim, dot: C.textDim, border: C.border },
  };
  const s = styles[severity] || styles.medium;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-[0.15em]"
      style={{ borderColor: s.border, color: s.fg, fontFamily: FONT_SANS, background: s.bg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }}></span>
      {severity}
    </span>
  );
}

function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, type = 'button', className = '' }) {
  const base = 'inline-flex items-center justify-center gap-2 transition-all rounded-md whitespace-nowrap';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' };
  let style = { fontFamily: FONT_SANS, fontWeight: 500 };
  if (variant === 'primary') style = { ...style, background: C.accent, color: '#ffffff' };
  if (variant === 'dark')    style = { ...style, background: C.black, color: '#ffffff' };
  if (variant === 'ghost')   style = { ...style, background: 'transparent', color: C.text, border: `1px solid ${C.border}` };
  if (variant === 'subtle')  style = { ...style, background: C.surface2, color: C.text, border: `1px solid ${C.border}` };
  if (variant === 'danger')  style = { ...style, background: 'transparent', color: C.accent, border: `1px solid ${C.accent}` };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${sizes[size]} ${className} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90 active:scale-[0.98]'}`}
      style={style}>
      {children}
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.textMute, fontFamily: FONT_SANS }}>{label}</span>
        {hint && <span className="text-[10px]" style={{ color: C.textDim, fontFamily: FONT_SANS }}>{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-colors"
      style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, fontFamily: FONT_SANS }}
      onFocus={e => e.target.style.borderColor = C.accent}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full px-3 py-2.5 text-sm rounded-lg outline-none resize-none transition-colors"
      style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, fontFamily: FONT_SANS }}
      onFocus={e => e.target.style.borderColor = C.accent}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  );
}

function Card({ children, className = '', style = {}, padded = true }) {
  return (
    <div className={`relative rounded-2xl ${padded ? 'p-7' : ''} ${className}`}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        boxShadow: '0 1px 2px rgba(15, 12, 8, 0.04), 0 8px 24px rgba(15, 12, 8, 0.05)',
        ...style
      }}>
      {children}
    </div>
  );
}

function SectionLabel({ icon: Icon, children, count }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="flex items-center justify-center w-7 h-7 rounded-md" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
        <Icon size={14} style={{ color: C.accent }} />
      </div>
      <h3 className="text-[11px] uppercase tracking-[0.22em]" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
        {children}
      </h3>
      {count !== undefined && (
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: C.textDim, fontFamily: FONT_MONO, background: C.surface2 }}>
          {count}
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: C.borderSoft }}></div>
    </div>
  );
}

// ---------- Lead Capture Modal ----------
function LeadCaptureModal({ open, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const valid = name.trim().length > 1
    && /^\S+@\S+\.\S+$/.test(email.trim())
    && country.trim().length > 1;

  async function handleSubmit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitLead({ name: name.trim(), email: email.trim(), country: country.trim() });
      onSubmit({ name: name.trim(), email: email.trim(), country: country.trim() });
    } catch (e) {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ background: 'rgba(15, 12, 8, 0.45)', backdropFilter: 'blur(6px)', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl"
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          boxShadow: '0 24px 60px rgba(15,12,8,0.18), 0 4px 12px rgba(15,12,8,0.06)',
          padding: 32,
        }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-md transition-colors"
          style={{ color: C.textMute }}
          onMouseEnter={e => e.currentTarget.style.color = C.text}
          onMouseLeave={e => e.currentTarget.style.color = C.textMute}>
          <X size={16} />
        </button>

        <div className="text-[10px] uppercase tracking-[0.22em] mb-3" style={{ color: C.accent, fontFamily: FONT_SANS, fontWeight: 600 }}>
          One quick step
        </div>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 26, color: C.text, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
          Where should we send your <span style={{ color: C.accent }}>audit?</span>
        </h2>
        <p className="mt-2 text-sm" style={{ color: C.textMute, fontFamily: FONT_SANS, lineHeight: 1.55 }}>
          We'll generate your full report in the next 60–90 seconds and email you a copy you can share with your team.
        </p>

        <div className="space-y-3 mt-6">
          <Field label="Full name">
            <Input value={name} onChange={setName} placeholder="Aanya Sharma" />
          </Field>
          <Field label="Work email">
            <Input value={email} onChange={setEmail} placeholder="aanya@brand.com" type="email" />
          </Field>
          <Field label="Country">
            <Input value={country} onChange={setCountry} placeholder="India" />
          </Field>
        </div>

        {error && (
          <div className="mt-3 text-xs" style={{ color: C.accent, fontFamily: FONT_SANS }}>{error}</div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <Btn variant="primary" size="lg" type="button" className="flex-1" onClick={handleSubmit} disabled={!valid || submitting}>
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : <>Run my audit <ArrowRight size={14} /></>}
          </Btn>
        </div>

        <div className="mt-4 text-[11px] text-center" style={{ color: C.textDim, fontFamily: FONT_SANS }}>
          We'll never spam you. Single follow-up from the Yuvaan team only if you opt in.
        </div>
      </div>
    </div>
  );
}

// ---------- Sidebar ----------
function Sidebar({ view, setView, brands }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'brands', label: 'Brands', icon: Building2, count: brands.length },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];
  return (
    <div className="w-60 shrink-0 flex flex-col no-print" style={{ background: C.surface, borderRight: `1px solid ${C.border}` }}>
      <div className="px-5 pt-7 pb-8">
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 19, color: C.text, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
          Revenue <span style={{ color: C.accent }}>CRO</span> Engine
        </div>
        <div className="text-[10px] uppercase tracking-[0.22em] mt-2" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
          by Yuvaan Technologies
        </div>
      </div>
      <nav className="px-3 flex-1">
        {items.map(it => {
          const active = view.name === it.id;
          return (
            <button key={it.id} onClick={() => setView({ name: it.id })}
              className="relative w-full flex items-center gap-3 px-3 py-2 rounded-md mb-1 text-left transition-colors"
              style={{
                background: active ? C.accentSoft : 'transparent',
                color: active ? C.accentDeep : C.textMute,
                fontFamily: FONT_SANS,
                fontWeight: active ? 600 : 400,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = C.text; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = C.textMute; }}
            >
              {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r" style={{ background: C.accent }}></span>}
              <it.icon size={15} style={{ color: active ? C.accent : 'currentColor' }} />
              <span className="text-sm flex-1">{it.label}</span>
              {it.count !== undefined && (
                <span className="text-[10px] px-1.5 rounded" style={{ color: active ? C.accent : C.textDim, fontFamily: FONT_MONO, background: active ? '#ffffff' : C.surface2 }}>
                  {it.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t" style={{ borderColor: C.border }}>
        <Btn variant="primary" size="md" className="w-full" onClick={() => setView({ name: 'newAudit' })}>
          <Plus size={14} /> New audit
        </Btn>
      </div>
    </div>
  );
}

// ---------- Dashboard ----------
function Dashboard({ brands, audits, setView }) {
  const recent = useMemo(() => {
    return [...audits].filter(a => a.status === 'complete').sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).slice(0, 5);
  }, [audits]);

  const totalLeaks = audits.reduce((sum, a) => {
    const f = a.result?.funnel || {};
    return sum + ['homepage', 'collection', 'pdp'].reduce((s, k) => s + (f[k]?.leaks?.length || 0), 0)
      + (a.result?.trust?.leaks?.length || 0)
      + (a.result?.offerPricing?.leaks?.length || 0)
      + (a.result?.messaging?.leaks?.length || 0)
      + (a.result?.presentation?.leaks?.length || 0);
  }, 0);

  const avgScore = audits.length
    ? Math.round(audits.reduce((s, a) => s + getPotentialScore(a.result?.executiveSummary), 0) / audits.filter(a => a.result).length || 0)
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-10 py-10">
      <div className="mb-12">
        <div className="text-[11px] uppercase tracking-[0.25em] mb-3" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <h1 className="leading-[0.95]" style={{ fontFamily: FONT_DISPLAY, letterSpacing: '-0.025em', fontWeight: 600, fontSize: 64, color: C.text }}>
          Where the <span style={{ color: C.accent }}>money</span> is leaking.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
          Drop in a homepage, collection, and product page. Get a senior CRO consultant's diagnosis — funnel-by-funnel, with copy-ready fixes — in under three minutes.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-10">
        <Card>
          <div className="text-[11px] uppercase tracking-[0.2em] mb-3" style={{ color: C.textMute, fontFamily: FONT_SANS }}>Brands tracked</div>
          <div className="marquee-num text-5xl leading-none" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color: C.text }}>{brands.length}</div>
        </Card>
        <Card>
          <div className="text-[11px] uppercase tracking-[0.2em] mb-3" style={{ color: C.textMute, fontFamily: FONT_SANS }}>Audits completed</div>
          <div className="marquee-num text-5xl leading-none" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color: C.text }}>{audits.filter(a => a.status === 'complete').length}</div>
        </Card>
        <Card>
          <div className="text-[11px] uppercase tracking-[0.2em] mb-3" style={{ color: C.textMute, fontFamily: FONT_SANS }}>Leaks identified</div>
          <div className="marquee-num text-5xl leading-none" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color: C.accent }}>{totalLeaks}</div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <SectionLabel icon={FileText} count={recent.length}>Recent audits</SectionLabel>
          {recent.length === 0 ? (
            <Card padded={false} className="py-16 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: C.surface2 }}>
                <Sparkles size={20} style={{ color: C.accent }} />
              </div>
              <div className="text-base mb-1.5" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color: C.text, fontSize: 22 }}>
                Run your first audit
              </div>
              <div className="text-sm max-w-xs mb-5" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
                Three pages, three minutes, one expert diagnosis.
              </div>
              <Btn variant="primary" onClick={() => setView({ name: 'newAudit' })}>
                Start audit <ArrowRight size={14} />
              </Btn>
            </Card>
          ) : (
            <div className="space-y-2">
              {recent.map(a => (
                <button key={a.id} onClick={() => setView({ name: 'report', auditId: a.id })}
                  className="w-full text-left rounded-lg p-4 flex items-center gap-4 transition-all"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.textDim}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                  <ScoreRing score={getPotentialScore(a.result?.executiveSummary)} size={56} />
                  <div className="flex-1 min-w-0">
                    <div className="text-base mb-0.5" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color: C.text }}>{a.brandName}</div>
                    <div className="text-xs" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
                      {fmtDateTime(a.completedAt)} · {a.context.country || '—'} · {a.context.priceRange || '—'}
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: C.textDim }} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionLabel icon={Building2} count={brands.length}>Brands</SectionLabel>
          {brands.length === 0 ? (
            <Card>
              <div className="text-sm mb-3" style={{ color: C.textMute, fontFamily: FONT_SANS }}>No brands yet.</div>
              <Btn variant="ghost" size="sm" onClick={() => setView({ name: 'newAudit' })}>
                <Plus size={12} /> Add brand
              </Btn>
            </Card>
          ) : (
            <Card padded={false}>
              {brands.slice(0, 6).map((b, i) => (
                <button key={b.id} onClick={() => setView({ name: 'brand', brandId: b.id })}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors"
                  style={{ borderBottom: i < brands.length - 1 ? `1px solid ${C.borderSoft}` : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-[11px]"
                    style={{ background: C.surface2, color: C.accent, fontFamily: FONT_DISPLAY, fontWeight: 600 }}>
                    {b.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ color: C.text, fontFamily: FONT_SANS }}>{b.name}</div>
                    <div className="text-[11px]" style={{ color: C.textDim, fontFamily: FONT_MONO }}>
                      {b.audits?.length || 0} audits
                    </div>
                  </div>
                </button>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Brands list / detail ----------
function BrandsView({ brands, audits, setView, refresh }) {
  const [confirm, setConfirm] = useState(null);

  async function deleteBrand(id) {
    const brandAudits = audits.filter(a => a.brandId === id);
    for (const a of brandAudits) {
      await store.delete(`audit:${a.id}`);
    }
    const remaining = brands.filter(b => b.id !== id);
    await store.set('brands', remaining);
    setConfirm(null);
    refresh();
  }

  return (
    <div className="max-w-5xl mx-auto px-10 py-10">
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="leading-tight mb-1" style={{ fontFamily: FONT_DISPLAY, letterSpacing: '-0.025em', fontWeight: 600, fontSize: 48, color: C.text }}>
            <span>Brands</span>
          </h1>
          <p className="text-sm" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
            {brands.length} {brands.length === 1 ? 'brand' : 'brands'} under audit
          </p>
        </div>
        <Btn variant="primary" onClick={() => setView({ name: 'newAudit' })}>
          <Plus size={14} /> New audit
        </Btn>
      </div>

      {brands.length === 0 ? (
        <Card padded={false} className="py-20 flex flex-col items-center text-center">
          <Building2 size={32} style={{ color: C.textDim }} />
          <div className="mt-4 mb-1.5" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 24, color: C.text }}>No brands yet</div>
          <div className="text-sm max-w-xs mb-5" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
            Add your first brand by running an audit.
          </div>
          <Btn variant="primary" onClick={() => setView({ name: 'newAudit' })}>Start first audit</Btn>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {brands.map(b => {
            const ba = audits.filter(a => a.brandId === b.id && a.status === 'complete');
            const latest = ba.sort((x, y) => (y.completedAt || 0) - (x.completedAt || 0))[0];
            return (
              <Card key={b.id} className="group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md flex items-center justify-center text-base"
                      style={{ background: C.surface2, color: C.accent, fontFamily: FONT_DISPLAY, fontWeight: 600 }}>
                      {b.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-base" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color: C.text }}>{b.name}</div>
                      <div className="text-[11px]" style={{ color: C.textDim, fontFamily: FONT_MONO }}>
                        {b.industry || 'D2C'}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setConfirm(b.id)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: C.textDim }}>
                    <Trash2 size={14} />
                  </button>
                </div>

                {latest ? (
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.textMute, fontFamily: FONT_SANS }}>Conversion potential</span>
                      <span className="marquee-num text-2xl" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color: C.accent }}>
                        {getPotentialScore(latest.result?.executiveSummary)}/100
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
                      {fmtDate(latest.completedAt)} · {ba.length} audit{ba.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs mb-4" style={{ color: C.textDim, fontFamily: FONT_SANS }}>No completed audits yet.</div>
                )}

                <div className="flex gap-2">
                  <Btn variant="ghost" size="sm" onClick={() => setView({ name: 'brand', brandId: b.id })}>
                    View history <ArrowRight size={12} />
                  </Btn>
                  <Btn variant="subtle" size="sm" onClick={() => setView({ name: 'newAudit', brandId: b.id })}>
                    <Plus size={12} /> New audit
                  </Btn>
                </div>

                {confirm === b.id && (
                  <div className="absolute inset-0 rounded-xl flex flex-col items-center justify-center text-center p-6"
                    style={{ background: 'rgba(255,255,255,0.97)', border: `1px solid ${C.accent}40` }}>
                    <div className="text-sm mb-3" style={{ color: C.text, fontFamily: FONT_SANS }}>
                      Delete <span style={{ color: C.accent }}>{b.name}</span> and all {ba.length} audits?
                    </div>
                    <div className="flex gap-2">
                      <Btn variant="ghost" size="sm" onClick={() => setConfirm(null)}>Cancel</Btn>
                      <Btn variant="danger" size="sm" onClick={() => deleteBrand(b.id)}>Delete</Btn>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BrandDetail({ brandId, brands, audits, setView, refresh }) {
  const brand = brands.find(b => b.id === brandId);
  const brandAudits = audits.filter(a => a.brandId === brandId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!brand) return <div className="p-10" style={{ color: C.textMute }}>Brand not found.</div>;

  return (
    <div className="max-w-5xl mx-auto px-10 py-10">
      <button onClick={() => setView({ name: 'brands' })} className="flex items-center gap-1.5 text-xs mb-6"
        style={{ color: C.textMute, fontFamily: FONT_SANS }}>
        <ArrowLeft size={12} /> All brands
      </button>

      <div className="flex items-center gap-5 mb-10">
        <div className="w-16 h-16 rounded-lg flex items-center justify-center text-3xl"
          style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.accent, fontFamily: FONT_DISPLAY, fontWeight: 600 }}>
          {brand.name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="leading-tight" style={{ fontFamily: FONT_DISPLAY, letterSpacing: '-0.025em', fontWeight: 600, fontSize: 44, color: C.text }}>{brand.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
            {brand.url && (
              <a href={brand.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                <Globe size={11} /> {brand.url.replace(/^https?:\/\//, '').slice(0, 30)}
              </a>
            )}
            {brand.industry && <span>· {brand.industry}</span>}
            <span>· {brandAudits.length} audit{brandAudits.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="flex-1"></div>
        <Btn variant="primary" onClick={() => setView({ name: 'newAudit', brandId: brand.id })}>
          <Plus size={14} /> New audit
        </Btn>
      </div>

      <SectionLabel icon={FileText} count={brandAudits.length}>Audit history</SectionLabel>

      {brandAudits.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-sm" style={{ color: C.textMute, fontFamily: FONT_SANS }}>No audits yet for this brand.</div>
        </Card>
      ) : (
        <div className="space-y-2">
          {brandAudits.map(a => (
            <button key={a.id} onClick={() => a.status === 'complete' && setView({ name: 'report', auditId: a.id })}
              disabled={a.status !== 'complete'}
              className="w-full text-left rounded-lg p-4 flex items-center gap-4 transition-all"
              style={{ background: C.surface, border: `1px solid ${C.border}`, opacity: a.status === 'complete' ? 1 : 0.5 }}>
              <ScoreRing score={getPotentialScore(a.result?.executiveSummary)} size={48} />
              <div className="flex-1 min-w-0">
                <div className="text-sm mb-0.5" style={{ fontFamily: FONT_SANS, color: C.text }}>
                  {a.context.country || 'Audit'} · {a.context.trafficSource || 'mixed traffic'}
                </div>
                <div className="text-[11px]" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
                  {fmtDateTime(a.createdAt)} · {a.status}
                </div>
              </div>
              {a.status === 'complete' && <ChevronRight size={16} style={{ color: C.textDim }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- New Audit Wizard ----------
function NewAuditWizard({ initialBrandId, brands, setView, refresh }) {
  const [step, setStep] = useState(1);
  const initialBrand = brands.find(b => b.id === initialBrandId);

  const [brandName, setBrandName] = useState(initialBrand?.name || '');
  const [brandUrl, setBrandUrl] = useState(initialBrand?.url || '');
  const [industry, setIndustry] = useState(initialBrand?.industry || '');

  const [audience, setAudience] = useState('');
  const [country, setCountry] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [trafficSource, setTrafficSource] = useState('');
  const [description, setDescription] = useState('');

  const [pages, setPages] = useState({
    homepage: { url: '', screenshot: null, fileName: '' },
    collection: { url: '', screenshot: null, fileName: '' },
    pdp: { url: '', screenshot: null, fileName: '' },
    extra: { url: '', screenshot: null, fileName: '', label: 'Cart / checkout' }
  });

  const [running, setRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState(null);
  const [showLead, setShowLead] = useState(false);
  const [pendingAuditData, setPendingAuditData] = useState(null);

  async function handleFileChange(key, file) {
    if (!file) return;
    try {
      const b64 = await fileToResizedBase64(file);
      setPages(p => ({ ...p, [key]: { ...p[key], screenshot: b64, fileName: file.name } }));
    } catch (e) {
      setError(`Could not process ${file.name}: ${e.message}`);
    }
  }

  function canProceed() {
    if (step === 1) return brandName.trim().length > 0;
    if (step === 2) return audience && country && priceRange && trafficSource;
    if (step === 3) return pages.homepage.screenshot && pages.collection.screenshot && pages.pdp.screenshot;
    return true;
  }

  // Snapshot the wizard form state into a stable object, then open the lead modal.
  // Snapshotting here means the audit can't be confused by any later state churn
  // and runAudit doesn't depend on closure values from a different render.
  function handleOpenLeadModal() {
    const data = {
      brandName: brandName.trim(),
      brandUrl: brandUrl.trim(),
      industry: industry.trim(),
      audience,
      country,
      priceRange,
      trafficSource,
      description,
      pages,
    };
    console.log('[handleOpenLeadModal] snapshot captured:', data);
    setPendingAuditData(data);
    setShowLead(true);
  }

  async function runAudit(data) {
    console.log('[runAudit] triggered with data:', data);
    if (!data) {
      console.error('[runAudit] aborted — no audit data was passed in');
      setError('Could not start the audit — form data was missing. Please try again.');
      return;
    }

    setRunning(true);
    setError(null);
    setStatusMsg('Preparing analysis…');

    try {
      // Find or create brand
      let brand = brands.find(b => b.name.toLowerCase() === data.brandName.toLowerCase());
      if (!brand) {
        brand = { id: uid(), name: data.brandName, url: data.brandUrl, industry: data.industry, createdAt: Date.now(), audits: [] };
      } else {
        if (data.brandUrl) brand.url = data.brandUrl;
        if (data.industry) brand.industry = data.industry;
      }

      const audit = {
        id: uid(),
        brandId: brand.id,
        brandName: brand.name,
        status: 'running',
        createdAt: Date.now(),
        context: {
          audience: data.audience,
          country: data.country,
          priceRange: data.priceRange,
          trafficSource: data.trafficSource,
          description: data.description,
          industry: data.industry,
        },
        pages: data.pages,
      };

      const { result, failedSections } = await runFullAnalysis(audit, setStatusMsg);
      audit.result = result;
      audit.failedSections = failedSections;
      audit.status = 'complete';
      audit.completedAt = Date.now();

      // Persist audit (without big screenshots to save storage space)
      const { pages: _p, ...auditMeta } = audit;
      const lightPages = Object.fromEntries(
        Object.entries(audit.pages).map(([k, v]) => [k, { url: v.url, fileName: v.fileName, label: v.label }])
      );
      await store.set(`audit:${audit.id}`, { ...auditMeta, pages: lightPages });

      // Update brand
      brand.audits = [...(brand.audits || []), audit.id];
      const allBrands = brands.find(b => b.id === brand.id) ? brands.map(b => b.id === brand.id ? brand : b) : [...brands, brand];
      await store.set('brands', allBrands);

      await refresh();
      console.log('[runAudit] complete, navigating to report');
      setView({ name: 'report', auditId: audit.id });
    } catch (e) {
      console.error('[runAudit] failed:', e);
      setError(`Analysis failed: ${e.message}. Check your screenshots and context, then try again.`);
      setRunning(false);
    }
  }

  if (running) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(8px)', zIndex: 50 }}>
        <div className="text-center max-w-md px-6">
          <div className="relative inline-flex mb-8">
            <div className="w-16 h-16 rounded-full" style={{ background: `${C.accent}20`, animation: 'pulse 2s ease-in-out infinite' }}></div>
            <Loader2 size={32} className="absolute inset-0 m-auto animate-spin" style={{ color: C.accent }} />
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 36, color: C.text, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            <span style={{ color: C.accent }}>Reading</span> the funnel.
          </div>
          <div className="mt-4 text-sm h-5 transition-opacity" style={{ color: C.accent, fontFamily: FONT_MONO }}>
            {statusMsg}
          </div>
          <div className="mt-8 text-xs" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
            This usually takes 30–90 seconds. We're running five deep passes in parallel.
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    { n: 1, label: 'Brand' },
    { n: 2, label: 'Context' },
    { n: 3, label: 'Pages' },
    { n: 4, label: 'Review' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-10 py-10">
      <button onClick={() => setView({ name: 'dashboard' })} className="flex items-center gap-1.5 text-xs mb-6"
        style={{ color: C.textMute, fontFamily: FONT_SANS }}>
        <ArrowLeft size={12} /> Cancel
      </button>

      <div className="mb-10">
        <h1 className="leading-tight" style={{ fontFamily: FONT_DISPLAY, letterSpacing: '-0.025em', fontWeight: 600, fontSize: 44, color: C.text }}>
          New <span style={{ color: C.accent }}>audit</span>
        </h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-3 mb-10">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]"
                style={{
                  background: step >= s.n ? C.accent : C.surface2,
                  color: step >= s.n ? '#1a1a0a' : C.textMute,
                  fontFamily: FONT_MONO
                }}>
                {step > s.n ? '✓' : s.n}
              </div>
              <span className="text-xs" style={{ color: step >= s.n ? C.text : C.textMute, fontFamily: FONT_SANS }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className="flex-1 h-px" style={{ background: step > s.n ? C.accent : C.borderSoft }}></div>}
          </div>
        ))}
      </div>

      {error && (
        <Card className="mb-6" style={{ borderColor: `${C.accent}40` }}>
          <div className="flex items-start gap-3">
            <AlertOctagon size={16} style={{ color: C.accent, marginTop: 2 }} />
            <div className="text-sm" style={{ color: C.text, fontFamily: FONT_SANS }}>{error}</div>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <h2 className="mb-1" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 24, color: C.text }}>Which brand are we auditing?</h2>
          <p className="text-sm mb-6" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
            If this brand already exists, we'll add a new audit to its history.
          </p>
          <div className="space-y-4">
            <Field label="Brand name" hint="required">
              <Input value={brandName} onChange={setBrandName} placeholder="e.g. Glow Co." />
            </Field>
            <Field label="Website URL">
              <Input value={brandUrl} onChange={setBrandUrl} placeholder="https://" />
            </Field>
            <Field label="Industry / category">
              <Input value={industry} onChange={setIndustry} placeholder="e.g. Skincare, Apparel, Home" />
            </Field>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <h2 className="mb-1" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 24, color: C.text }}>The context that makes this useful</h2>
          <p className="text-sm mb-6" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
            Without this, any analysis stays surface-level. Be specific.
          </p>
          <div className="space-y-4">
            <Field label="Target audience" hint="who is this for, really">
              <Input value={audience} onChange={setAudience} placeholder="e.g. Women 28–40 in Tier 1 cities, post-pregnancy skincare seekers" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Primary country / market">
                <Input value={country} onChange={setCountry} placeholder="e.g. India, US, UK" />
              </Field>
              <Field label="Price range">
                <Input value={priceRange} onChange={setPriceRange} placeholder="e.g. ₹1,200–₹3,500 / $30–$80" />
              </Field>
            </div>
            <Field label="Primary traffic source" hint="where does most traffic come from">
              <Input value={trafficSource} onChange={setTrafficSource} placeholder="e.g. Meta ads — interest-based, IG creators, Google Search brand" />
            </Field>
            <Field label="Brand description / positioning" hint="optional but helps a lot">
              <Textarea value={description} onChange={setDescription} placeholder="Two lines on what the brand stands for, the hero product, and how you talk about yourself." rows={3} />
            </Field>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <h2 className="mb-1" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 24, color: C.text }}>Upload page screenshots</h2>
          <p className="text-sm mb-6" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
            Full-page or above-the-fold both work. Larger captures give deeper analysis.
          </p>
          <div className="space-y-4">
            {[
              { key: 'homepage', label: 'Homepage', required: true },
              { key: 'collection', label: 'Collection / category page', required: true },
              { key: 'pdp', label: 'Product detail page', required: true },
              { key: 'extra', label: 'Cart / checkout (optional)', required: false },
            ].map(({ key, label, required }) => (
              <div key={key} className="rounded-lg p-4" style={{ border: `1px solid ${C.border}`, background: C.surface2 }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm" style={{ color: C.text, fontFamily: FONT_SANS }}>
                    {label} {required && <span style={{ color: C.accent }}>*</span>}
                  </div>
                  {pages[key].screenshot && <CheckCircle2 size={14} style={{ color: C.accent }} />}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input value={pages[key].url} onChange={e => setPages(p => ({ ...p, [key]: { ...p[key], url: e.target.value } }))}
                    placeholder="Page URL"
                    className="px-3 py-2 text-sm rounded outline-none"
                    style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: FONT_SANS }} />
                  <label className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded cursor-pointer transition-colors"
                    style={{ background: C.bg, border: `1px solid ${C.border}`, color: pages[key].screenshot ? C.accent : C.textMute, fontFamily: FONT_SANS }}>
                    <Upload size={13} />
                    {pages[key].screenshot ? (pages[key].fileName.length > 18 ? pages[key].fileName.slice(0, 16) + '…' : pages[key].fileName) : 'Upload screenshot'}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => handleFileChange(key, e.target.files[0])} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <h2 className="mb-1" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 24, color: C.text }}>Ready when you are</h2>
          <p className="text-sm mb-6" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
            Five parallel passes. Roughly 30–90 seconds.
          </p>
          <div className="space-y-3 text-sm" style={{ fontFamily: FONT_SANS }}>
            <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
              <span style={{ color: C.textMute }}>Brand</span>
              <span style={{ color: C.text }}>{brandName}</span>
            </div>
            <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
              <span style={{ color: C.textMute }}>Audience</span>
              <span style={{ color: C.text }} className="text-right max-w-xs truncate">{audience}</span>
            </div>
            <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
              <span style={{ color: C.textMute }}>Market</span>
              <span style={{ color: C.text }}>{country}</span>
            </div>
            <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
              <span style={{ color: C.textMute }}>Price range</span>
              <span style={{ color: C.text }}>{priceRange}</span>
            </div>
            <div className="flex justify-between py-2" style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
              <span style={{ color: C.textMute }}>Traffic</span>
              <span style={{ color: C.text }} className="text-right max-w-xs truncate">{trafficSource}</span>
            </div>
            <div className="flex justify-between py-2">
              <span style={{ color: C.textMute }}>Pages</span>
              <span style={{ color: C.text }}>
                {Object.values(pages).filter(p => p.screenshot).length} uploaded
              </span>
            </div>
          </div>
        </Card>
      )}

      <div className="flex justify-between mt-6">
        {step > 1 ? (
          <Btn variant="ghost" onClick={() => setStep(step - 1)}>
            <ArrowLeft size={14} /> Back
          </Btn>
        ) : <div></div>}

        {step < 4 ? (
          <Btn variant="primary" onClick={() => setStep(step + 1)} disabled={!canProceed()}>
            Continue <ArrowRight size={14} />
          </Btn>
        ) : (
          <Btn variant="primary" type="button" onClick={handleOpenLeadModal}>
            <Zap size={14} /> Run audit
          </Btn>
        )}
      </div>

      <LeadCaptureModal
        open={showLead}
        onClose={() => setShowLead(false)}
        onSubmit={(lead) => {
          console.log('[modal.onSubmit] lead submitted:', lead);
          console.log('[modal.onSubmit] pendingAuditData at submission:', pendingAuditData);
          setShowLead(false);
          runAudit(pendingAuditData);
        }}
      />
    </div>
  );
}

// ---------- Audit Report View ----------
function ReportView({ auditId, audits, brands, setView, refresh }) {
  const audit = audits.find(a => a.id === auditId);
  const [activeFunnel, setActiveFunnel] = useState('homepage');
  const [copiedKey, setCopiedKey] = useState(null);

  if (!audit || !audit.result) {
    return <div className="p-10" style={{ color: C.textMute }}>Audit not found.</div>;
  }

  const r = audit.result;
  const e = r.executiveSummary || {};
  const f = r.funnel || {};

  function copyText(text, key) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }

  async function deleteAudit() {
    await store.delete(`audit:${audit.id}`);
    const brand = brands.find(b => b.id === audit.brandId);
    if (brand) {
      brand.audits = (brand.audits || []).filter(id => id !== audit.id);
      const updatedBrands = brands.map(b => b.id === brand.id ? brand : b);
      await store.set('brands', updatedBrands);
    }
    await refresh();
    setView({ name: 'dashboard' });
  }

  const scoreColor = C.accent;

  return (
    <div className="max-w-5xl mx-auto px-10 py-10 print-root">
      <div className="flex items-center justify-between mb-8 no-print">
        <button onClick={() => setView({ name: 'brand', brandId: audit.brandId })} className="flex items-center gap-1.5 text-xs"
          style={{ color: C.textMute, fontFamily: FONT_SANS }}>
          <ArrowLeft size={12} /> {audit.brandName}
        </button>
        <div className="flex gap-2">
          <Btn variant="ghost" size="sm" type="button" onClick={() => window.print()}>
            <Download size={12} /> Download Full Report (PDF)
          </Btn>
          <Btn variant="ghost" size="sm" type="button" onClick={deleteAudit}>
            <Trash2 size={12} />
          </Btn>
        </div>
      </div>

      {/* Hero / Executive summary */}
      <div className="mb-12">
        <div className="text-[11px] uppercase tracking-[0.25em] mb-3" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
          Revenue audit · {fmtDateTime(audit.completedAt)}
        </div>
        <h1 className="leading-[0.95] mb-6" style={{ fontFamily: FONT_DISPLAY, letterSpacing: '-0.025em', fontWeight: 600, fontSize: 56, color: C.text }}>
          {audit.brandName}<span style={{ color: C.accent }}>.</span>
        </h1>
        <div className="flex flex-wrap gap-2 mb-8">
          <Pill icon={MapPin}>{audit.context.country}</Pill>
          <Pill icon={DollarSign}>{audit.context.priceRange}</Pill>
          <Pill icon={Target}>{audit.context.audience?.slice(0, 50)}{audit.context.audience?.length > 50 ? '…' : ''}</Pill>
          <Pill icon={TrendingUp}>{audit.context.trafficSource?.slice(0, 40)}{audit.context.trafficSource?.length > 40 ? '…' : ''}</Pill>
        </div>

        <Card padded={false} className="overflow-hidden">
          <div className="grid grid-cols-3 gap-0">
            <div className="p-8 flex flex-col items-center text-center" style={{ borderRight: `1px solid ${C.borderSoft}` }}>
              <ScoreRing score={getPotentialScore(e)} size={140} />
              <div className="text-[11px] uppercase tracking-[0.25em] mt-4" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
                Conversion Potential Score
              </div>
              <div className="text-xs mt-1.5 max-w-[200px]" style={{ color: C.textDim, fontFamily: FONT_SANS }}>
                {e.scoreReasoning}
              </div>
            </div>
            <div className="col-span-2 p-8">
              <div className="text-[11px] uppercase tracking-[0.25em] mb-3" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
                Verdict
              </div>
              <div className="text-xl leading-relaxed mb-6" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color: C.text }}>
                "{e.verdict}"
              </div>
              <div className="rounded-lg p-4" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <TrendingUp size={13} style={{ color: C.accent }} />
                  <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
                    Estimated lift if top 3 fixes ship
                  </div>
                </div>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 28, color: C.accent }}>
                  {e.estimatedConversionLift}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {audit.failedSections?.length > 0 && (
        <div className="mb-10 rounded-lg p-4 flex items-start gap-3"
          style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}40` }}>
          <AlertTriangle size={16} style={{ color: C.accent, marginTop: 2, flexShrink: 0 }} />
          <div>
            <div className="text-sm" style={{ color: C.text, fontFamily: FONT_SANS }}>
              {audit.failedSections.length} of 5 analysis pass{audit.failedSections.length === 1 ? '' : 'es'} didn't return cleanly
              <span style={{ color: C.textMute }}> ({audit.failedSections.join(', ')})</span>.
            </div>
            <div className="text-xs mt-1" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
              Sections below show whatever did succeed. For a complete report, run a fresh audit — these failures are usually transient.
            </div>
          </div>
        </div>
      )}

      {/* Top 3 leaks */}
      <SectionLabel icon={AlertOctagon}>The three biggest opportunities</SectionLabel>
      <div className="grid grid-cols-3 gap-3 mb-12">
        {(e.topThreeLeaks || []).map((l, i) => (
          <Card key={i} className="relative overflow-hidden">
            <div className="text-5xl absolute top-3 right-4 leading-none" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color: `${C.accent}25` }}>
              {i + 1}
            </div>
            <SeverityDot severity={l.severity} />
            <div className="mt-3 mb-3" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 22, color: C.text, lineHeight: 1.2 }}>
              {l.title}
            </div>
            <div className="text-sm mb-4" style={{ color: C.textMute, fontFamily: FONT_SANS, lineHeight: 1.6 }}>
              {l.summary}
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: C.accent, fontFamily: FONT_MONO }}>
              {l.estImpact}
            </div>
          </Card>
        ))}
      </div>

      {/* Funnel breakdown — interactive on screen, all-stacked for print */}
      <div className="screen-only">
        <SectionLabel icon={Eye}>Funnel breakdown</SectionLabel>
        <Card padded={false} className="mb-12">
          <div className="flex border-b" style={{ borderColor: C.borderSoft }}>
            {[
              { k: 'homepage', label: 'Homepage' },
              { k: 'collection', label: 'Collection' },
              { k: 'pdp', label: 'Product page' },
            ].map(t => {
              const active = activeFunnel === t.k;
              const score = f[t.k]?.score || 0;
              const color = score >= 40 ? C.accent : C.textMute;
              return (
                <button key={t.k} onClick={() => setActiveFunnel(t.k)}
                  className="px-6 py-4 flex items-center gap-3 transition-colors flex-1"
                  style={{
                    background: active ? C.surface2 : 'transparent',
                    borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
                  }}>
                  <span className="text-sm" style={{ color: active ? C.text : C.textMute, fontFamily: FONT_SANS }}>{t.label}</span>
                  <span className="text-xs marquee-num" style={{ color, fontFamily: FONT_MONO }}>{score}</span>
                </button>
              );
            })}
          </div>
          <FunnelPanel data={f[activeFunnel]} />
        </Card>
      </div>

      <div className="print-only mb-12">
        <SectionLabel icon={Eye}>Funnel breakdown</SectionLabel>
        <div className="space-y-6">
          {[
            { k: 'homepage', label: 'Homepage' },
            { k: 'collection', label: 'Collection page' },
            { k: 'pdp', label: 'Product page' },
          ].map(t => f[t.k] ? (
            <Card key={t.k} padded={false} className="overflow-hidden print-keep">
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: C.text }}>{t.label}</span>
                <span className="marquee-num" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color: C.accent, fontSize: 22 }}>
                  {f[t.k]?.score ?? '—'}/100
                </span>
              </div>
              <FunnelPanel data={f[t.k]} />
            </Card>
          ) : null)}
        </div>
      </div>

      {/* Other audits */}
      <div className="grid grid-cols-2 gap-4 mb-12">
        <ScoredSection title="Trust & Credibility" icon={ShieldCheck} data={r.trust} highlight="wouldANewUserBuy" />
        <ScoredSection title="Offer & Pricing" icon={DollarSign} data={r.offerPricing} highlight="perceivedValue" />
        <ScoredSection title="Messaging & Audience Fit" icon={MessageSquare} data={r.messaging} highlight="audienceAlignment" />
        <ScoredSection title="Product Presentation" icon={ImageIcon} data={r.presentation} highlight="imageQuality" />
      </div>

      {/* Rewrites */}
      {r.rewrites && (
        <>
          <SectionLabel icon={Wand2}>Copy-ready rewrites</SectionLabel>
          <div className="space-y-4 mb-12">
            {[
              { key: 'headlines', label: 'Headlines & hooks' },
              { key: 'ctas', label: 'CTAs' },
              { key: 'valueProps', label: 'Value props' },
            ].map(({ key, label }) => {
              const arr = r.rewrites[key];
              if (!arr?.length) return null;
              return (
                <Card key={key}>
                  <div className="text-[11px] uppercase tracking-[0.2em] mb-4" style={{ color: C.textMute, fontFamily: FONT_SANS }}>{label}</div>
                  <div className="space-y-5">
                    {arr.map((rw, i) => (
                      <div key={i} className="grid grid-cols-12 gap-4">
                        <div className="col-span-3">
                          <div className="text-[11px] uppercase tracking-[0.15em] mb-1" style={{ color: C.textDim, fontFamily: FONT_SANS }}>Where</div>
                          <div className="text-sm" style={{ color: C.text, fontFamily: FONT_SANS }}>{rw.context}</div>
                        </div>
                        <div className="col-span-4">
                          <div className="text-[11px] uppercase tracking-[0.15em] mb-1" style={{ color: C.textDim, fontFamily: FONT_SANS }}>Current</div>
                          <div className="text-sm line-through opacity-60" style={{ color: C.textMute, fontFamily: FONT_SANS }}>{rw.current}</div>
                        </div>
                        <div className="col-span-5">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-[11px] uppercase tracking-[0.15em]" style={{ color: C.accent, fontFamily: FONT_SANS }}>Rewritten</div>
                            <button onClick={() => copyText(rw.rewritten, `${key}-${i}`)} className="text-[11px] flex items-center gap-1" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
                              {copiedKey === `${key}-${i}` ? <><Check size={10} /> copied</> : <><Copy size={10} /> copy</>}
                            </button>
                          </div>
                          <div className="text-sm" style={{ color: C.text, fontFamily: FONT_DISPLAY, fontWeight: 600, lineHeight: 1.4 }}>"{rw.rewritten}"</div>
                          <div className="text-[11px] mt-1.5" style={{ color: C.textDim, fontFamily: FONT_SANS }}>{rw.reasoning}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}

            {r.rewrites.offerIdeas?.length > 0 && (
              <Card>
                <div className="text-[11px] uppercase tracking-[0.2em] mb-4" style={{ color: C.textMute, fontFamily: FONT_SANS }}>Offer ideas</div>
                <div className="grid grid-cols-3 gap-3">
                  {r.rewrites.offerIdeas.map((o, i) => (
                    <div key={i} className="rounded-lg p-4" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
                      <div className="mb-2" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: C.text }}>{o.title}</div>
                      <div className="text-xs mb-3" style={{ color: C.textMute, fontFamily: FONT_SANS, lineHeight: 1.6 }}>{o.description}</div>
                      <div className="text-[11px] uppercase tracking-[0.15em]" style={{ color: C.accent, fontFamily: FONT_MONO }}>{o.expectedImpact}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Roadmap */}
      {r.roadmap?.length > 0 && (
        <>
          <SectionLabel icon={ListChecks}>30-day priority roadmap</SectionLabel>
          <Card padded={false} className="mb-12 overflow-hidden">
            {r.roadmap.map((item, i) => {
              const effortColor = item.effort === 'low' ? C.textMute : C.accent;
              return (
                <div key={i} className="flex items-start gap-5 px-6 py-5"
                  style={{ borderBottom: i < r.roadmap.length - 1 ? `1px solid ${C.borderSoft}` : 'none' }}>
                  <div className="text-3xl leading-none w-10 shrink-0" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color: C.accent }}>
                    {item.priority}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base mb-1" style={{ fontFamily: FONT_SANS, color: C.text, fontWeight: 500 }}>
                      {item.action}
                    </div>
                    <div className="text-sm" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
                      {item.rationale}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="text-[11px] uppercase tracking-[0.15em]" style={{ color: C.accent, fontFamily: FONT_MONO }}>
                      {item.expectedLift}
                    </div>
                    <div className="flex gap-1.5">
                      <span className="text-[10px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded"
                        style={{ background: C.surface2, color: C.textMute, fontFamily: FONT_SANS }}>{item.category}</span>
                      <span className="text-[10px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded"
                        style={{ background: `${effortColor}15`, color: effortColor, fontFamily: FONT_SANS }}>{item.effort}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}

      <Card className="mb-8 overflow-hidden" style={{ background: C.accentSoft, borderColor: `${C.accent}40` }}>
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-[0.22em] mb-2" style={{ color: C.accentDeep, fontFamily: FONT_SANS, fontWeight: 600 }}>
              Implementation
            </div>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 28, color: C.text, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
              Want us to <span style={{ color: C.accent }}>implement these fixes</span> for you?
            </h3>
            <p className="mt-2 text-sm max-w-xl" style={{ color: C.textMute, fontFamily: FONT_SANS, lineHeight: 1.6 }}>
              The Yuvaan Technologies team can take this roadmap from PDF to live store — copy, design, dev, and A/B testing handled end-to-end. Average lift across our last 40 implementations: <strong style={{ color: C.text }}>+47% conversion</strong> in the first 90 days.
            </p>
          </div>
          <div className="shrink-0">
            <Btn variant="primary" size="lg" onClick={() => window.open(STRATEGY_CALL_URL, '_blank')}>
              Book Strategy Call <ArrowRight size={14} />
            </Btn>
          </div>
        </div>
      </Card>

      <div className="text-center py-8" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
        <div className="text-xs mb-3" style={{ color: C.textDim, fontFamily: FONT_SANS }}>
          Audit ID · {audit.id} · Revenue CRO Engine by Yuvaan Technologies
        </div>
        <div className="no-print">
          <Btn variant="primary" size="md" type="button" onClick={() => window.print()}>
            <Download size={14} /> Download Full Report (PDF)
          </Btn>
        </div>
      </div>
    </div>
  );
}

function Pill({ icon: Icon, children }) {
  if (!children) return null;
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
      style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.textMute, fontFamily: FONT_SANS }}>
      <Icon size={11} />
      {children}
    </div>
  );
}

function FunnelPanel({ data }) {
  if (!data) return <div className="p-6 text-sm" style={{ color: C.textMute }}>No data.</div>;
  return (
    <div className="p-6">
      <div className="grid grid-cols-3 gap-6 mb-6 pb-6" style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
        <div className="col-span-2">
          <div className="text-[11px] uppercase tracking-[0.18em] mb-1.5" style={{ color: C.textMute, fontFamily: FONT_SANS }}>First 5 seconds</div>
          <div className="text-base leading-relaxed" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color: C.text }}>
            "{data.firstFiveSeconds}"
          </div>
        </div>
        <div>
          {data.strengths?.length > 0 && (
            <>
              <div className="text-[11px] uppercase tracking-[0.18em] mb-2" style={{ color: C.textMute, fontFamily: FONT_SANS }}>Working</div>
              <div className="space-y-1.5">
                {data.strengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs" style={{ color: C.text, fontFamily: FONT_SANS }}>
                    <CheckCircle2 size={11} style={{ color: C.accent, marginTop: 3, flexShrink: 0 }} />
                    {s}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="text-[11px] uppercase tracking-[0.18em] mb-4" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
        Leaks ({data.leaks?.length || 0})
      </div>
      <div className="space-y-3">
        {(data.leaks || []).map((l, i) => (
          <LeakRow key={i} leak={l} />
        ))}
      </div>
    </div>
  );
}

function LeakRow({ leak }) {
  return (
    <div className="rounded-lg p-4" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between mb-2">
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: C.text, lineHeight: 1.2 }}>{leak.title}</div>
        <SeverityDot severity={leak.severity} />
      </div>
      <div className="grid grid-cols-3 gap-4 mt-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: C.textDim, fontFamily: FONT_SANS }}>Where</div>
          <div className="text-xs" style={{ color: C.textMute, fontFamily: FONT_SANS }}>{leak.where}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: C.textDim, fontFamily: FONT_SANS }}>Why it leaks</div>
          <div className="text-xs" style={{ color: C.textMute, fontFamily: FONT_SANS, lineHeight: 1.5 }}>{leak.why}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: C.accent, fontFamily: FONT_SANS }}>Fix</div>
          <div className="text-xs" style={{ color: C.text, fontFamily: FONT_SANS, lineHeight: 1.5 }}>{leak.fix}</div>
        </div>
      </div>
    </div>
  );
}

function ScoredSection({ title, icon: Icon, data, highlight }) {
  if (!data) return null;
  const color = data.score >= 40 ? C.accent : C.textMute;
  const fields = Object.entries(data).filter(([k]) => !['score', 'leaks'].includes(k));
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon size={15} style={{ color: C.accent }} />
          <h3 className="text-base" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color: C.text }}>{title}</h3>
        </div>
        <div className="marquee-num text-2xl" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color }}>
          {data.score}
        </div>
      </div>
      {data[highlight] && (
        <div className="text-sm mb-4" style={{ color: C.textMute, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16, lineHeight: 1.5 }}>
          "{data[highlight]}"
        </div>
      )}
      <div className="space-y-2 mb-4">
        {fields.filter(([k]) => k !== highlight).map(([k, v]) => {
          if (Array.isArray(v) && v.length === 0) return null;
          return (
            <div key={k}>
              <div className="text-[10px] uppercase tracking-[0.15em] mb-1" style={{ color: C.textDim, fontFamily: FONT_SANS }}>
                {k.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </div>
              {Array.isArray(v) ? (
                <div className="flex flex-wrap gap-1.5">
                  {v.map((item, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded"
                      style={{ background: C.surface2, color: C.textMute, fontFamily: FONT_SANS, border: `1px solid ${C.borderSoft}` }}>
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs" style={{ color: C.textMute, fontFamily: FONT_SANS, lineHeight: 1.5 }}>{v}</div>
              )}
            </div>
          );
        })}
      </div>
      {data.leaks?.length > 0 && (
        <details className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
          <summary className="text-[11px] uppercase tracking-[0.18em] cursor-pointer flex items-center gap-1.5" style={{ color: C.accent, fontFamily: FONT_SANS }}>
            <AlertTriangle size={11} /> {data.leaks.length} leak{data.leaks.length !== 1 ? 's' : ''} — view fixes
          </summary>
          <div className="mt-3 space-y-2">
            {data.leaks.map((l, i) => (
              <div key={i} className="text-xs rounded p-2.5" style={{ background: C.surface2, fontFamily: FONT_SANS }}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ color: C.text, fontWeight: 500 }}>{l.title}</span>
                  <SeverityDot severity={l.severity} />
                </div>
                <div style={{ color: C.textMute, lineHeight: 1.5 }} className="mb-1">{l.why}</div>
                <div style={{ color: C.accent, lineHeight: 1.5 }}><strong>Fix:</strong> {l.fix}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </Card>
  );
}

// ---------- Team ----------
function TeamView({ team, refresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Auditor');

  async function addMember() {
    if (!name.trim()) return;
    const member = { id: uid(), name: name.trim(), email: email.trim(), role, joinedAt: Date.now() };
    const updated = [...team, member];
    await store.set('team', updated);
    setName(''); setEmail(''); setShowAdd(false);
    refresh();
  }

  async function removeMember(id) {
    const updated = team.filter(m => m.id !== id);
    await store.set('team', updated);
    refresh();
  }

  return (
    <div className="max-w-4xl mx-auto px-10 py-10">
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="leading-tight mb-1" style={{ fontFamily: FONT_DISPLAY, letterSpacing: '-0.025em', fontWeight: 600, fontSize: 48, color: C.text }}>
            <span>Team</span>
          </h1>
          <p className="text-sm" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
            {team.length} member{team.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Btn variant="primary" onClick={() => setShowAdd(true)}>
          <UserPlus size={14} /> Invite member
        </Btn>
      </div>

      {showAdd && (
        <Card className="mb-6">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Field label="Name"><Input value={name} onChange={setName} placeholder="Aanya Sharma" /></Field>
            <Field label="Email"><Input value={email} onChange={setEmail} placeholder="aanya@brand.com" /></Field>
            <Field label="Role">
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, fontFamily: FONT_SANS }}>
                <option>Owner</option>
                <option>Auditor</option>
                <option>Viewer</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</Btn>
            <Btn variant="primary" size="sm" onClick={addMember}>Add</Btn>
          </div>
        </Card>
      )}

      {team.length === 0 ? (
        <Card padded={false} className="py-16 flex flex-col items-center text-center">
          <Users size={28} style={{ color: C.textDim }} />
          <div className="mt-4 mb-1.5" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 24, color: C.text }}>No team members yet</div>
          <div className="text-sm max-w-xs mb-5" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
            Add teammates so they can run audits and review reports.
          </div>
        </Card>
      ) : (
        <Card padded={false}>
          {team.map((m, i) => (
            <div key={m.id} className="px-5 py-4 flex items-center gap-4"
              style={{ borderBottom: i < team.length - 1 ? `1px solid ${C.borderSoft}` : 'none' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm"
                style={{ background: C.surface2, color: C.accent, fontFamily: FONT_DISPLAY, fontWeight: 600 }}>
                {m.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-sm" style={{ color: C.text, fontFamily: FONT_SANS }}>{m.name}</div>
                <div className="text-xs flex items-center gap-2" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
                  <Mail size={10} /> {m.email || 'no email'}
                </div>
              </div>
              <div className="text-[11px] uppercase tracking-[0.15em] px-2 py-0.5 rounded"
                style={{ background: C.surface2, color: C.textMute, fontFamily: FONT_SANS }}>{m.role}</div>
              <button onClick={() => removeMember(m.id)} className="p-1.5 rounded" style={{ color: C.textDim }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </Card>
      )}

      <div className="mt-8 text-xs" style={{ color: C.textDim, fontFamily: FONT_SANS }}>
        Note: in this preview build, team members are stored locally per browser. In production this would connect to your auth system.
      </div>
    </div>
  );
}

// ---------- Settings ----------
function SettingsView({ refresh }) {
  const [confirm, setConfirm] = useState(false);
  async function clearAll() {
    const keys = await store.list();
    for (const k of keys) await store.delete(k);
    setConfirm(false);
    refresh();
  }
  return (
    <div className="max-w-3xl mx-auto px-10 py-10">
      <h1 className="leading-tight mb-8" style={{ fontFamily: FONT_DISPLAY, letterSpacing: '-0.025em', fontWeight: 600, fontSize: 48, color: C.text }}>
        <span>Settings</span>
      </h1>

      <Card className="mb-4">
        <div className="text-base mb-1" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 20, color: C.text }}>About this build</div>
        <div className="text-sm leading-relaxed" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
          Revenue CRO Engine by Yuvaan Technologies uses Anthropic's Claude API to reason about your funnel like a senior CRO consultant. Each audit runs five deep parallel passes across the homepage, collection page, and product page — synthesizing context, screenshots, audience, country, and traffic intent into a single revenue-focused diagnosis.
        </div>
      </Card>

      <Card style={{ borderColor: `${C.accent}30` }}>
        <div className="text-base mb-1" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 20, color: C.text }}>Danger zone</div>
        <div className="text-sm mb-4" style={{ color: C.textMute, fontFamily: FONT_SANS }}>
          Delete all brands, audits, and team data. This cannot be undone.
        </div>
        {!confirm ? (
          <Btn variant="danger" size="sm" onClick={() => setConfirm(true)}>Reset everything</Btn>
        ) : (
          <div className="flex gap-2">
            <Btn variant="danger" size="sm" onClick={clearAll}>Yes, delete everything</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setConfirm(false)}>Cancel</Btn>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- Main App ----------
export default function App() {
  useGlobalStyles();

  const [view, setView] = useState({ name: 'dashboard' });
  const [brands, setBrands] = useState([]);
  const [audits, setAudits] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    const b = await store.get('brands', []);
    setBrands(Array.isArray(b) ? b : []);

    const auditKeys = await store.list('audit:');
    const auditList = [];
    for (const k of auditKeys) {
      const a = await store.get(k);
      if (a) auditList.push(a);
    }
    setAudits(auditList);

    const t = await store.get('team', []);
    setTeam(Array.isArray(t) ? t : []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, fontFamily: FONT_SANS }}>
        <Loader2 size={20} className="animate-spin" style={{ color: C.accent }} />
      </div>
    );
  }

  let content;
  if (view.name === 'dashboard') content = <Dashboard brands={brands} audits={audits} setView={setView} />;
  else if (view.name === 'brands') content = <BrandsView brands={brands} audits={audits} setView={setView} refresh={loadAll} />;
  else if (view.name === 'brand') content = <BrandDetail brandId={view.brandId} brands={brands} audits={audits} setView={setView} refresh={loadAll} />;
  else if (view.name === 'newAudit') content = <NewAuditWizard initialBrandId={view.brandId} brands={brands} setView={setView} refresh={loadAll} />;
  else if (view.name === 'report') content = <ReportView auditId={view.auditId} audits={audits} brands={brands} setView={setView} refresh={loadAll} />;
  else if (view.name === 'team') content = <TeamView team={team} refresh={loadAll} />;
  else if (view.name === 'settings') content = <SettingsView refresh={loadAll} />;

  return (
    <div className="min-h-screen flex relative" style={{ background: C.bg, color: C.text, fontFamily: FONT_SANS }}>
      <Sidebar view={view} setView={setView} brands={brands} />
      <div className="flex-1 overflow-y-auto scrollbar-thin relative" style={{ height: '100vh' }}>
        <div className="fade-in">
          {content}
        </div>
      </div>
    </div>
  );
}
