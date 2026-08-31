import { useState, useRef, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ── Supabase ──────────────────────────────────────────────────────
const SUPABASE_URL = "https://bhykyksawrhmvlzacnjb.supabase.co";
const SUPABASE_KEY = "sb_publishable_6-TPaxN2bgd8rNX2rcIzpg_CWdcqkjY";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Alpaca Paper Trading (via Vercel proxy — avoids browser CORS issues) ──
async function alpacaFetch(path, options = {}) {
  const r = await fetch(`/api/alpaca?path=${encodeURIComponent(path)}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) {
    console.error(`Alpaca proxy error for ${path}:`, data);
    throw new Error(data?.message || data?.error || `Request failed (HTTP ${r.status})`);
  }
  return data;
}

// Fetch current positions
async function getAlpacaPositions() {
  try {
    const data = await alpacaFetch("v2/positions");
    return Array.isArray(data) ? data : [];
  } catch(e) {
    console.error("Positions error:", e);
    return [];
  }
}

// Fetch recent orders
async function getAlpacaOrders() {
  try {
    const data = await alpacaFetch("v2/orders?status=all&limit=10");
    return Array.isArray(data) ? data : [];
  } catch(e) {
    console.error("Orders error:", e);
    return [];
  }
}

// Place a market order
async function placeOrder(symbol, notional) {
  if (notional < 1) return null;
  return alpacaFetch("v2/orders", {
    method: "POST",
    body: {
      symbol,
      notional: notional.toFixed(2),
      side: "buy",
      type: "market",
      time_in_force: "day",
    },
  });
}

// Invest savings according to risk profile allocations.
// Any "CASH" portion of a profile is routed to the Fixed/cash reserve —
// it stays as real cash in the Alpaca account (not bought into a ticker),
// and is reported back to the caller so the app can show it under "Fixed".
async function investSavings(amount, profile) {
  const results = [];
  let cashReserve = 0;
  for (const alloc of profile.allocations) {
    if (alloc.ticker === "CASH") {
      cashReserve += parseFloat(((amount * alloc.pct) / 100).toFixed(2));
      continue;
    }
    const notional = parseFloat(((amount * alloc.pct) / 100).toFixed(2));
    if (notional >= 1) {
      const order = await placeOrder(alloc.ticker, notional);
      results.push({ ticker: alloc.ticker, notional, order });
    }
  }
  return { orders: results, cashReserve };
}

// ── Constants ─────────────────────────────────────────────────────
const TYPE_COLORS = {
  sale:      {bg:"#e8f5e9",text:"#2e7d32", label:"SHOPPING", chart:"#4caf50"},
  bogo:      {bg:"#e8f5e9",text:"#2e7d32", label:"SHOPPING", chart:"#4caf50"},
  taxexempt: {bg:"#fff8e1",text:"#e65100", label:"SALE TAX", chart:"#ff9800"},
  return:    {bg:"#fce4ec",text:"#ad1457", label:"ITEM RETURNS", chart:"#e91e63"},
  manual:    {bg:"#e8f5e9",text:"#2e7d32", label:"SHOPPING", chart:"#4caf50"},
};
const STATE_TAX_RATES = {
  AL:0.04,AK:0.00,AZ:0.056,AR:0.065,CA:0.0725,CO:0.029,CT:0.0635,DE:0.00,
  FL:0.06,GA:0.04,HI:0.04,ID:0.06,IL:0.0625,IN:0.07,IA:0.06,KS:0.065,
  KY:0.06,LA:0.0445,ME:0.055,MD:0.06,MA:0.0625,MI:0.06,MN:0.06875,MS:0.07,
  MO:0.04225,MT:0.00,NE:0.055,NV:0.0685,NH:0.00,NJ:0.06625,NM:0.05125,
  NY:0.04,NC:0.0475,ND:0.05,OH:0.0575,OK:0.045,OR:0.00,PA:0.06,RI:0.07,
  SC:0.06,SD:0.045,TN:0.07,TX:0.0625,UT:0.0485,VT:0.06,VA:0.043,WA:0.065,
  WV:0.06,WI:0.05,WY:0.04,
};
// ── Helpers ───────────────────────────────────────────────────────
async function detectStateFromCoords(lat,lon) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    const d = await r.json();
    return d?.address?.["ISO3166-2-lvl4"]?.replace("US-","") || null;
  } catch { return null; }
}
function storeIcon(s) {
  const x=s.toLowerCase();
  if(x.includes("whole")||x.includes("trader")||x.includes("sprouts")) return "🌿";
  if(x.includes("target")) return "🎯";
  if(x.includes("costco")||x.includes("sam")) return "🏪";
  if(x.includes("walmart")) return "🛒";
  if(x.includes("cvs")||x.includes("walgreens")) return "💊";
  if(x.includes("amazon")) return "📦";
  if(x.includes("best buy")) return "🖥️";
  if(x.includes("nordstrom")||x.includes("zara")||x.includes("gap")||x.includes("nike")) return "👕";
  return "🛍️";
}
function fmt(d) { return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"}); }

// ── Built-in Receipt Parser ───────────────────────────────────────
function parseReceipt(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const full  = text.toLowerCase();

  // ── Store: check known names first, then fallback to first readable line ──
  const knownStores = ["publix","kroger","target","walmart","costco","whole foods",
    "trader joe","cvs","walgreens","aldi","safeway","wegmans","heb","meijer",
    "winn dixie","food lion","giant","stop shop","hy-vee","sprouts","amazon"];
  let store = "";
  for (const s of knownStores) {
    if (full.includes(s)) {
      store = s.split(" ").map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
      break;
    }
  }
  if (!store) {
    const skip = /^(date|time|tel|phone|receipt|thank|welcome|cashier|you saved|savings|\d)/i;
    store = lines.find(l => l.length > 2 && l.length < 40 && !skip.test(l)) || "Unknown Store";
    store = store.replace(/\.$/, ""); // strip trailing period
  }

  // ── Address ──────────────────────────────────────────────────────
  const addrMatch = text.match(/([A-Za-z\s]+,\s*[A-Z]{2}[\s.]*\d{5})/);
  const address = addrMatch ? addrMatch[1].trim() : null;

  // ── Shopping savings: prefer "SAVINGS: $X" total, else sum all "You saved" ──
  let shoppingSavings = 0;
  const savingsTotal = full.match(/^savings[:\s*]+\$?([\d,]+\.?\d{0,2})/m);
  if (savingsTotal) {
    shoppingSavings = parseFloat(savingsTotal[1].replace(/,/g,""));
  } else {
    const re = /you\s+saved[:\s]+\$?([\d,]+\.?\d{0,2})/gi;
    let m;
    while ((m = re.exec(full)) !== null) shoppingSavings += parseFloat(m[1].replace(/,/g,""));
    // Also detect "@ 2 for $X" BOGO style
    const bogo = /\d+\s*@\s*2\s+for\s+\$?([\d,]+\.?\d{0,2})/gi;
    while ((m = bogo.exec(full)) !== null) shoppingSavings += parseFloat((parseFloat(m[1])/2).toFixed(2));
    shoppingSavings = parseFloat(shoppingSavings.toFixed(2));
  }

  // ── Subtotal: "Subtotal\n30.43" or "Subtotal: 30.43" ─────────────
  let totalPurchase = 0;
  const subIdx = lines.findIndex(l => /^subtotal/i.test(l));
  if (subIdx >= 0 && subIdx+1 < lines.length) {
    const m = lines[subIdx+1].match(/^([\d,]+\.[\d]{2})/);
    if (m) totalPurchase = parseFloat(m[1].replace(/,/g,""));
  }
  if (!totalPurchase) {
    const m = full.match(/subtotal[:\s]+\$?([\d,]+\.[\d]{2})/i);
    if (m) totalPurchase = parseFloat(m[1].replace(/,/g,""));
  }

  // ── Tax paid: handle "Sales Tax 7.5% - T\n1.18" and "Tax: 1.18" ──
  let taxPaid = 0;
  const taxIdx = lines.findIndex(l => /sales?\s*tax/i.test(l));
  if (taxIdx >= 0) {
    // Try amount after % on same line
    const same = lines[taxIdx].match(/%[^$\d]*\$?([\d]+\.[\d]{2})/);
    if (same) taxPaid = parseFloat(same[1]);
    // Else look at next line for a plain dollar amount
    else if (taxIdx+1 < lines.length) {
      const next = lines[taxIdx+1].match(/^([\d]+\.[\d]{2})$/);
      if (next) taxPaid = parseFloat(next[1]);
    }
  }
  if (!taxPaid) {
    const m = full.match(/\btax[:\s]+\$?([\d]+\.[\d]{2})/i);
    if (m) taxPaid = parseFloat(m[1]);
  }

  // ── Tax rate: detect a printed percentage like "Sales Tax 7.5%" ──
  let taxRateDetected = 0;
  const rateMatch = full.match(/(?:sales?\s*tax|tax\s*rate)[^%\d]*(\d{1,2}\.?\d{0,3})\s*%/i);
  if (rateMatch) taxRateDetected = parseFloat(rateMatch[1]);

  // ── Receipt total: "Total\n31.61" or "Total: 31.61" ──────────────
  let receiptTotal = 0;
  const totalIdx = lines.findIndex(l => /^total$/i.test(l));
  if (totalIdx >= 0) {
    for (let i = totalIdx+1; i < Math.min(totalIdx+4, lines.length); i++) {
      const m = lines[i].match(/^([\d,]+\.[\d]{2})$/);
      if (m && parseFloat(m[1]) > 0) { receiptTotal = parseFloat(m[1].replace(/,/g,"")); break; }
    }
  }
  if (!receiptTotal) {
    const m = full.match(/(?:total|amount\s*due)[:\s]+\$?([\d,]+\.[\d]{2})/i);
    if (m) receiptTotal = parseFloat(m[1].replace(/,/g,""));
  }

  // ── Infer subtotal if missing ─────────────────────────────────────
  if (!totalPurchase && receiptTotal > 0 && taxPaid > 0) {
    totalPurchase = parseFloat((receiptTotal - taxPaid).toFixed(2));
  }

  return {
    store,
    address,
    receiptTotal,
    shoppingSavings: parseFloat(shoppingSavings.toFixed(2)),
    totalPurchase,
    taxPaid,
    taxRateDetected,
    saleTax: 0, // calculated in modal using entered/detected rate
    netSavings: parseFloat(shoppingSavings.toFixed(2)),
  };
}

// ── Built-in Return Parser ────────────────────────────────────────
function parseReturn(text) {
  const full  = text.toLowerCase();
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // ── Store name ───────────────────────────────────────────────────
  const knownStores = ["amazon","target","walmart","costco","best buy","nordstrom","zara",
    "gap","h&m","kohls","wayfair","chewy","home depot","lowes","tj maxx","sephora","ulta","cvs","walgreens","publix","kroger"];
  let store = knownStores.find(s => full.includes(s)) || "";
  if (store) store = store.charAt(0).toUpperCase() + store.slice(1);
  else {
    const skipWords = /^(date|time|order|return|refund|ref|#|\d)/i;
    store = lines.find(l => l.length > 2 && l.length < 40 && !skipWords.test(l)) || "Unknown Store";
  }

  // ── Refund amount ────────────────────────────────────────────────
  const amountPatterns = [
    /refund[:\s]+\$?([\d,]+\.?\d{0,2})/i,
    /return[:\s]+\$?([\d,]+\.?\d{0,2})/i,
    /credit[:\s]+\$?([\d,]+\.?\d{0,2})/i,
    /amount[:\s]+\$?([\d,]+\.?\d{0,2})/i,
    /total[:\s]+\$?([\d,]+\.?\d{0,2})/i,
    /\$\s*([\d,]+\.?\d{0,2})/,
  ];
  let amount = 0;
  for (const pat of amountPatterns) {
    const m = full.match(pat);
    if (m) { amount = parseFloat(m[1].replace(/,/g,"")); if (amount > 0) break; }
  }

  // ── Item name ─────────────────────────────────────────────────────
  const itemPatterns = [
    /item[:\s]+(.+)/i,
    /product[:\s]+(.+)/i,
    /description[:\s]+(.+)/i,
    /returned[:\s]+(.+)/i,
  ];
  let item = "";
  for (const pat of itemPatterns) {
    const m = text.match(pat);
    if (m) { item = m[1].trim().slice(0, 50); break; }
  }
  if (!item) item = "Returned Item";

  // ── Refund method ─────────────────────────────────────────────────
  let method = "original";
  if (/store\s*credit/i.test(full)) method = "store_credit";
  else if (/cash/i.test(full)) method = "cash";

  return { store: store.trim(), item, amount: parseFloat(amount.toFixed(2)), method };
}


// ── Styles ────────────────────────────────────────────────────────
const S = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'DM Sans',sans-serif;background:#f7f5f0;color:#1a1a1a;min-height:100vh;}
  .app{max-width:480px;margin:0 auto;min-height:100vh;background:#f7f5f0;position:relative;overflow-x:hidden;}
  .auth-screen{min-height:100vh;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;position:relative;overflow:hidden;}
  .auth-screen::before{content:'';position:absolute;top:-80px;right:-80px;width:280px;height:280px;border-radius:50%;background:rgba(212,175,55,0.08);}
  .auth-logo{font-family:'Playfair Display',serif;font-size:42px;color:#fff;font-weight:700;margin-bottom:6px;z-index:1;}
  .auth-logo span{color:#d4af37;}
  .auth-tagline{font-size:14px;color:rgba(255,255,255,0.45);margin-bottom:48px;z-index:1;letter-spacing:0.5px;}
  .auth-card{background:#fff;border-radius:24px;padding:28px 24px;width:100%;max-width:380px;z-index:1;}
  .auth-tabs{display:grid;grid-template-columns:1fr 1fr;background:#f5f2ec;border-radius:12px;padding:4px;margin-bottom:24px;}
  .auth-tab{padding:10px;text-align:center;border-radius:9px;font-size:14px;font-weight:500;color:#888;cursor:pointer;transition:all 0.2s;}
  .auth-tab.active{background:#fff;color:#1a1a2e;font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,0.08);}
  .auth-field{margin-bottom:14px;}
  .auth-field label{display:block;font-size:11px;font-weight:600;color:#888;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;}
  .auth-field input{width:100%;border:1.5px solid #e8e4dc;border-radius:12px;padding:12px 14px;font-family:'DM Sans',sans-serif;font-size:15px;color:#1a1a2e;background:#faf9f7;outline:none;transition:border-color 0.2s;}
  .auth-field input:focus{border-color:#d4af37;background:#fff;}
  .auth-btn{width:100%;background:#d4af37;color:#1a1a2e;border:none;border-radius:14px;padding:15px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:700;cursor:pointer;margin-top:4px;transition:all 0.2s;box-shadow:0 4px 16px rgba(212,175,55,0.3);}
  .auth-btn:hover{background:#c9a227;}
  .auth-hint{text-align:center;font-size:12px;color:#bbb;margin-top:14px;}
  .auth-hint span{color:#d4af37;cursor:pointer;}
  .ob-screen{min-height:100vh;background:#f7f5f0;display:flex;flex-direction:column;}
  .ob-progress{display:flex;gap:6px;padding:56px 24px 0;}
  .ob-dot{flex:1;height:3px;border-radius:2px;background:#e8e4dc;transition:background 0.3s;}
  .ob-dot.done{background:#d4af37;}
  .ob-body{flex:1;padding:32px 24px;display:flex;flex-direction:column;}
  .ob-icon{font-size:56px;margin-bottom:20px;}
  .ob-title{font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#1a1a2e;margin-bottom:12px;line-height:1.2;}
  .ob-title span{color:#d4af37;}
  .ob-desc{font-size:15px;color:#666;line-height:1.6;margin-bottom:32px;}
  .ob-features{display:flex;flex-direction:column;gap:12px;margin-bottom:auto;}
  .ob-feature{display:flex;align-items:center;gap:12px;background:#fff;border-radius:14px;padding:14px;border:1px solid #f0ece4;}
  .ob-feature-icon{font-size:22px;width:40px;height:40px;background:#f7f5f0;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .ob-feature-text{font-size:13px;font-weight:500;color:#1a1a2e;}
  .ob-feature-sub{font-size:11px;color:#aaa;margin-top:2px;}
  .ob-actions{padding:24px;display:flex;gap:12px;}
  .ob-next{flex:1;background:#1a1a2e;color:#fff;border:none;border-radius:14px;padding:15px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;cursor:pointer;}
  .ob-skip{background:none;border:none;color:#bbb;font-size:13px;cursor:pointer;padding:15px 12px;font-family:'DM Sans',sans-serif;}
  .header{background:#1a1a2e;padding:48px 24px 0;position:relative;overflow:hidden;}
  .header::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;border-radius:50%;background:rgba(212,175,55,0.12);}
  .header-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;position:relative;z-index:1;}
  .header-greeting{font-size:12px;color:rgba(255,255,255,0.5);letter-spacing:1px;}
  .header-name{font-family:'Playfair Display',serif;font-size:20px;color:#fff;font-weight:600;}
  .header-avatar{width:36px;height:36px;border-radius:50%;background:#d4af37;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#1a1a2e;}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 0 20px;}
  .card{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:16px;}
  .card-label{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-bottom:6px;}
  .card-value{font-family:'Playfair Display',serif;font-size:22px;color:#fff;font-weight:600;}
  .card-value.gold{color:#d4af37;}
  .card-sub{font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px;}
  .bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:#fff;border-top:1px solid #f0ece4;display:grid;grid-template-columns:repeat(4,1fr);padding:10px 0 20px;z-index:50;}
  .nav-item{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:6px;font-size:10px;color:#bbb;font-weight:500;transition:color 0.2s;}
  .nav-item.active{color:#d4af37;}
  .nav-icon{font-size:20px;}
  .pb-nav{padding-bottom:90px;}
  .invest-bar{padding:16px 16px 0;}
  .invest-btn{width:100%;background:#d4af37;color:#1a1a2e;border:none;border-radius:14px;padding:16px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s;box-shadow:0 4px 20px rgba(212,175,55,0.3);}
  .invest-btn:hover{background:#c9a227;transform:translateY(-1px);}
  .invest-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none;}
  .section{padding:16px 16px 0;}
  .section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
  .section-title{font-family:'Playfair Display',serif;font-size:18px;font-weight:600;color:#1a1a2e;}
  .see-all{font-size:12px;color:#d4af37;font-weight:500;background:none;border:none;cursor:pointer;}
  .add-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px;}
  .add-btn{background:#fff;border:1.5px solid #e8e4dc;border-radius:14px;padding:14px 8px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:all 0.2s;font-family:'DM Sans',sans-serif;}
  .add-btn:hover{border-color:#d4af37;box-shadow:0 4px 16px rgba(212,175,55,0.15);transform:translateY(-2px);}
  .add-btn .icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;}
  .add-btn .btn-label{font-size:11px;font-weight:500;color:#555;text-align:center;line-height:1.3;}
  .savings-item{background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;gap:12px;border:1px solid #f0ece4;}
  .savings-icon-wrap{width:42px;height:42px;border-radius:12px;background:#f7f5f0;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
  .savings-info{flex:1;min-width:0;}
  .savings-store{font-size:13px;font-weight:600;color:#1a1a2e;margin-bottom:2px;}
  .savings-name{font-size:12px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .savings-right{text-align:right;flex-shrink:0;}
  .savings-amount{font-family:'Playfair Display',serif;font-size:16px;font-weight:600;color:#2e7d32;}
  .badge{display:inline-block;padding:2px 7px;border-radius:20px;font-size:9px;font-weight:700;letter-spacing:1px;margin-top:3px;}
  .invested-tag{font-size:10px;color:#d4af37;font-weight:500;margin-top:3px;}
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:flex-end;justify-content:center;}
  .modal{background:#fff;border-radius:24px 24px 0 0;padding:28px 24px 40px;width:100%;max-width:480px;animation:slideUp 0.3s ease;max-height:90vh;overflow-y:auto;}
  @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
  .modal-handle{width:36px;height:4px;background:#e0dbd0;border-radius:2px;margin:0 auto 24px;}
  .modal-title{font-family:'Playfair Display',serif;font-size:22px;font-weight:600;color:#1a1a2e;margin-bottom:20px;}
  .field{margin-bottom:16px;}
  .field label{display:block;font-size:12px;font-weight:600;color:#888;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;}
  .field input,.field textarea{width:100%;border:1.5px solid #e8e4dc;border-radius:12px;padding:12px 14px;font-family:'DM Sans',sans-serif;font-size:15px;color:#1a1a2e;background:#faf9f7;outline:none;transition:border-color 0.2s;resize:none;}
  .field input:focus,.field textarea:focus{border-color:#d4af37;background:#fff;}
  .field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .type-sel{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;}
  .type-opt{border:1.5px solid #e8e4dc;border-radius:12px;padding:10px;text-align:center;cursor:pointer;font-size:12px;font-weight:500;color:#888;transition:all 0.2s;background:#faf9f7;}
  .type-opt.active{border-color:#d4af37;background:#fffbf0;color:#1a1a2e;}
  .sub-btn{width:100%;background:#1a1a2e;color:#fff;border:none;border-radius:14px;padding:16px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;cursor:pointer;transition:all 0.2s;margin-top:4px;}
  .sub-btn:hover{background:#2a2a4e;}
  .sub-btn:disabled{opacity:0.4;cursor:not-allowed;}
  .upload-zone{border:2px dashed #e8e4dc;border-radius:16px;padding:32px 16px;text-align:center;cursor:pointer;transition:all 0.2s;background:#faf9f7;margin-bottom:16px;}
  .upload-zone:hover{border-color:#d4af37;background:#fffbf0;}
  .processing{display:flex;align-items:center;gap:10px;padding:14px;background:#fffbf0;border-radius:12px;border:1px solid #f0e4b0;margin-bottom:16px;font-size:13px;color:#8a6d00;}
  .spinner{width:18px;height:18px;border:2px solid #f0e4b0;border-top-color:#d4af37;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;}
  @keyframes spin{to{transform:rotate(360deg)}}
  .parsed{background:#e8f5e9;border-radius:12px;padding:14px;margin-bottom:16px;border:1px solid #c8e6c9;}
  .parsed-lbl{font-size:11px;font-weight:700;color:#2e7d32;letter-spacing:1px;margin-bottom:6px;}
  .parsed-row{display:flex;justify-content:space-between;font-size:13px;color:#333;margin-bottom:3px;}
  .parsed-amt{font-family:'Playfair Display',serif;font-size:18px;color:#2e7d32;font-weight:600;margin-top:6px;}
  .tax-bar{display:flex;align-items:center;justify-content:space-between;background:#fff8e1;border:1px solid #ffe082;border-radius:10px;padding:10px 14px;font-size:13px;color:#5d4037;}
  .tax-badge{background:#e65100;color:#fff;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;}
  .ret-bar{background:#fce4ec;border:1px solid #f48fb1;border-radius:10px;padding:10px 14px;font-size:13px;color:#880e4f;}
  .toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:100px;font-size:13px;font-weight:500;z-index:999;animation:tIn 0.3s ease,tOut 0.3s ease 2.5s forwards;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,0.2);}
  @keyframes tIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
  @keyframes tOut{to{opacity:0;transform:translateX(-50%) translateY(20px)}}
  .detect-panel{background:#fff;border-radius:14px;border:1.5px solid #f0ece4;overflow:hidden;}
  .detect-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;cursor:pointer;user-select:none;}
  .detect-hdr-left{display:flex;align-items:center;gap:10px;}
  .detect-title{font-size:14px;font-weight:600;color:#1a1a2e;}
  .detect-sub{font-size:11px;color:#aaa;margin-top:1px;}
  .detect-badge{background:#ad1457;color:#fff;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700;}
  .detect-body{padding:12px 16px 16px;border-top:1px solid #f5f2ec;}
  .plaid-btn{width:100%;background:#1a1a2e;color:#fff;border:none;border-radius:12px;padding:13px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px;transition:all 0.2s;}
  .plaid-btn.conn{background:#1b5e20;cursor:default;}
  .plaid-btn:disabled{opacity:0.6;cursor:not-allowed;}
  .csv-zone{border:1.5px dashed #e8e4dc;border-radius:12px;padding:13px;text-align:center;cursor:pointer;font-size:12px;color:#aaa;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s;}
  .csv-zone:hover{border-color:#d4af37;color:#888;background:#fffbf0;}
  .pending-lbl{font-size:11px;font-weight:700;color:#ad1457;letter-spacing:1px;margin:12px 0 8px;}
  .pend-row{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #f5f2ec;}
  .pend-row:last-child{border-bottom:none;padding-bottom:0;}
  .pend-dot{width:8px;height:8px;border-radius:50%;background:#ad1457;flex-shrink:0;margin-top:5px;animation:pulse 1.5s infinite;}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.8)}}
  .pend-info{flex:1;min-width:0;}
  .pend-desc{font-size:12px;font-weight:600;color:#1a1a2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .pend-date{font-size:11px;color:#aaa;margin-top:1px;}
  .src-tag{font-size:10px;color:#bbb;text-transform:uppercase;font-weight:500;margin-top:2px;}
  .pend-right{text-align:right;flex-shrink:0;}
  .pend-amt{font-family:'Playfair Display',serif;font-size:15px;font-weight:600;color:#ad1457;}
  .pend-acts{display:flex;gap:6px;margin-top:4px;justify-content:flex-end;}
  .pa-yes{background:#ad1457;color:#fff;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .pa-yes:hover{background:#880e4f;}
  .pa-no{background:#f5f2ec;color:#888;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .port-header{background:#1a1a2e;padding:48px 24px 24px;position:relative;overflow:hidden;}
  .port-header::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;border-radius:50%;background:rgba(212,175,55,0.1);}
  .port-title{font-family:'Playfair Display',serif;font-size:24px;color:#fff;font-weight:700;margin-bottom:4px;position:relative;z-index:1;}
  .port-sub{font-size:12px;color:rgba(255,255,255,0.4);position:relative;z-index:1;}
  .port-big{font-family:'Playfair Display',serif;font-size:40px;color:#d4af37;font-weight:700;margin:8px 0 4px;position:relative;z-index:1;}
  .port-change{font-size:13px;color:#81c784;position:relative;z-index:1;}
  .chart-card{background:#fff;border-radius:16px;margin:16px 16px 0;padding:16px;border:1px solid #f0ece4;}
  .chart-title{font-size:13px;font-weight:600;color:#1a1a2e;margin-bottom:14px;}
  .pie-row{display:flex;align-items:center;gap:16px;}
  .pie-legend{flex:1;}
  .pie-item{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:12px;color:#555;}
  .pie-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
  .stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 16px 0;}
  .stat-card{background:#fff;border-radius:14px;padding:16px;border:1px solid #f0ece4;}
  .stat-label{font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
  .stat-value{font-family:'Playfair Display',serif;font-size:20px;font-weight:600;color:#1a1a2e;}
  .stat-sub{font-size:11px;color:#aaa;margin-top:3px;}
  .inv-header{background:linear-gradient(135deg,#1a1a2e 0%,#2d1f4e 100%);padding:48px 24px 24px;position:relative;overflow:hidden;}
  .inv-header::before{content:'';position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:rgba(212,175,55,0.1);}
  .inv-title{font-family:'Playfair Display',serif;font-size:22px;color:#fff;font-weight:700;margin-bottom:4px;position:relative;z-index:1;}
  .inv-sub{font-size:12px;color:rgba(255,255,255,0.4);position:relative;z-index:1;}
  .inv-total{font-family:'Playfair Display',serif;font-size:38px;color:#d4af37;font-weight:700;margin:8px 0 2px;position:relative;z-index:1;}
  .inv-gain{font-size:13px;margin-bottom:4px;position:relative;z-index:1;}
  .holding-card{background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;gap:12px;border:1px solid #f0ece4;}
  .holding-ticker{width:44px;height:44px;border-radius:12px;background:#1a1a2e;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#d4af37;flex-shrink:0;}
  .holding-info{flex:1;min-width:0;}
  .holding-name{font-size:13px;font-weight:600;color:#1a1a2e;}
  .holding-shares{font-size:11px;color:#aaa;margin-top:2px;}
  .holding-right{text-align:right;}
  .holding-value{font-family:'Playfair Display',serif;font-size:15px;font-weight:600;color:#1a1a2e;}
  .alloc-bar{height:8px;border-radius:4px;background:#f0ece4;overflow:hidden;margin:8px 0;}
  .alloc-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#d4af37,#f0c040);}
  .inv-action{margin:0 16px 12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .inv-act-btn{border:none;border-radius:12px;padding:13px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;}
  .inv-act-btn.primary{background:#d4af37;color:#1a1a2e;}
  .inv-act-btn.secondary{background:#f0ece4;color:#1a1a2e;}
  .set-header{background:#1a1a2e;padding:48px 24px 24px;}
  .set-title{font-family:'Playfair Display',serif;font-size:24px;color:#fff;font-weight:700;}
  .set-avatar-row{display:flex;align-items:center;gap:16px;background:#fff;border-radius:16px;padding:16px;margin:16px 16px 0;border:1px solid #f0ece4;}
  .set-avatar{width:56px;height:56px;border-radius:50%;background:#d4af37;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#1a1a2e;flex-shrink:0;}
  .set-name{font-size:16px;font-weight:600;color:#1a1a2e;}
  .set-email{font-size:12px;color:#aaa;margin-top:2px;}
  .set-section{margin:16px 16px 0;}
  .set-section-title{font-size:11px;font-weight:700;color:#aaa;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;}
  .set-item{background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;border:1px solid #f0ece4;cursor:pointer;}
  .set-item-left{display:flex;align-items:center;gap:12px;}
  .set-item-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;}
  .set-item-label{font-size:14px;font-weight:500;color:#1a1a2e;}
  .set-item-sub{font-size:11px;color:#aaa;margin-top:2px;}
  .toggle{width:44px;height:24px;border-radius:12px;position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0;}
  .toggle.on{background:#d4af37;}
  .toggle.off{background:#e0dbd0;}
  .toggle-knob{position:absolute;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.15);}
  .toggle.on .toggle-knob{left:23px;}
  .toggle.off .toggle-knob{left:3px;}
  .logout-btn{width:calc(100% - 32px);margin:16px;background:#fce4ec;color:#ad1457;border:none;border-radius:14px;padding:15px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;cursor:pointer;}
  .drop-row{background:#fff;border:1.5px solid #f0ece4;border-radius:14px;margin-bottom:10px;overflow:hidden;transition:border-color 0.2s;}
  .drop-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;cursor:pointer;user-select:none;transition:background 0.2s;}
  .drop-hdr:hover{background:#faf9f7;}
  .drop-hdr.open{border-bottom:1.5px solid #f0ece4;background:#faf9f7;}
  .drop-hdr-left{display:flex;align-items:center;gap:12px;}
  .drop-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
  .drop-label{font-size:14px;font-weight:600;color:#1a1a2e;}
  .drop-arrow{font-size:11px;color:#bbb;transition:transform 0.2s;}
  .drop-body{padding:8px 12px 12px;display:flex;flex-direction:column;gap:4px;background:#faf9f7;}
  .drop-item{display:flex;align-items:center;gap:12px;background:#fff;border:1.5px solid #f0ece4;border-radius:12px;padding:12px 14px;cursor:pointer;transition:all 0.2s;font-family:'DM Sans',sans-serif;text-align:left;width:100%;}
  .drop-item:hover{border-color:#d4af37;box-shadow:0 2px 8px rgba(212,175,55,0.12);}
  .drop-item-icon{font-size:20px;flex-shrink:0;}
  .drop-item-label{font-size:13px;font-weight:600;color:#1a1a2e;}
  .drop-item-sub{font-size:11px;color:#aaa;margin-top:2px;}
  .empty{text-align:center;padding:32px 16px;color:#bbb;font-size:14px;}
`;

// ── Risk Profiles ─────────────────────────────────────────────────
const RISK_PROFILES = [
  {
    id:"high", label:"High", emoji:"🔴",
    desc:"Aggressive growth — maximum return potential with higher short-term volatility.",
    tag:"Best for long-term investors (10+ years)",
    color:"#d32f2f", bg:"#ffebee",
    allocations:[
      {ticker:"VOO",  name:"Vanguard S&P 500",     pct:50, color:"#1565c0"},
      {ticker:"QQQ",  name:"Invesco Nasdaq 100",    pct:30, color:"#0288d1"},
      {ticker:"IEMG", name:"iShares Emerging Mkts", pct:20, color:"#00838f"},
    ]
  },
  {
    id:"medium-high", label:"Medium-High", emoji:"🟠",
    desc:"Growth-focused with some protection — strong returns with moderate risk.",
    tag:"Best for investors with 5–10 year horizon",
    color:"#e65100", bg:"#fff3e0",
    allocations:[
      {ticker:"VOO",  name:"Vanguard S&P 500",     pct:50, color:"#1565c0"},
      {ticker:"QQQ",  name:"Invesco Nasdaq 100",    pct:15, color:"#0288d1"},
      {ticker:"IEMG", name:"iShares Emerging Mkts", pct:15, color:"#00838f"},
      {ticker:"BND",  name:"Vanguard Total Bond",   pct:20, color:"#558b2f"},
    ]
  },
  {
    id:"medium", label:"Medium", emoji:"🟡",
    desc:"Balanced approach — steady growth with reduced volatility. Most popular choice.",
    tag:"Best for most investors (3–7 years)",
    color:"#f57f17", bg:"#fffde7",
    allocations:[
      {ticker:"VOO",  name:"Vanguard S&P 500",     pct:40, color:"#1565c0"},
      {ticker:"IEMG", name:"iShares Emerging Mkts", pct:10, color:"#00838f"},
      {ticker:"BND",  name:"Vanguard Total Bond",   pct:40, color:"#558b2f"},
      {ticker:"CASH", name:"Cash Reserve",           pct:10, color:"#aaa"},
    ]
  },
  {
    id:"low", label:"Low", emoji:"🟢",
    desc:"Conservative — capital preservation with modest growth. Mostly bonds and stable assets.",
    tag:"Best for cautious investors or short-term (1–3 years)",
    color:"#2e7d32", bg:"#e8f5e9",
    allocations:[
      {ticker:"VOO",  name:"Vanguard S&P 500",     pct:20, color:"#1565c0"},
      {ticker:"BND",  name:"Vanguard Total Bond",   pct:60, color:"#558b2f"},
      {ticker:"CASH", name:"Cash Reserve",           pct:20, color:"#aaa"},
    ]
  },
  {
    id:"fixed", label:"Fixed", emoji:"🏦",
    desc:"Fixed interest rate — like a high-yield savings account. Guaranteed return, zero market risk.",
    tag:"4.5% APY · FDIC insured · No market exposure",
    color:"#1565c0", bg:"#e3f2fd",
    allocations:[
      {ticker:"CASH", name:"High-Yield Savings",    pct:100, color:"#1565c0"},
    ]
  },
];

// ── Onboarding Data ───────────────────────────────────────────────
const OB_STEPS = [
  {icon:"💰",title:<>Turn shopping into <span>wealth</span></>,desc:"Shop, Save, Invest automatically captures money you save while shopping and puts it to work in your investment portfolio.",features:[{icon:"🛍️",t:"Shopping & Sale Tax Savings",s:"Capture sale discounts & tax-exempt items"},{icon:"🧾",t:"Sale Tax",s:"Save on food, water & prescriptions"},{icon:"🔄",t:"Item Return Savings",s:"Invest refunds before you spend them"}]},
  {icon:"📸",title:<>Two ways to <span>log savings</span></>,desc:"Paste digital receipts or enter savings manually — whichever is faster for you.",features:[{icon:"✨",t:"Digital Receipt",s:"Paste text or fetch from Gmail"},{icon:"✏️",t:"Manual Entry",s:"Quick entry with auto-calculated tax savings"},{icon:"🧾",t:"Sale Tax Included",s:"Every entry captures tax savings too"}]},
  {icon:"🔄",title:<>Don't forget <span>returns</span></>,desc:"Log item returns and invest the refund before you spend it elsewhere.",features:[{icon:"✨",t:"Digital Return Receipt",s:"Paste confirmation or fetch from Gmail"},{icon:"✏️",t:"Manual Entry",s:"Enter store, item & refund amount"},{icon:"🚀",t:"Invest Instantly",s:"Refunds go straight into your portfolio"}]},
  {icon:"📈",title:<>Watch your money <span>grow</span></>,desc:"Every dollar saved gets invested into diversified ETFs.",features:[{icon:"📊",t:"Portfolio Analytics",s:"Track growth over time"},{icon:"💼",t:"Diversified ETFs",s:"VOO, IEMG & more"},{icon:"🚀",t:"One-tap Investing",s:"Sweep savings instantly"}]},
  {icon:"⚖️",title:<>Choose your <span>risk profile</span></>,desc:"Pick how your savings get invested. You can change this anytime in Settings.",riskStep:true},
];

function OnboardingScreen({onDone,onSetRisk}) {
  const [step,setStep]=useState(0);
  const [selectedRisk,setSelectedRisk]=useState("medium");
  const ob=OB_STEPS[step];
  const isLast=step===OB_STEPS.length-1;
  const handleNext=()=>{
    if(isLast){ onSetRisk(selectedRisk); onDone(); }
    else setStep(s=>s+1);
  };
  return (
    <div className="ob-screen">
      <div className="ob-progress">{OB_STEPS.map((_,i)=><div key={i} className={`ob-dot${i<=step?" done":""}`}/>)}</div>
      <div className="ob-body">
        <div className="ob-icon">{ob.icon}</div>
        <div className="ob-title">{ob.title}</div>
        <div className="ob-desc">{ob.desc}</div>
        {ob.riskStep ? (
          <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:4}}>
            {RISK_PROFILES.map(p=>(
              <div key={p.id} onClick={()=>setSelectedRisk(p.id)}
                style={{background:selectedRisk===p.id?p.bg:"#fff",border:`2px solid ${selectedRisk===p.id?p.color:"#e8e4dc"}`,borderRadius:14,padding:"14px 16px",cursor:"pointer",transition:"all 0.2s"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                  <span style={{fontSize:18}}>{p.emoji}</span>
                  <span style={{fontSize:15,fontWeight:700,color:selectedRisk===p.id?p.color:"#1a1a2e"}}>{p.label}</span>
                  {p.id==="medium"&&<span style={{background:"#d4af37",color:"#1a1a2e",fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20,letterSpacing:0.5}}>POPULAR</span>}
                  {selectedRisk===p.id&&<span style={{marginLeft:"auto",color:p.color,fontSize:16}}>✓</span>}
                </div>
                <div style={{fontSize:12,color:"#666",marginBottom:3}}>{p.desc}</div>
                <div style={{fontSize:11,color:p.color,fontWeight:600}}>{p.tag}</div>
                {selectedRisk===p.id&&(
                  <div style={{display:"flex",gap:4,marginTop:10,flexWrap:"wrap"}}>
                    {p.allocations.map((a,i)=>(
                      <div key={i} style={{background:"#fff",border:`1px solid ${a.color}22`,borderRadius:8,padding:"4px 8px",fontSize:11,color:a.color,fontWeight:600}}>
                        {a.ticker} {a.pct}%
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="ob-features">{ob.features.map((f,i)=><div key={i} className="ob-feature"><div className="ob-feature-icon">{f.icon}</div><div><div className="ob-feature-text">{f.t}</div><div className="ob-feature-sub">{f.s}</div></div></div>)}</div>
        )}
      </div>
      <div className="ob-actions">
        <button className="ob-skip" onClick={()=>{onSetRisk("medium");onDone();}}>Skip</button>
        <button className="ob-next" onClick={handleNext}>{isLast?"Get Started 🚀":"Next →"}</button>
      </div>
    </div>
  );
}

// ── Screens ───────────────────────────────────────────────────────
function LoginScreen({onLogin}) {
  const [tab,setTab]=useState("login"); // "login" | "signup" | "forgot"
  const [f,setF]=useState({name:"",email:"",password:""});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
  const [resetSent,setResetSent]=useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const submit=async()=>{
    if(!f.email||!f.password) return;
    setLoading(true); setError(null);
    try {
      if(tab==="signup") {
        const {data,error}=await supabase.auth.signUp({
          email:f.email, password:f.password,
          options:{data:{full_name:f.name||f.email.split("@")[0]}}
        });
        if(error) throw error;
        onLogin({name:f.name||f.email.split("@")[0],email:f.email,id:data.user?.id}, true);
      } else {
        const {data,error}=await supabase.auth.signInWithPassword({email:f.email,password:f.password});
        if(error) throw error;
        const name=data.user?.user_metadata?.full_name||f.email.split("@")[0];
        onLogin({name,email:f.email,id:data.user?.id}, false);
      }
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const sendReset=async()=>{
    if(!f.email) return;
    setLoading(true); setError(null);
    try {
      const {error}=await supabase.auth.resetPasswordForEmail(f.email, {
        redirectTo: window.location.origin,
      });
      if(error) throw error;
      setResetSent(true);
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const switchTab=t=>{ setTab(t); setError(null); setResetSent(false); };

  return (
    <div className="auth-screen">
      <div className="auth-logo">Shop, Save, <span>Invest</span></div>
      <div className="auth-tagline">Shop smarter. Save automatically. Invest the difference.</div>
      <div className="auth-card">
        {tab!=="forgot"&&<div className="auth-tabs">
          <div className={`auth-tab${tab==="login"?" active":""}`} onClick={()=>switchTab("login")}>Sign In</div>
          <div className={`auth-tab${tab==="signup"?" active":""}`} onClick={()=>switchTab("signup")}>Create Account</div>
        </div>}

        {tab==="forgot"?(
          resetSent?(
            <div style={{textAlign:"center",padding:"12px 0 4px"}}>
              <div style={{fontSize:36,marginBottom:10}}>📬</div>
              <div style={{fontSize:15,fontWeight:600,color:"#1a1a2e",marginBottom:6}}>Check your email</div>
              <div style={{fontSize:13,color:"#888",marginBottom:20,lineHeight:1.5}}>We sent a password reset link to<br/><strong>{f.email}</strong></div>
              <button className="auth-btn" onClick={()=>switchTab("login")}>Back to Sign In</button>
            </div>
          ):(
            <>
              <div style={{fontSize:15,fontWeight:600,color:"#1a1a2e",marginBottom:6}}>Reset your password</div>
              <div style={{fontSize:12,color:"#888",marginBottom:16}}>Enter your email and we'll send you a reset link.</div>
              <div className="auth-field"><label>Email</label><input type="email" placeholder="you@email.com" value={f.email} onChange={e=>set("email",e.target.value)}/></div>
              {error&&<div style={{background:"#fce4ec",border:"1px solid #f48fb1",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#880e4f",marginBottom:12}}>{error}</div>}
              <button className="auth-btn" onClick={sendReset} disabled={loading||!f.email}>
                {loading?"Sending…":"Send Reset Link →"}
              </button>
              <div className="auth-hint"><span onClick={()=>switchTab("login")}>← Back to Sign In</span></div>
            </>
          )
        ):(
          <>
            {tab==="signup"&&<div className="auth-field"><label>Full Name</label><input placeholder="Jane Smith" value={f.name} onChange={e=>set("name",e.target.value)}/></div>}
            <div className="auth-field"><label>Email</label><input type="email" placeholder="you@email.com" value={f.email} onChange={e=>set("email",e.target.value)}/></div>
            <div className="auth-field"><label>Password</label><input type="password" placeholder="••••••••" value={f.password} onChange={e=>set("password",e.target.value)}/></div>
            {tab==="login"&&<div style={{textAlign:"right",marginTop:-10,marginBottom:16}}><span onClick={()=>switchTab("forgot")} style={{fontSize:12,color:"#d4af37",cursor:"pointer",fontWeight:600}}>Forgot password?</span></div>}
            {error&&<div style={{background:"#fce4ec",border:"1px solid #f48fb1",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#880e4f",marginBottom:12}}>{error}</div>}
            <button className="auth-btn" onClick={submit} disabled={loading}>
              {loading?"Processing…":tab==="login"?"Sign In →":"Create Account →"}
            </button>
            <div className="auth-hint">{tab==="login"?<>No account? <span onClick={()=>switchTab("signup")}>Sign up free</span></>:<>Already have one? <span onClick={()=>switchTab("login")}>Sign in</span></>}</div>
            <div style={{marginTop:16,textAlign:"center"}}><button style={{background:"none",border:"1px solid #e8e4dc",borderRadius:10,padding:"10px 20px",fontSize:13,color:"#888",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}} onClick={()=>onLogin({name:"Demo User",email:"demo@shopsaveinvest.app"}, false)}>👀 Try Demo</button></div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Reset Password Screen (shown after clicking email reset link) ──
function ResetPasswordScreen({onDone}) {
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
  const [done,setDone]=useState(false);

  const submit=async()=>{
    if(!password||password.length<6){ setError("Password must be at least 6 characters."); return; }
    if(password!==confirm){ setError("Passwords don't match."); return; }
    setLoading(true); setError(null);
    try {
      const {error}=await supabase.auth.updateUser({password});
      if(error) throw error;
      setDone(true);
      setTimeout(()=>onDone(),1800);
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-logo">Shop, Save, <span>Invest</span></div>
      <div className="auth-tagline">Shop smarter. Save automatically. Invest the difference.</div>
      <div className="auth-card">
        {done?(
          <div style={{textAlign:"center",padding:"12px 0 4px"}}>
            <div style={{fontSize:36,marginBottom:10}}>✅</div>
            <div style={{fontSize:15,fontWeight:600,color:"#1a1a2e",marginBottom:6}}>Password updated!</div>
            <div style={{fontSize:13,color:"#888"}}>Taking you to your account…</div>
          </div>
        ):(
          <>
            <div style={{fontSize:15,fontWeight:600,color:"#1a1a2e",marginBottom:6}}>Set a new password</div>
            <div style={{fontSize:12,color:"#888",marginBottom:16}}>Choose a new password for your account.</div>
            <div className="auth-field"><label>New Password</label><input type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)}/></div>
            <div className="auth-field"><label>Confirm Password</label><input type="password" placeholder="••••••••" value={confirm} onChange={e=>setConfirm(e.target.value)}/></div>
            {error&&<div style={{background:"#fce4ec",border:"1px solid #f48fb1",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#880e4f",marginBottom:12}}>{error}</div>}
            <button className="auth-btn" onClick={submit} disabled={loading}>
              {loading?"Updating…":"Update Password →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────
// ── Shared savings summary display ───────────────────────────────
function SavingsSummary({store,shoppingSavings,saleTax,netSavings}) {
  return (
    <div className="parsed">
      <div className="parsed-lbl">✓ SAVINGS SUMMARY</div>
      {store&&<div className="parsed-row"><span>Store</span><span style={{fontWeight:600,color:"#1a1a2e"}}>{store}</span></div>}
      <div className="parsed-row"><span>Shopping Savings</span><span style={{color:"#2e7d32",fontWeight:600}}>+${shoppingSavings.toFixed(2)}</span></div>
      <div className="parsed-row"><span>Sale Tax Exempt</span><span style={{color:"#e65100",fontWeight:600}}>+${saleTax.toFixed(2)}</span></div>
      <div style={{borderTop:"1px solid #c8e6c9",marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>Net Savings</span>
        <span className="parsed-amt" style={{marginTop:0}}>${netSavings.toFixed(2)}</span>
      </div>
    </div>
  );
}

function ManualModal({onClose,onSave,taxRate,stateCode}) {
  const savedRate=localStorage.getItem("lastTaxRate")||"";
  const [f,setF]=useState({store:"",shopping:"",taxPaid:"",totalPurchase:"",taxRateInput:savedRate});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const handleCurrencyInput=(key,val)=>{
    const digits=val.replace(/\D/g,"");
    if(!digits){ set(key,""); return; }
    const num=parseInt(digits,10)/100;
    set(key,num.toFixed(2));
  };

  // Use entered rate, or fall back to detected state rate
  const enteredRate=parseFloat(f.taxRateInput)||0;
  const effectiveTaxRate=(enteredRate/100)||taxRate||0.07;

  const shopping=parseFloat(f.shopping)||0;
  const taxPaid=parseFloat(f.taxPaid)||0;
  const totalPurchase=parseFloat(f.totalPurchase)||0;

  const fullTax=parseFloat((totalPurchase*effectiveTaxRate).toFixed(2));
  const saleTaxSavings=totalPurchase>0&&taxPaid>=0?parseFloat(Math.max(0,fullTax-taxPaid).toFixed(2)):0;
  const net=parseFloat((shopping+saleTaxSavings).toFixed(2));
  const ok=f.store&&net>0;

  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-handle"/>
        <div className="modal-title">Log Shopping & Sale Tax Savings</div>
        <div className="field">
          <label>Store</label>
          <input placeholder="e.g. Publix, Target" value={f.store} onChange={e=>set("store",e.target.value)}/>
        </div>
        <div className="field">
          <label>Shopping Savings ($)</label>
          <input type="text" inputMode="numeric" placeholder="$0.00" value={f.shopping} onChange={e=>handleCurrencyInput("shopping",e.target.value)}/>
          <div style={{fontSize:11,color:"#aaa",marginTop:4}}>From "You saved $X" at the bottom of your receipt</div>
        </div>

        <div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:12,padding:"12px 14px",marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:"#e65100",letterSpacing:1,marginBottom:10}}>🧾 SALE TAX SAVINGS</div>

          <div className="field" style={{marginBottom:10}}>
            <label>Tax Rate (%)</label>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0.0"
                value={f.taxRateInput}
                onKeyDown={e=>{
                  if(e.key==="Backspace"){
                    e.preventDefault();
                    const digits=(f.taxRateInput.replace(/[^0-9]/g,"")).slice(0,-1);
                    if(!digits){ set("taxRateInput",""); return; }
                    const num=parseInt(digits.padStart(2,"0"),10);
                    set("taxRateInput",(num/10).toFixed(1));
                  }
                }}
                onChange={e=>{
                  const newChar=e.target.value.replace(f.taxRateInput,"").replace(/[^0-9]/g,"");
                  if(!newChar) return;
                  const current=(f.taxRateInput.replace(/[^0-9]/g,""));
                  const digits=current+newChar;
                  const num=parseInt(digits.padStart(2,"0"),10);
                  set("taxRateInput",(num/10).toFixed(1));
                }}
                style={{flex:1}}
              />
              <span style={{fontSize:14,fontWeight:600,color:"#e65100",flexShrink:0}}>%</span>
            </div>
            <div style={{fontSize:11,color:"#aaa",marginTop:4}}>Type 7, 5 → 7.5% · Type 7, 0 → 7.0% · Type 1, 0, 0 → 10.0%</div>
          </div>

          <div className="field" style={{marginBottom:10}}>
            <label>Total Purchase Amount ($)</label>
            <input type="text" inputMode="numeric" placeholder="$0.00" value={f.totalPurchase} onChange={e=>handleCurrencyInput("totalPurchase",e.target.value)}/>
            <div style={{fontSize:11,color:"#aaa",marginTop:4}}>Subtotal before tax on your receipt</div>
          </div>

          <div className="field" style={{marginBottom:0}}>
            <label>Sale Tax Paid ($)</label>
            <input type="text" inputMode="numeric" placeholder="$0.00" value={f.taxPaid} onChange={e=>handleCurrencyInput("taxPaid",e.target.value)}/>
            <div style={{fontSize:11,color:"#aaa",marginTop:4}}>Sales tax line on your receipt</div>
          </div>

          {totalPurchase>0&&taxPaid>=0&&enteredRate>0&&(
            <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #ffe082",fontSize:12,color:"#5d4037"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span>Full tax at {parseFloat((effectiveTaxRate*100).toFixed(1))}%</span><span>${fullTax.toFixed(2)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span>Sale tax paid</span><span>− ${taxPaid.toFixed(2)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,color:"#e65100"}}>
                <span>Tax savings</span><span>+${saleTaxSavings.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {net>0&&<SavingsSummary store={f.store} shoppingSavings={shopping} saleTax={saleTaxSavings} netSavings={net}/>}
        <button className="sub-btn" disabled={!ok} onClick={()=>{
          if(f.taxRateInput) localStorage.setItem("lastTaxRate",f.taxRateInput);
          onSave({store:f.store,item:`${f.store} Savings`,type:"sale",saved:net,shoppingSavings:shopping,saleTax:saleTaxSavings});
          onClose();
        }}>Save ${net>0?net.toFixed(2):"0.00"} →</button>
      </div>
    </div>
  );
}

function EmailModal({onClose,onSave}) {
  const [st,setSt]=useState("idle");
  const [txt,setTxt]=useState("");
  const [res,setRes]=useState(null);
  const [err,setErr]=useState(null);
  const [taxRateInput,setTaxRateInput]=useState("");

  const go=()=>{
    if(!txt.trim()) return;
    setSt("processing"); setErr(null);
    setTimeout(()=>{
      const parsed=parseReceipt(txt);
      if(parsed.shoppingSavings===0&&parsed.taxPaid===0&&parsed.totalPurchase===0){
        setErr("No savings found. Check the receipt has 'You saved' or 'SAVINGS' printed on it, or try manual entry.");
        setSt("idle"); return;
      }
      // Use auto-detected tax rate from receipt if found, otherwise fall back to what user typed
      const effectiveRate=parsed.taxRateDetected>0?parsed.taxRateDetected:(parseFloat(taxRateInput)||0);
      if(parsed.taxRateDetected>0) setTaxRateInput(parsed.taxRateDetected.toFixed(1));
      if(effectiveRate>0&&parsed.totalPurchase>0){
        const fullTax=parseFloat((parsed.totalPurchase*(effectiveRate/100)).toFixed(2));
        parsed.saleTax=parseFloat(Math.max(0,fullTax-parsed.taxPaid).toFixed(2));
      } else {
        parsed.saleTax=0;
      }
      parsed.netSavings=parseFloat((parsed.shoppingSavings+parsed.saleTax).toFixed(2));
      setRes(parsed); setSt("done");
    },600);
  };

  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-handle"/>
        <div className="modal-title">Digital Receipt</div>

        {st==="idle"&&<>
            <div style={{background:"#e8f5e9",border:"1px solid #c8e6c9",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#2e7d32",marginBottom:14,display:"flex",gap:8}}>
              <span style={{flexShrink:0}}>🔍</span>
              <span><strong>Built-in parser</strong> reads any receipt — Publix, Amazon, Instacart, Target, and more.</span>
            </div>
            <div className="field">
              <label>Receipt Text</label>
              <textarea rows={8} placeholder="Paste your receipt text here…" value={txt} onChange={e=>setTxt(e.target.value)} style={{fontFamily:"monospace",fontSize:12,lineHeight:1.5}}/>
            </div>
            <div className="field">
              <label>Tax Rate (%) <span style={{color:"#aaa",fontWeight:400}}>— auto-detected if printed on receipt</span></label>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0.0"
                  value={taxRateInput}
                  onKeyDown={e=>{
                    if(e.key==="Backspace"){
                      e.preventDefault();
                      const digits=(taxRateInput.replace(/[^0-9]/g,"")).slice(0,-1);
                      if(!digits){ setTaxRateInput(""); return; }
                      const num=parseInt(digits.padStart(2,"0"),10);
                      setTaxRateInput((num/10).toFixed(1));
                    }
                  }}
                  onChange={e=>{
                    const newChar=e.target.value.replace(taxRateInput,"").replace(/[^0-9]/g,"");
                    if(!newChar) return;
                    const current=(taxRateInput.replace(/[^0-9]/g,""));
                    const digits=current+newChar;
                    const num=parseInt(digits.padStart(2,"0"),10);
                    setTaxRateInput((num/10).toFixed(1));
                  }}
                  style={{flex:1}}
                />
                <span style={{fontSize:14,fontWeight:600,color:"#e65100",flexShrink:0}}>%</span>
              </div>
              <div style={{fontSize:11,color:"#aaa",marginTop:4,textTransform:"uppercase",letterSpacing:0.3}}>Type sale tax, if not included on receipt</div>
            </div>

          {err&&<div style={{background:"#fce4ec",border:"1px solid #f48fb1",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#880e4f",marginBottom:12}}>{err}</div>}
          <button className="sub-btn" disabled={!txt.trim()} onClick={go}>🔍 Parse Receipt</button>
        </>}

        {st==="processing"&&<div style={{textAlign:"center",padding:"40px 0"}}>
          <div className="spinner" style={{margin:"0 auto 16px",width:32,height:32,borderWidth:3}}/>
          <div style={{fontSize:14,color:"#888",fontWeight:500}}>Reading your receipt…</div>
          <div style={{fontSize:12,color:"#bbb",marginTop:6}}>Identifying discounts & savings</div>
        </div>}

        {st==="done"&&res&&<>
          <SavingsSummary
            store={res.store}
            shoppingSavings={Number(res.shoppingSavings)||0}
            saleTax={Number(res.saleTax)||0}
            netSavings={Number(res.netSavings)||0}
          />
          {res.totalPurchase>0&&<div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#5d4037"}}>
            <div style={{fontWeight:700,color:"#e65100",marginBottom:6}}>🧾 Tax Breakdown</div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span>Subtotal</span><span>${Number(res.totalPurchase).toFixed(2)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span>Tax paid</span><span>${Number(res.taxPaid).toFixed(2)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,color:"#e65100"}}><span>Tax savings (exempt items)</span><span>+${Number(res.saleTax).toFixed(2)}</span></div>
          </div>}
          <button className="sub-btn" onClick={()=>{
            onSave({store:res.store,item:`${res.store} Savings`,type:"sale",saved:Number(res.netSavings),shoppingSavings:Number(res.shoppingSavings),saleTax:Number(res.saleTax)});
            onClose();
          }}>Save ${(Number(res.netSavings)||0).toFixed(2)} →</button>
          <button onClick={()=>{setRes(null);setSt("idle");setTxt("");}} style={{width:"100%",background:"none",border:"none",color:"#bbb",fontSize:13,cursor:"pointer",marginTop:8,fontFamily:"'DM Sans',sans-serif"}}>← Parse another receipt</button>
        </>}
      </div>
    </div>
  );
}

function TaxModal({onClose,onSave,taxRate,stateCode}) {
  const [f,setF]=useState({store:"",item:"",cat:"food",spend:""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const sp=parseFloat(f.spend)||0;const sv=parseFloat((sp*taxRate).toFixed(2));const dr=(taxRate*100).toFixed(2);
  const cats=[{k:"food",l:"🥦 Groceries"},{k:"water",l:"💧 Water"},{k:"prescription",l:"💊 Rx"}];
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-handle"/><div className="modal-title">Sale Tax Savings</div>
        <div className="tax-bar"><span>📍 State: <strong>{stateCode||"Unknown"}</strong></span><span className="tax-badge">{dr}% rate</span></div>
        <div className="field" style={{marginTop:14}}><label>Category</label><div className="type-sel" style={{gridTemplateColumns:"1fr 1fr 1fr"}}>{cats.map(c=><div key={c.k} className={`type-opt${f.cat===c.k?" active":""}`} onClick={()=>set("cat",c.k)}>{c.l}</div>)}</div></div>
        <div className="field"><label>Store</label><input placeholder="e.g. Kroger, CVS" value={f.store} onChange={e=>set("store",e.target.value)}/></div>
        <div className="field"><label>Item</label><input placeholder="e.g. Weekly groceries" value={f.item} onChange={e=>set("item",e.target.value)}/></div>
        <div className="field"><label>Total Exempt Spend ($)</label><input type="number" placeholder="$0.00" step="0.01" value={f.spend} onChange={e=>set("spend",e.target.value)}/></div>
        {sv>0&&<div className="parsed"><div className="parsed-lbl">✓ TAX SAVINGS</div><div className="parsed-row"><span>Purchase</span><span>${sp.toFixed(2)}</span></div><div className="parsed-row"><span>Rate ({dr}%)</span><span>× {taxRate.toFixed(4)}</span></div><div className="parsed-amt">Saved: ${sv.toFixed(2)}</div></div>}
        <button className="sub-btn" disabled={!f.store||!f.item||sv<=0} onClick={()=>{onSave({store:f.store,item:`${f.item} (Tax-Exempt)`,type:"taxexempt",saved:sv});onClose();}}>Save ${sv>0?sv.toFixed(2):"0.00"} →</button>
      </div>
    </div>
  );
}

// ── Return Shared Summary ─────────────────────────────────────────
function ReturnSummary({store,item,amount}) {
  return (
    <div className="parsed" style={{background:"#fce4ec",borderColor:"#f48fb1"}}>
      <div className="parsed-lbl" style={{color:"#ad1457"}}>✓ RETURN LOGGED</div>
      {store&&<div className="parsed-row"><span>Store</span><span style={{fontWeight:600,color:"#1a1a2e"}}>{store}</span></div>}
      {item&&<div className="parsed-row"><span>Item</span><span style={{fontWeight:600,color:"#1a1a2e"}}>{item}</span></div>}
      <div style={{borderTop:"1px solid #f48fb1",marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:13,fontWeight:600,color:"#880e4f"}}>Refund Amount</span>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#ad1457"}}>${Number(amount).toFixed(2)}</span>
      </div>
    </div>
  );
}

// ── Return Manual Modal (v2) ───────────────────────────────────────────
function ReturnModal({onClose,onSave}) {
  const [f,setF]=useState({store:"",item:"",amt:""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const handleCurrencyInput=(key,val)=>{
    const digits=val.replace(/\D/g,"");
    if(!digits){ set(key,""); return; }
    const num=parseInt(digits,10)/100;
    set(key,num.toFixed(2));
  };
  const amt=parseFloat(f.amt)||0;
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-handle"/><div className="modal-title">Item Return Savings</div>
        <div className="ret-bar">🔄 Returned money — invest it instead!</div>
        <div className="field" style={{marginTop:14}}><label>Store</label><input placeholder="e.g. Amazon, Target" value={f.store} onChange={e=>set("store",e.target.value)}/></div>
        <div className="field"><label>Item Returned</label><input placeholder="e.g. Bluetooth Speaker" value={f.item} onChange={e=>set("item",e.target.value)}/></div>
        <div className="field"><label>Refund Amount ($)</label><input type="text" inputMode="numeric" placeholder="$0.00" value={f.amt} onChange={e=>handleCurrencyInput("amt",e.target.value)}/></div>
        {amt>0&&<ReturnSummary store={f.store} item={f.item} amount={amt}/>}
        <button className="sub-btn" disabled={!f.store||!f.item||amt<=0} onClick={()=>{onSave({store:f.store,item:`${f.item} (Return)`,type:"return",saved:amt});onClose();}}>Invest ${amt>0?amt.toFixed(2):"0.00"} →</button>
      </div>
    </div>
  );
}

// ── Return Scan Modal ─────────────────────────────────────────────
// ── Return Digital Modal ──────────────────────────────────────────
function ReturnEmailModal({onClose,onSave}) {
  const [st,setSt]=useState("idle");
  const [txt,setTxt]=useState("");
  const [res,setRes]=useState(null);
  const [err,setErr]=useState(null);

  const go=()=>{
    if(!txt.trim()) return;
    setSt("processing"); setErr(null);
    setTimeout(()=>{
      const parsed=parseReturn(txt);
      if(!parsed.amount||parsed.amount<=0){
        setErr("No refund amount found. Try manual entry.");
        setSt("idle"); return;
      }
      setRes(parsed); setSt("done");
    },600);
  };

  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-handle"/>
        <div className="modal-title">Digital Return Receipt</div>
        {st==="idle"&&<>
            <div style={{background:"#fce4ec",border:"1px solid #f48fb1",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#880e4f",marginBottom:14,display:"flex",gap:8}}>
              <span style={{flexShrink:0}}>🔍</span>
              <span><strong>Built-in parser</strong> reads return confirmations from Amazon, Target, Walmart and more.</span>
            </div>
            <div className="field">
              <label>Return Confirmation Text</label>
              <textarea rows={7} placeholder="Paste your return confirmation or refund email here…" value={txt} onChange={e=>setTxt(e.target.value)} style={{fontFamily:"monospace",fontSize:12,lineHeight:1.5}}/>
            </div>
          {err&&<div style={{background:"#fce4ec",border:"1px solid #f48fb1",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#880e4f",marginBottom:12}}>{err}</div>}
          <button className="sub-btn" disabled={!txt.trim()} onClick={go}>🔍 Parse Return</button>
        </>}
        {st==="processing"&&<div style={{textAlign:"center",padding:"40px 0"}}>
          <div className="spinner" style={{margin:"0 auto 16px",width:32,height:32,borderWidth:3}}/>
          <div style={{fontSize:14,color:"#888",fontWeight:500}}>Reading your return confirmation…</div>
          <div style={{fontSize:12,color:"#bbb",marginTop:6}}>Identifying refund amount</div>
        </div>}
        {st==="done"&&res&&<>
          <ReturnSummary store={res.store} item={res.item} amount={res.amount}/>
          <button className="sub-btn" onClick={()=>{onSave({store:res.store,item:`${res.item} (Return)`,type:"return",saved:Number(res.amount)});onClose();}}>
            Invest ${Number(res.amount).toFixed(2)} →
          </button>
          <button onClick={()=>{setRes(null);setSt("idle");setTxt("");}} style={{width:"100%",background:"none",border:"none",color:"#bbb",fontSize:13,cursor:"pointer",marginTop:8,fontFamily:"'DM Sans',sans-serif"}}>← Parse another return</button>
        </>}
      </div>
    </div>
  );
}

// ── Portfolio Screen ──────────────────────────────────────────────
function PortfolioScreen({savings,invested}) {
  // ── Pie chart — real category breakdown ──────────────────────────
  const shoppingTotal=parseFloat(savings.filter(s=>s.type!=="return").reduce((a,s)=>a+(Number(s.shoppingSavings)||(s.saleTax?0:s.saved)),0).toFixed(2));
  const saleTaxTotal=parseFloat(savings.filter(s=>s.type!=="return").reduce((a,s)=>a+(Number(s.saleTax)||0),0).toFixed(2));
  const returnsTotal=parseFloat(savings.filter(s=>s.type==="return").reduce((a,s)=>a+Number(s.saved),0).toFixed(2));
  const byType=[
    {name:"Shopping Savings", value:shoppingTotal, color:"#4caf50"},
    {name:"Sale Tax",         value:saleTaxTotal,  color:"#ff9800"},
    {name:"Returns",          value:returnsTotal,  color:"#e91e63"},
  ].filter(x=>x.value>0);

  const totalSaved=parseFloat(savings.reduce((a,s)=>a+Number(s.saved),0).toFixed(2));

  // ── Monthly bar chart — group real savings by month ───────────────
  const monthlyMap={};
  savings.forEach(s=>{
    if(!s.date) return;
    const d=new Date(s.date);
    const key=d.toLocaleDateString("en-US",{month:"short",year:"2-digit"});
    if(!monthlyMap[key]) monthlyMap[key]={month:key,shopping:0,saleTax:0,returns:0};
    if(s.type==="return") {
      monthlyMap[key].returns+=s.saved;
    } else {
      const tax=Number(s.saleTax)||0;
      const shop=Number(s.shoppingSavings)||(tax?0:s.saved);
      monthlyMap[key].saleTax+=tax;
      monthlyMap[key].shopping+=shop;
    }
  });
  const monthlyData=Object.values(monthlyMap).map(m=>({
    ...m,
    shopping:parseFloat(m.shopping.toFixed(2)),
    saleTax:parseFloat(m.saleTax.toFixed(2)),
    returns:parseFloat(m.returns.toFixed(2)),
  })).sort((a,b)=>new Date("1 "+a.month)-new Date("1 "+b.month));

  // ── Line chart — cumulative invested value over time ─────────────
  const sortedSavings=[...savings].filter(s=>s.invested&&s.date).sort((a,b)=>new Date(a.date)-new Date(b.date));
  let cumulative=0;
  const lineData=[];
  const seenMonths=new Set();
  sortedSavings.forEach(s=>{
    cumulative+=s.saved;
    const d=new Date(s.date);
    const key=d.toLocaleDateString("en-US",{month:"short"});
    if(!seenMonths.has(key)){
      seenMonths.add(key);
      lineData.push({month:key,value:parseFloat(cumulative.toFixed(2))});
    } else {
      lineData[lineData.length-1].value=parseFloat(cumulative.toFixed(2));
    }
  });
  if(lineData.length===0) lineData.push({month:"Now",value:0});

  // ── Stats ────────────────────────────────────────────────────────
  const months=Object.keys(monthlyMap).length||1;
  const avgPerMonth=parseFloat((totalSaved/months).toFixed(2));
  const bestMonth=Object.values(monthlyMap).sort((a,b)=>(b.shopping+b.saleTax+b.returns)-(a.shopping+a.saleTax+a.returns))[0];
  const bestMonthTotal=bestMonth?parseFloat((bestMonth.shopping+bestMonth.saleTax+bestMonth.returns).toFixed(2)):0;

  return (
    <div style={{paddingBottom:90}}>
      <div className="port-header">
        <div className="port-title">Portfolio</div>
        <div className="port-sub">Your real savings & investments</div>
        <div className="port-big">${invested.toFixed(2)}</div>
        <div className="port-change">💰 Total invested from savings</div>
      </div>

      {/* Line chart — cumulative invested */}
      <div className="chart-card">
        <div className="chart-title">Cumulative Savings Invested ($)</div>
        {lineData.length>1?
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={lineData}>
              <XAxis dataKey="month" tick={{fontSize:11,fill:"#aaa"}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip contentStyle={{borderRadius:10,border:"none",fontSize:12}} formatter={v=>[`$${v.toFixed(2)}`,"Invested"]}/>
              <Line type="monotone" dataKey="value" stroke="#d4af37" strokeWidth={2.5} dot={false}/>
            </LineChart>
          </ResponsiveContainer>:
          <div style={{textAlign:"center",padding:"40px 0",color:"#bbb",fontSize:13}}>Log and invest savings to see growth chart</div>
        }
      </div>

      {/* Bar chart — monthly by category */}
      <div className="chart-card">
        <div className="chart-title">Monthly Savings by Category ($)</div>
        {monthlyData.length>0?
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData} barSize={8}>
              <XAxis dataKey="month" tick={{fontSize:11,fill:"#aaa"}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip contentStyle={{borderRadius:10,border:"none",fontSize:12}} formatter={v=>`$${Number(v).toFixed(2)}`}/>
              <Bar dataKey="shopping" stackId="a" fill="#4caf50" name="Shopping"/>
              <Bar dataKey="saleTax" stackId="a" fill="#ff9800" name="Sale Tax"/>
              <Bar dataKey="returns" stackId="a" fill="#e91e63" radius={[4,4,0,0]} name="Returns"/>
            </BarChart>
          </ResponsiveContainer>:
          <div style={{textAlign:"center",padding:"40px 0",color:"#bbb",fontSize:13}}>No savings logged yet</div>
        }
      </div>

      {/* Pie chart — category breakdown */}
      <div className="chart-card">
        <div className="chart-title">Savings Breakdown</div>
        {byType.length>0?
          <div className="pie-row">
            <PieChart width={120} height={120}>
              <Pie data={byType} cx={55} cy={55} innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                {byType.map((e,i)=><Cell key={i} fill={e.color}/>)}
              </Pie>
            </PieChart>
            <div className="pie-legend">
              {byType.map((e,i)=><div key={i} className="pie-item"><div className="pie-dot" style={{background:e.color}}/><span>{e.name}: <strong>${e.value.toFixed(2)}</strong></span></div>)}
            </div>
          </div>:
          <div style={{textAlign:"center",padding:"24px 0",color:"#bbb",fontSize:13}}>No savings logged yet</div>
        }
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label">Total Saved</div><div className="stat-value">${totalSaved.toFixed(2)}</div><div className="stat-sub">All time</div></div>
        <div className="stat-card"><div className="stat-label">Avg / Month</div><div className="stat-value">${avgPerMonth.toFixed(2)}</div><div className="stat-sub">{months} month{months!==1?"s":""}</div></div>
        <div className="stat-card"><div className="stat-label">Best Month</div><div className="stat-value">{bestMonth?bestMonth.month:"—"}</div><div className="stat-sub">{bestMonth?`$${bestMonthTotal.toFixed(2)} saved`:"No data yet"}</div></div>
        <div className="stat-card"><div className="stat-label">Invested</div><div className="stat-value">${invested.toFixed(2)}</div><div className="stat-sub">{savings.filter(s=>s.invested).length} entries</div></div>
      </div>
    </div>
  );
}

function InvestScreen({invested,riskId,onInvestAll,uninvested,fixedReserve,onSetRisk}) {
  const [positions,setPositions]=useState([]);
  const [orders,setOrders]=useState([]);
  const [loading,setLoading]=useState(true);
  const [investing,setInvesting]=useState(false);
  const [toast,setToast]=useState(null);
  const [showRisk,setShowRisk]=useState(false);
  const activeProfile=RISK_PROFILES.find(p=>p.id===riskId)||RISK_PROFILES[2];
  const profile=RISK_PROFILES.find(p=>p.id===riskId)||RISK_PROFILES[2];
  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),3000);};

  const loadPositions=async()=>{
    setLoading(true);
    try {
      const [pos,ord]=await Promise.all([getAlpacaPositions(),getAlpacaOrders()]);
      setPositions(pos);
      setOrders(ord);
    } catch(e){
      console.error("Alpaca error:",e);
    }
    finally { setLoading(false); }
  };

  useEffect(()=>{ loadPositions(); },[]);

  const handleInvest=async()=>{
    if(uninvested<1) return;
    setInvesting(true);
    try {
      if(onInvestAll) await onInvestAll(uninvested);
      showToast(`🚀 $${uninvested.toFixed(2)} invested!`);
      setTimeout(loadPositions,2000);
    } catch(e){
      showToast("Error placing trades. Try again.");
    } finally { setInvesting(false); }
  };

  // Calculate total from app-invested positions only
  const totalPositionValue=positions.reduce((a,p)=>a+parseFloat(p.market_value||0),0);
  const totalGain=positions.reduce((a,p)=>a+parseFloat(p.unrealized_pl||0),0);
  const gainPct=invested>0?(totalGain/invested)*100:0;

  return (
    <div style={{paddingBottom:90}}>
      {toast&&<div className="toast">{toast}</div>}
      <div className="inv-header">
        <div className="inv-title">Investment Account</div>
        <div className="inv-sub">Powered by Alpaca · Paper Trading</div>
        {loading?<div className="spinner" style={{margin:"16px auto",width:32,height:32,borderWidth:3}}/>:<>
          <div className="inv-total">${(invested+totalGain).toFixed(2)}</div>
          <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:4,flexWrap:"wrap"}}>
            <div style={{fontSize:12,color:"#aaa"}}>Invested: <span style={{color:"#d4af37",fontWeight:600}}>${invested.toFixed(2)}</span></div>
            {fixedReserve>0&&<div style={{fontSize:12,color:"#aaa"}}>Fixed: <span style={{color:"#90caf9",fontWeight:600}}>${fixedReserve.toFixed(2)}</span></div>}
            {totalGain!==0&&<div style={{fontSize:12,color:totalGain>=0?"#81c784":"#e57373"}}>
              {totalGain>=0?"↑":"↓"} {totalGain>=0?"+":""}{totalGain.toFixed(2)} ({gainPct.toFixed(2)}%)
            </div>}
          </div>
          <div style={{fontSize:11,color:"#666",marginTop:6,background:"rgba(255,255,255,0.1)",borderRadius:8,padding:"4px 10px",display:"inline-block"}}>
            📝 Paper Trading — no real money
          </div>
        </>}
      </div>

      <div className="inv-action">
        <button className="inv-act-btn primary" onClick={handleInvest} disabled={investing||uninvested<1}>
          {investing?<><span className="spinner" style={{borderColor:"rgba(255,255,255,0.3)",borderTopColor:"#fff",width:16,height:16,borderWidth:2}}/>Investing…</>:`🚀 Invest $${uninvested>0?uninvested.toFixed(2):"0.00"}`}
        </button>
        <button className="inv-act-btn secondary" onClick={loadPositions}>🔄 Refresh</button>
      </div>

      <div className="section">
        <div className="section-header"><div className="section-title">Holdings</div></div>
        {loading?<div style={{textAlign:"center",padding:20,color:"#aaa"}}>Loading positions…</div>:
          positions.length===0?(
            <div>
              <div style={{textAlign:"center",padding:"16px 24px",color:"#aaa",fontSize:13}}>
                No filled positions yet.
              </div>
              {orders.length>0&&<>
                <div style={{fontSize:12,fontWeight:700,color:"#888",letterSpacing:1,padding:"0 4px 8px"}}>PENDING / RECENT ORDERS</div>
                {orders.slice(0,5).map((o,i)=>(
                  <div key={i} className="holding-card">
                    <div className="holding-ticker" style={{background:"#fff8e1",color:"#e65100",fontSize:11}}>{o.symbol}</div>
                    <div className="holding-info">
                      <div className="holding-name">{o.symbol}</div>
                      <div className="holding-shares">${parseFloat(o.notional||0).toFixed(2)} · {o.side} · {o.type}</div>
                      <div className="alloc-bar"><div className="alloc-fill" style={{width:"60%",background:"#e65100"}}/></div>
                    </div>
                    <div className="holding-right">
                      <div style={{fontSize:11,fontWeight:700,color:o.status==="filled"?"#4caf50":o.status==="canceled"?"#f44336":"#e65100",textTransform:"uppercase"}}>{o.status}</div>
                      <div style={{fontSize:10,color:"#bbb",marginTop:2}}>{new Date(o.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
                <div style={{fontSize:11,color:"#aaa",textAlign:"center",marginTop:8}}>
                  Positions appear after market hours (Mon–Fri 9:30am–4pm ET)
                </div>
              </>}
            </div>
          ):
          positions.map((p,i)=>{
            const val=parseFloat(p.market_value||0);
            const pl=parseFloat(p.unrealized_pl||0);
            const plPct=parseFloat(p.unrealized_plpc||0)*100;
            const pct=totalPositionValue>0?((val/totalPositionValue)*100).toFixed(0):0;
            return (
              <div key={i} className="holding-card">
                <div className="holding-ticker">{p.symbol}</div>
                <div className="holding-info">
                  <div className="holding-name">{p.symbol}</div>
                  <div className="holding-shares">{parseFloat(p.qty).toFixed(4)} shares @ ${parseFloat(p.avg_entry_price).toFixed(2)}</div>
                  <div className="alloc-bar"><div className="alloc-fill" style={{width:`${pct}%`}}/></div>
                </div>
                <div className="holding-right">
                  <div className="holding-value">${val.toFixed(2)}</div>
                  <div style={{fontSize:11,color:pl>=0?"#4caf50":"#f44336",marginTop:2}}>{pl>=0?"+":""}{plPct.toFixed(2)}%</div>
                </div>
              </div>
            );
          })
        }
      </div>

      {fixedReserve>0&&(
        <div className="section" style={{paddingTop:16}}>
          <div className="section-header"><div className="section-title">Fixed / Cash Reserve</div></div>
          <div className="holding-card">
            <div className="holding-ticker" style={{background:"#e3f2fd",color:"#1565c0"}}>🏦</div>
            <div className="holding-info">
              <div className="holding-name">Fixed Interest Reserve</div>
              <div className="holding-shares">4.5% APY · Cash portion from your risk profile</div>
              <div className="alloc-bar"><div className="alloc-fill" style={{width:"100%",background:"#1565c0"}}/></div>
            </div>
            <div className="holding-right"><div className="holding-value">${fixedReserve.toFixed(2)}</div></div>
          </div>
        </div>
      )}

      {/* Investment Strategy / Risk Profile Selector */}
      <div className="section" style={{paddingTop:16}}>
        <div className="section-header"><div className="section-title">Investment Strategy</div></div>
        <div className="set-item" onClick={()=>setShowRisk(v=>!v)} style={{flexDirection:"column",alignItems:"stretch",background:"#fff",borderRadius:14,padding:"14px 16px",border:"1px solid #f0ece4"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div className="set-item-left">
              <div className="set-item-icon" style={{background:activeProfile.bg,fontSize:18}}>{activeProfile.emoji}</div>
              <div>
                <div className="set-item-label">{activeProfile.label} Risk</div>
                <div className="set-item-sub">{activeProfile.tag}</div>
              </div>
            </div>
            <span style={{color:"#ccc"}}>{showRisk?"▲":"▼"}</span>
          </div>
          {showRisk&&<div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
            {RISK_PROFILES.map(p=>(
              <div key={p.id} onClick={e=>{e.stopPropagation();onSetRisk(p.id);}}
                style={{background:riskId===p.id?p.bg:"#f7f5f0",border:`1.5px solid ${riskId===p.id?p.color:"#e8e4dc"}`,borderRadius:12,padding:"12px 14px",cursor:"pointer",transition:"all 0.2s"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span>{p.emoji}</span>
                  <span style={{fontSize:13,fontWeight:700,color:riskId===p.id?p.color:"#1a1a2e"}}>{p.label}</span>
                  {p.id==="medium"&&<span style={{background:"#d4af37",color:"#1a1a2e",fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:20}}>POPULAR</span>}
                  {riskId===p.id&&<span style={{marginLeft:"auto",color:p.color,fontWeight:700,fontSize:13}}>✓ Active</span>}
                </div>
                <div style={{fontSize:11,color:"#888",marginTop:4}}>{p.tag}</div>
                <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
                  {p.allocations.map((a,i)=><span key={i} style={{background:"#fff",border:`1px solid ${a.color}33`,borderRadius:6,padding:"2px 6px",fontSize:10,color:a.color,fontWeight:600}}>{a.ticker} {a.pct}%</span>)}
                </div>
              </div>
            ))}
          </div>}
        </div>
        <div style={{fontSize:11,color:"#aaa",textAlign:"center",marginTop:8}}>Changes apply to future investments only</div>
      </div>
    </div>
  );
}

function SettingsScreen({user,onLogout}) {
  return (
    <div style={{paddingBottom:90}}>
      <div className="set-header"><div className="set-title">Settings</div></div>
      <div className="set-avatar-row"><div className="set-avatar">{user.name.charAt(0).toUpperCase()}</div><div><div className="set-name">{user.name}</div><div className="set-email">{user.email}</div></div></div>

      <div className="set-section"><div className="set-section-title">About</div>
        {[{icon:"📋",bg:"#f5f2ec",label:"Terms of Service"},{icon:"🔒",bg:"#e8f5e9",label:"Privacy Policy"},{icon:"ℹ️",bg:"#e3f2fd",label:"Version",sub:"1.0.0 · Prototype"}].map((it,i)=><div key={i} className="set-item"><div className="set-item-left"><div className="set-item-icon" style={{background:it.bg}}>{it.icon}</div><div><div className="set-item-label">{it.label}</div>{it.sub&&<div className="set-item-sub">{it.sub}</div>}</div></div><span style={{color:"#ccc"}}>›</span></div>)}
      </div>
      <button className="logout-btn" onClick={onLogout}>Sign Out</button>
    </div>
  );
}

function HomeScreen({user,savings,setSavings,addSaving,handleInvestAll,invested,setInvested,taxRate,stateCode}) {
  const [modal,setModal]=useState(null);const [toast,setToast]=useState(null);const [investing,setInvesting]=useState(false);
  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),3000);};
  const handleAddSaving=async entry=>{ await addSaving(entry); showToast(`✓ $${entry.saved.toFixed(2)} saved from ${entry.store}!`); };
  const uninvested=savings.filter(s=>!s.invested).reduce((a,s)=>a+Number(s.saved),0);
  const handleInvest=()=>{
    if(uninvested<=0) return;
    setInvesting(true);
    setTimeout(async()=>{
      try {
        await handleInvestAll(uninvested);
        showToast(`🚀 $${uninvested.toFixed(2)} invested!`);
      } catch(e) {
        showToast(`⚠️ ${e.message||"Investment failed. Try again."}`);
      } finally {
        setInvesting(false);
      }
    },1800);
  };
  const [openDrop,setOpenDrop]=useState(null);
  const toggleDrop=key=>setOpenDrop(o=>o===key?null:key);
  return (
    <>
      <div className="header">
        <div className="header-top"><div><div className="header-greeting">WELCOME BACK</div><div className="header-name">{user.name}</div></div><div className="header-avatar">{user.name.charAt(0).toUpperCase()}</div></div>
        <div className="cards"><div className="card"><div className="card-label">Invested</div><div className="card-value gold">${invested.toFixed(2)}</div><div className="card-sub">↑ Growing</div></div><div className="card"><div className="card-label">Ready to Invest</div><div className="card-value">${uninvested.toFixed(2)}</div><div className="card-sub">{savings.filter(s=>!s.invested).length} new saves</div></div></div>
      </div>
      <div className="pb-nav">
        <div className="invest-bar"><button className="invest-btn" onClick={handleInvest} disabled={uninvested<=0||investing}>{investing?<><span className="spinner" style={{borderColor:"rgba(26,26,46,0.2)",borderTopColor:"#1a1a2e"}}/>Investing…</>:`🚀 Invest $${uninvested.toFixed(2)} Now`}</button></div>
        <div className="section">
          <div className="section-header"><div className="section-title">Add Savings</div></div>

          {/* ── Shopping Savings ── */}
          <div className="drop-row">
            <div className={`drop-hdr${openDrop==="shopping"?" open":""}`} onClick={()=>toggleDrop("shopping")}>
              <div className="drop-hdr-left"><div className="drop-icon" style={{background:"#e8f5e9"}}>🛍️</div><span className="drop-label">Shopping & Sale Tax Savings</span></div>
              <span className="drop-arrow">{openDrop==="shopping"?"▲":"▼"}</span>
            </div>
            {openDrop==="shopping"&&<div className="drop-body">
              <button className="drop-item" onClick={()=>{setModal("email");setOpenDrop(null);}}><span className="drop-item-icon">✨</span><div><div className="drop-item-label">Digital Receipt</div><div className="drop-item-sub">Paste text or fetch from Gmail</div></div></button>
              <button className="drop-item" onClick={()=>{setModal("manual");setOpenDrop(null);}}><span className="drop-item-icon">✏️</span><div><div className="drop-item-label">Manual Entry</div><div className="drop-item-sub">Enter sale or BOGO manually</div></div></button>
            </div>}
          </div>

          {/* ── Item Return Savings ── */}
          <div className="drop-row">
            <div className={`drop-hdr${openDrop==="returns"?" open":""}`} onClick={()=>toggleDrop("returns")}>
              <div className="drop-hdr-left"><div className="drop-icon" style={{background:"#fce4ec"}}>🔄</div><span className="drop-label">Item Return Savings</span></div>
              <span className="drop-arrow">{openDrop==="returns"?"▲":"▼"}</span>
            </div>
            {openDrop==="returns"&&<div className="drop-body">
              <button className="drop-item" onClick={()=>{setModal("returnEmail");setOpenDrop(null);}}><span className="drop-item-icon">✨</span><div><div className="drop-item-label">Digital Return Receipt</div><div className="drop-item-sub">Paste confirmation or fetch from Gmail</div></div></button>
              <button className="drop-item" onClick={()=>{setModal("return");setOpenDrop(null);}}><span className="drop-item-icon">✏️</span><div><div className="drop-item-label">Manual Entry</div><div className="drop-item-sub">Enter store, item & refund amount</div></div></button>
            </div>}
          </div>
        </div>
        <div className="section" style={{paddingTop:16}}>
          <div className="section-header"><div className="section-title">Savings History</div><span className="see-all">${savings.reduce((a,s)=>a+Number(s.saved),0).toFixed(2)} total</span></div>
          {savings.length===0&&<div className="empty">No savings yet!</div>}
          {savings.map(item=>{ const tc=TYPE_COLORS[item.type]||TYPE_COLORS.manual; return <div className="savings-item" key={item.id}><div className="savings-icon-wrap">{storeIcon(item.store)}</div><div className="savings-info"><div className="savings-store">{item.store}</div><div className="savings-name">{item.item}</div><div style={{fontSize:10,color:"#bbb",marginTop:2}}>{fmt(item.date)}</div></div><div className="savings-right"><div className="savings-amount">+${Number(item.saved).toFixed(2)}</div><div><span className="badge" style={{background:tc.bg,color:tc.text}}>{tc.label}</span></div>{item.invested&&<div className="invested-tag">✓ Invested</div>}</div></div>; })}
        </div>
      </div>
      {modal==="manual"&&<ManualModal onClose={()=>setModal(null)} onSave={handleAddSaving} taxRate={taxRate} stateCode={stateCode}/>}
      {modal==="email"&&<EmailModal onClose={()=>setModal(null)} onSave={handleAddSaving}/>}
      {modal==="tax"&&<TaxModal onClose={()=>setModal(null)} onSave={handleAddSaving} taxRate={taxRate} stateCode={stateCode}/>}
      {modal==="return"&&<ReturnModal onClose={()=>setModal(null)} onSave={handleAddSaving}/>}
      {modal==="returnEmail"&&<ReturnEmailModal onClose={()=>setModal(null)} onSave={handleAddSaving}/>}
      {toast&&<div className="toast">{toast}</div>}
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────
export default function App() {
  const [screen,setScreen]=useState("login");
  const [tab,setTab]=useState("home");
  const [user,setUser]=useState(null);
  const [savings,setSavings]=useState([]);
  const [invested,setInvested]=useState(0);
  const [fixedReserve,setFixedReserve]=useState(0);
  const [taxRate,setTaxRate]=useState(0.07);
  const [stateCode,setStateCode]=useState(null);
  const [riskId,setRiskId]=useState("medium");
  const [loadingData,setLoadingData]=useState(false);

  const loadUserData=async(userId)=>{
    if(!userId) return;
    setLoadingData(true);
    try {
      const {data,error}=await supabase.from("savings").select("*").eq("user_id",userId).order("created_at",{ascending:false});
      if(!error&&data){
        setSavings(data);
        setInvested(data.filter(s=>s.invested).reduce((a,s)=>a+Number(s.saved),0));
      }
      const {data:prefs}=await supabase.from("user_prefs").select("risk_id,fixed_reserve").eq("user_id",userId).single();
      if(prefs?.risk_id) setRiskId(prefs.risk_id);
      if(prefs?.fixed_reserve) setFixedReserve(Number(prefs.fixed_reserve));
    } catch(e){ console.error(e); }
    finally { setLoadingData(false); }
  };

  const addSaving=async(entry)=>{
    if(user?.id){
      const {data}=await supabase.from("savings").insert([{
        user_id:user.id,store:entry.store,item:entry.item,
        type:entry.type,saved:entry.saved,
        shoppingSavings:entry.shoppingSavings??null,
        saleTax:entry.saleTax??null,
        date:new Date().toISOString().split("T")[0],invested:false
      }]).select().single();
      if(data) { setSavings(s=>[data,...s]); return; }
    }
    setSavings(s=>[{...entry,id:Date.now(),date:new Date().toISOString().split("T")[0],invested:false},...s]);
  };

  const updateRiskId=async(newRiskId)=>{
    setRiskId(newRiskId);
    if(user?.id){
      try {
        await supabase.from("user_prefs").upsert(
          {user_id:user.id,risk_id:newRiskId,fixed_reserve:fixedReserve},
          {onConflict:"user_id"}
        );
      } catch(e){ console.error("Error saving risk profile:",e); }
    }
  };

  const handleInvestAll=async(amount)=>{
    const profile=RISK_PROFILES.find(p=>p.id===riskId)||RISK_PROFILES[2];
    const {cashReserve}=await investSavings(amount,profile); // throws if it fails — caller shows the error
    if(user?.id) {
      await supabase.from("savings").update({invested:true}).eq("user_id",user.id).eq("invested",false);
      if(cashReserve>0){
        const newReserve=parseFloat((fixedReserve+cashReserve).toFixed(2));
        await supabase.from("user_prefs").upsert({user_id:user.id,risk_id:riskId,fixed_reserve:newReserve},{onConflict:"user_id"});
        setFixedReserve(newReserve);
      }
    } else if(cashReserve>0) {
      setFixedReserve(v=>parseFloat((v+cashReserve).toFixed(2)));
    }
    setInvested(v=>v+amount);
    setSavings(s=>s.map(x=>({...x,invested:true})));
  };

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session?.user){
        const name=session.user.user_metadata?.full_name||session.user.email.split("@")[0];
        const u={name,email:session.user.email,id:session.user.id};
        setUser(u); loadUserData(session.user.id); setScreen("app");
      }
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="PASSWORD_RECOVERY"){
        setScreen("resetPassword");
        return;
      }
      if(!session){ setUser(null); setSavings([]); setInvested(0); setScreen("login"); setTab("home"); }
    });
    return ()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async pos=>{
      const code=await detectStateFromCoords(pos.coords.latitude,pos.coords.longitude);
      if(code&&STATE_TAX_RATES[code]!==undefined){setStateCode(code);setTaxRate(STATE_TAX_RATES[code]);}
    },()=>{},{timeout:6000});
  },[]);

  const handleLogout=async()=>{
    await supabase.auth.signOut();
    setUser(null); setSavings([]); setInvested(0); setScreen("login"); setTab("home");
  };

  if(screen==="resetPassword") return <><style>{S}</style><div className="app"><ResetPasswordScreen onDone={async()=>{
    const {data:{session}}=await supabase.auth.getSession();
    if(session?.user){
      const name=session.user.user_metadata?.full_name||session.user.email.split("@")[0];
      setUser({name,email:session.user.email,id:session.user.id});
      loadUserData(session.user.id);
      setScreen("app");
    } else {
      setScreen("login");
    }
  }}/></div></>;
  if(screen==="login") return <><style>{S}</style><div className="app"><LoginScreen onLogin={(u,isNew)=>{setUser(u);loadUserData(u.id);setScreen(isNew?"onboarding":"app");}}/></div></>;
  if(screen==="onboarding") return <><style>{S}</style><div className="app"><OnboardingScreen onDone={()=>setScreen("app")} onSetRisk={updateRiskId}/></div></>;
  if(loadingData) return <><style>{S}</style><div className="app" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",flexDirection:"column",gap:16}}><div className="spinner" style={{width:40,height:40,borderWidth:4}}/><div style={{fontSize:14,color:"#888",fontFamily:"'DM Sans',sans-serif"}}>Loading your account…</div></div></>;
  return (
    <>
      <style>{S}</style>
      <div className="app">
        {tab==="home"&&<HomeScreen user={user} savings={savings} setSavings={setSavings} addSaving={addSaving} handleInvestAll={handleInvestAll} invested={invested} setInvested={setInvested} taxRate={taxRate} stateCode={stateCode}/>}
        {tab==="portfolio"&&<PortfolioScreen savings={savings} invested={invested}/>}
        {tab==="invest"&&<InvestScreen invested={invested} riskId={riskId} onInvestAll={handleInvestAll} uninvested={savings.filter(s=>!s.invested).reduce((a,s)=>a+Number(s.saved),0)} fixedReserve={fixedReserve} onSetRisk={updateRiskId}/>}
        {tab==="settings"&&<SettingsScreen user={user} onLogout={handleLogout}/>}
        <div className="bottom-nav">
          <div className={`nav-item${tab==="home"?" active":""}`} onClick={()=>setTab("home")}><span className="nav-icon">🏠</span>Home</div>
          <div className={`nav-item${tab==="portfolio"?" active":""}`} onClick={()=>setTab("portfolio")}><span className="nav-icon">📊</span>Portfolio</div>
          <div className={`nav-item${tab==="invest"?" active":""}`} onClick={()=>setTab("invest")}><span className="nav-icon">💼</span>Invest</div>
          <div className={`nav-item${tab==="settings"?" active":""}`} onClick={()=>setTab("settings")}><span className="nav-icon">⚙️</span>Settings</div>
        </div>
      </div>
    </>
  );
}
