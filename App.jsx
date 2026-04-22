import { useState, useRef, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ── Supabase ──────────────────────────────────────────────────────
const SUPABASE_URL = "https://bhykyksawrhmvlzacnjb.supabase.co";
const SUPABASE_KEY = "sb_publishable_6-TPaxN2bgd8rNX2rcIzpg_CWdcqkjY";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Constants ─────────────────────────────────────────────────────
const MOCK_SAVINGS = [
  { id:1, store:"Whole Foods",  item:"Organic Oats (BOGO)",          type:"bogo",      saved:4.99,  date:"2026-04-07", invested:true  },
  { id:2, store:"Target",       item:"Laundry Detergent (Sale)",      type:"sale",      saved:6.50,  date:"2026-04-06", invested:true  },
  { id:3, store:"Costco",       item:"Olive Oil (BOGO)",              type:"bogo",      saved:12.99, date:"2026-04-04", invested:false },
  { id:4, store:"Trader Joe's", item:"Almond Butter (Sale)",          type:"sale",      saved:2.49,  date:"2026-04-02", invested:false },
  { id:5, store:"Publix",       item:"Groceries (Sale Tax Exempt)",   type:"taxexempt", saved:1.84,  date:"2026-04-03", invested:false },
  { id:6, store:"Amazon",       item:"Bluetooth Speaker (Return)",    type:"return",    saved:34.99, date:"2026-04-01", invested:false },
  { id:7, store:"CVS",          item:"Prescriptions (Sale Tax Exempt)",type:"taxexempt",saved:3.20,  date:"2026-03-30", invested:true  },
  { id:8, store:"Best Buy",     item:"Headphones (Return)",           type:"return",    saved:49.99, date:"2026-03-28", invested:true  },
  { id:9, store:"Kroger",       item:"Weekly Groceries (Sale)",       type:"sale",      saved:8.75,  date:"2026-03-25", invested:true  },
];

const PORTFOLIO_HISTORY = [
  {month:"Oct",value:12.40},{month:"Nov",value:28.90},{month:"Dec",value:41.20},
  {month:"Jan",value:67.80},{month:"Feb",value:89.50},{month:"Mar",value:118.30},{month:"Apr",value:149.73},
];
const MONTHLY_SAVINGS = [
  {month:"Oct",shopping:7.30,saleTax:1.80,returns:0},
  {month:"Nov",shopping:11.90,saleTax:2.10,returns:8.90},
  {month:"Dec",shopping:14.00,saleTax:3.50,returns:0},
  {month:"Jan",shopping:16.00,saleTax:2.90,returns:7.50},
  {month:"Feb",shopping:18.00,saleTax:4.20,returns:0},
  {month:"Mar",shopping:18.00,saleTax:3.80,returns:6.80},
  {month:"Apr",shopping:27.22,saleTax:5.04,returns:84.98},
];
const MOCK_HOLDINGS = [
  {name:"Vanguard S&P 500 ETF",ticker:"VOO", shares:0.42,price:489.20,change:+1.24},
  {name:"iShares Core MSCI",   ticker:"IEMG",shares:1.10,price:52.80, change:-0.31},
  {name:"Cash",                ticker:"CASH",shares:null,price:8.93,  change:0},
];
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
const RETURN_KEYWORDS = ["return","refund","credit","reversal","chargeback","rebate"];
const KNOWN_RETAILERS = ["amazon","target","walmart","costco","best buy","apple","nike","zara","gap",
  "nordstrom","kohls","wayfair","chewy","ebay","etsy","home depot","lowes","tj maxx","sephora","ulta","cvs","walgreens"];
const MOCK_PLAID = [
  {id:"p1",date:"2026-04-07",description:"AMAZON REFUND - ORDER #114-5678",amount:29.99},
  {id:"p2",date:"2026-04-06",description:"TARGET RETURN CREDIT",amount:14.49},
  {id:"p4",date:"2026-04-04",description:"NORDSTROM REFUND",amount:89.00},
  {id:"p6",date:"2026-04-03",description:"BEST BUY RETURN CREDIT",amount:44.99},
  {id:"p8",date:"2026-04-01",description:"CHEWY.COM REFUND",amount:19.95},
];
const MOCK_GMAIL = [
  {id:"m1",subject:"Your Amazon order #113-4521 confirmation",from:"auto-confirm@amazon.com",
   body:"Amazon Order Confirmation\nOrder #113-4521\n\nKindle Paperwhite Case\nList Price: $19.99\nYou Pay: $12.99\nYou saved: $7.00 (35% off)\n\nOrder Total: $12.99\nYou saved $7.00 on this order"},
  {id:"m2",subject:"Your Publix Digital Receipt — Bradfordville",from:"noreply@publix.com",
   body:"Publix Bradfordville Center\nTallahassee, FL\n\nPdg 1 @ 2 for $4.99 — You saved $2.49\nEstr Tie Dye Pdg 1 @ 2 for $4.99 — You saved $2.50\nOrganic Basil 20z 3.69\nSubtotal: 30.43\nSAVINGS: $4.99"},
  {id:"m3",subject:"Instacart — Your Whole Foods delivery",from:"receipts@instacart.com",
   body:"Instacart Receipt — Whole Foods Market\n\nOrganic Strawberries (Sale) $3.99 reg $5.99 — saved $2.00\nAlmond Butter BOGO — saved $9.99\nGranola Bars (Sale) $4.49 reg $6.99 — saved $2.50\nTotal: $42.18\nYou saved $14.49"},
];

// ── Helpers ───────────────────────────────────────────────────────
async function detectStateFromCoords(lat,lon) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    const d = await r.json();
    return d?.address?.["ISO3166-2-lvl4"]?.replace("US-","") || null;
  } catch { return null; }
}
function isReturn(desc,amt) {
  const d=desc.toLowerCase();
  return amt>0 && (RETURN_KEYWORDS.some(k=>d.includes(k))||KNOWN_RETAILERS.some(r=>d.includes(r)));
}
function parseCSV(text) {
  const lines=text.trim().split("\n").filter(Boolean);
  if(lines.length<2) return [];
  const h=lines[0].toLowerCase().split(",").map(x=>x.trim().replace(/"/g,""));
  const di=h.findIndex(x=>x.includes("date"));
  const xi=h.findIndex(x=>x.includes("desc")||x.includes("memo")||x.includes("name"));
  const ai=h.findIndex(x=>x.includes("amount")||x.includes("credit"));
  if(xi===-1||ai===-1) return [];
  return lines.slice(1).map(l=>{
    const c=l.split(",").map(x=>x.trim().replace(/"/g,""));
    return {date:c[di]||"",description:c[xi]||"",amount:parseFloat(c[ai]?.replace(/[$,]/g,"")||"0")};
  }).filter(t=>t.description);
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
    saleTax: 0, // calculated in modal using state rate
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
  {icon:"📸",title:<>Three ways to <span>log savings</span></>,desc:"Scan paper receipts, paste digital receipts, or enter savings manually.",features:[{icon:"📸",t:"Scan Receipts",s:"Powered by Mindee OCR"},{icon:"✨",t:"Receipt Parsing",s:"Built-in parser, any format"},{icon:"📬",t:"Gmail Auto-Fetch",s:"Pull receipts from your inbox"}]},
  {icon:"🔍",title:<>Automatic <span>return detection</span></>,desc:"Connect your bank via Plaid and Shop, Save, Invest will automatically spot return credits.",features:[{icon:"🏦",t:"Plaid Integration",s:"Securely monitor your cards"},{icon:"📄",t:"CSV Upload",s:"Import bank statements"},{icon:"🔔",t:"Confirm Before Investing",s:"You always approve first"}]},
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
  const [tab,setTab]=useState("login");
  const [f,setF]=useState({name:"",email:"",password:""});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
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

  return (
    <div className="auth-screen">
      <div className="auth-logo">Shop, Save, <span>Invest</span></div>
      <div className="auth-tagline">Shop smarter. Save automatically. Invest the difference.</div>
      <div className="auth-card">
        <div className="auth-tabs">
          <div className={`auth-tab${tab==="login"?" active":""}`} onClick={()=>{setTab("login");setError(null);}}>Sign In</div>
          <div className={`auth-tab${tab==="signup"?" active":""}`} onClick={()=>{setTab("signup");setError(null);}}>Create Account</div>
        </div>
        {tab==="signup"&&<div className="auth-field"><label>Full Name</label><input placeholder="Jane Smith" value={f.name} onChange={e=>set("name",e.target.value)}/></div>}
        <div className="auth-field"><label>Email</label><input type="email" placeholder="you@email.com" value={f.email} onChange={e=>set("email",e.target.value)}/></div>
        <div className="auth-field"><label>Password</label><input type="password" placeholder="••••••••" value={f.password} onChange={e=>set("password",e.target.value)}/></div>
        {error&&<div style={{background:"#fce4ec",border:"1px solid #f48fb1",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#880e4f",marginBottom:12}}>{error}</div>}
        <button className="auth-btn" onClick={submit} disabled={loading}>
          {loading?<><span className="spinner" style={{borderColor:"rgba(26,26,46,0.2)",borderTopColor:"#1a1a2e",width:16,height:16}}/>Processing…</>:tab==="login"?"Sign In →":"Create Account →"}
        </button>
        <div className="auth-hint">{tab==="login"?<>No account? <span onClick={()=>{setTab("signup");setError(null);}}>Sign up free</span></>:<>Already have one? <span onClick={()=>{setTab("login");setError(null);}}>Sign in</span></>}</div>
        <div style={{marginTop:16,textAlign:"center"}}><button style={{background:"none",border:"1px solid #e8e4dc",borderRadius:10,padding:"10px 20px",fontSize:13,color:"#888",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}} onClick={()=>onLogin({name:"Demo User",email:"demo@shopsaveinvest.app"}, false)}>👀 Try Demo</button></div>
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
  const [f,setF]=useState({store:"",shopping:"",taxPaid:"",totalPurchase:""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const shopping=parseFloat(f.shopping)||0;
  const taxPaid=parseFloat(f.taxPaid)||0;
  const totalPurchase=parseFloat(f.totalPurchase)||0;

  const fullTax=parseFloat((totalPurchase*taxRate).toFixed(2));
  const saleTaxSavings=totalPurchase>0&&taxPaid>=0 ? parseFloat(Math.max(0,fullTax-taxPaid).toFixed(2)) : 0;
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
          <input type="number" placeholder="$0.00" step="0.01" value={f.shopping} onChange={e=>set("shopping",e.target.value)}/>
          <div style={{fontSize:11,color:"#aaa",marginTop:4}}>From "You saved $X" at the bottom of your receipt</div>
        </div>

        <div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:12,padding:"12px 14px",marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:"#e65100",letterSpacing:1,marginBottom:10}}>
            🧾 SALE TAX SAVINGS {stateCode?`· ${(taxRate*100).toFixed(2)}% (${stateCode})`:""}
          </div>
          <div className="field" style={{marginBottom:10}}>
            <label>Total Purchase Amount ($)</label>
            <input type="number" placeholder="$0.00" step="0.01" value={f.totalPurchase} onChange={e=>set("totalPurchase",e.target.value)}/>
            <div style={{fontSize:11,color:"#aaa",marginTop:4}}>Subtotal before tax on your receipt</div>
          </div>
          <div className="field" style={{marginBottom:0}}>
            <label>Sale Tax Paid ($)</label>
            <input type="number" placeholder="$0.00" step="0.01" value={f.taxPaid} onChange={e=>set("taxPaid",e.target.value)}/>
            <div style={{fontSize:11,color:"#aaa",marginTop:4}}>Sales tax line on your receipt</div>
          </div>
          {totalPurchase>0&&taxPaid>=0&&(
            <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #ffe082",fontSize:12,color:"#5d4037"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span>Full tax at {(taxRate*100).toFixed(2)}%</span><span>${fullTax.toFixed(2)}</span>
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
          onSave({store:f.store,item:`${f.store} Savings`,type:"sale",saved:net,shoppingSavings:shopping,saleTax:saleTaxSavings});
          onClose();
        }}>Save ${net>0?net.toFixed(2):"0.00"} →</button>
      </div>
    </div>
  );
}

function ScanModal({onClose,onSave}) {
  const [st,setSt]=useState("idle");const [res,setRes]=useState(null);const [mode,setMode]=useState("camera");
  const imgRef=useRef();const upRef=useRef();
  const process=async file=>{
    if(!file) return; setSt("processing");
    await new Promise(r=>setTimeout(r,2200));
    // Mock Mindee result — in production Mindee returns itemized data
    setRes({store:"Kroger",shoppingSavings:6.69,totalPurchase:42.30,taxPaid:1.85,saleTax:1.11,netSavings:7.80,type:"sale"});
    setSt("done");
  };
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-handle"/><div className="modal-title">Scan Receipt</div>
        {st==="idle"&&<>
          <div className="type-sel">
            <div className={`type-opt${mode==="camera"?" active":""}`} onClick={()=>setMode("camera")}>📷 Camera</div>
            <div className={`type-opt${mode==="upload"?" active":""}`} onClick={()=>setMode("upload")}>🖼️ Upload</div>
          </div><div className="upload-zone" onClick={()=>(mode==="camera"?imgRef:upRef).current.click()}>
            <div style={{fontSize:36,marginBottom:8}}>{mode==="camera"?"📸":"🖼️"}</div>
            <div style={{fontSize:14,color:"#555",fontWeight:500}}>{mode==="camera"?"Tap to open camera":"Tap to choose image"}</div>
            <div style={{fontSize:12,color:"#bbb",marginTop:4}}>Powered by Mindee OCR</div>
          </div>
          <input ref={imgRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>process(e.target.files[0])}/>
          <input ref={upRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>process(e.target.files[0])}/>
        </>}
        {st==="processing"&&<div style={{textAlign:"center",padding:"32px 0"}}><div className="spinner" style={{margin:"0 auto 16px",width:32,height:32,borderWidth:3}}/><div style={{fontSize:14,color:"#888"}}>Scanning with Mindee OCR…</div></div>}
        {st==="done"&&res&&<>
          <SavingsSummary store={res.store} shoppingSavings={res.shoppingSavings} saleTax={res.saleTax} netSavings={res.netSavings}/>
          {res.totalPurchase>0&&<div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#5d4037"}}>
            <div style={{fontWeight:700,color:"#e65100",marginBottom:6}}>🧾 Tax Breakdown</div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span>Subtotal</span><span>${res.totalPurchase.toFixed(2)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span>Tax paid</span><span>${res.taxPaid.toFixed(2)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,color:"#e65100"}}><span>Tax savings (exempt items)</span><span>+${res.saleTax.toFixed(2)}</span></div>
          </div>}
          <button className="sub-btn" onClick={()=>{onSave({store:res.store,item:`${res.store} Savings`,type:res.type,saved:res.netSavings,shoppingSavings:res.shoppingSavings,saleTax:res.saleTax});onClose();}}>
            Save ${res.netSavings.toFixed(2)} →
          </button>
        </>}
      </div>
    </div>
  );
}

function GmailPanel({onLoad}) {
  const [st,setSt]=useState("idle");const [emails,setEmails]=useState([]);const [sel,setSel]=useState(null);
  const connect=()=>{ setSt("loading"); setTimeout(()=>{setEmails(MOCK_GMAIL);setSt("done");},1600); };
  if(st==="idle") return <button onClick={connect} style={{width:"100%",background:"#fff",border:"1.5px solid #e8e4dc",borderRadius:12,padding:"13px",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,color:"#444"}}>📬 Demo: Browse Gmail Receipts</button>;
  if(st==="loading") return <div style={{display:"flex",alignItems:"center",gap:10,padding:"13px",background:"#f5f2ec",borderRadius:12,fontSize:13,color:"#888"}}><div className="spinner"/>Scanning inbox for receipts…</div>;
  return <div>{emails.map(e=><div key={e.id} onClick={()=>{setSel(e.id);onLoad(e.body);}} style={{background:sel===e.id?"#e8f5e9":"#fff",border:`1.5px solid ${sel===e.id?"#81c784":"#f0ece4"}`,borderRadius:12,padding:"12px 14px",marginBottom:8,cursor:"pointer"}}><div style={{fontSize:13,fontWeight:600,color:"#1a1a2e",marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.subject}</div><div style={{fontSize:11,color:"#aaa"}}>{e.from}</div>{sel===e.id&&<div style={{fontSize:11,color:"#2e7d32",marginTop:4,fontWeight:600}}>✓ Loaded — tap Parse below</div>}</div>)}</div>;
}

function EmailModal({onClose,onSave}) {
  const [st,setSt]=useState("idle");
  const [txt,setTxt]=useState("");
  const [res,setRes]=useState(null);
  const [err,setErr]=useState(null);
  const [tab,setTab]=useState("paste");

  const go=()=>{
    if(!txt.trim()) return;
    setSt("processing"); setErr(null);
    setTimeout(()=>{
      const parsed=parseReceipt(txt);
      if(parsed.shoppingSavings===0&&parsed.taxPaid===0&&parsed.totalPurchase===0){
        setErr("No savings found. Check the receipt has 'You saved' or 'SAVINGS' printed on it, or try manual entry.");
        setSt("idle"); return;
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
          <div className="type-sel">
            <div className={`type-opt${tab==="paste"?" active":""}`} onClick={()=>setTab("paste")}>✏️ Paste Text</div>
            <div className={`type-opt${tab==="gmail"?" active":""}`} onClick={()=>setTab("gmail")}>📬 Gmail</div>
          </div>

          {tab==="gmail"&&<GmailPanel onLoad={body=>{setTxt(body);setTab("paste");}}/>}

          {tab==="paste"&&<>
            <div style={{background:"#e8f5e9",border:"1px solid #c8e6c9",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#2e7d32",marginBottom:14,display:"flex",gap:8}}>
              <span style={{flexShrink:0}}>🔍</span>
              <span><strong>Built-in parser</strong> reads any receipt — Publix, Amazon, Instacart, Target, and more.</span>
            </div>
            <div className="field">
              <label>Receipt Text</label>
              <textarea rows={8} placeholder="Paste your receipt text here…" value={txt} onChange={e=>setTxt(e.target.value)} style={{fontFamily:"monospace",fontSize:12,lineHeight:1.5}}/>
            </div>
          </>}

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
  const amt=parseFloat(f.amt)||0;
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-handle"/><div className="modal-title">Item Return Savings</div>
        <div className="ret-bar">🔄 Returned money — invest it instead!</div>
        <div className="field" style={{marginTop:14}}><label>Store</label><input placeholder="e.g. Amazon, Target" value={f.store} onChange={e=>set("store",e.target.value)}/></div>
        <div className="field"><label>Item Returned</label><input placeholder="e.g. Bluetooth Speaker" value={f.item} onChange={e=>set("item",e.target.value)}/></div>
        <div className="field"><label>Refund Amount ($)</label><input type="number" placeholder="$0.00" step="0.01" value={f.amt} onChange={e=>set("amt",e.target.value)}/></div>
        {amt>0&&<ReturnSummary store={f.store} item={f.item} amount={amt}/>}
        <button className="sub-btn" disabled={!f.store||!f.item||amt<=0} onClick={()=>{onSave({store:f.store,item:`${f.item} (Return)`,type:"return",saved:amt});onClose();}}>Invest ${amt>0?amt.toFixed(2):"0.00"} →</button>
      </div>
    </div>
  );
}

// ── Return Scan Modal ─────────────────────────────────────────────
function ReturnScanModal({onClose,onSave}) {
  const [st,setSt]=useState("idle");const [res,setRes]=useState(null);const [mode,setMode]=useState("camera");
  const imgRef=useRef();const upRef=useRef();
  const process=async file=>{
    if(!file) return; setSt("processing");
    await new Promise(r=>setTimeout(r,2200));
    setRes({store:"Amazon",item:"Wireless Headphones",amount:49.99});
    setSt("done");
  };
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-handle"/><div className="modal-title">Scan Return Receipt</div>
        {st==="idle"&&<>
          <div className="type-sel">
            <div className={`type-opt${mode==="camera"?" active":""}`} onClick={()=>setMode("camera")}>📷 Camera</div>
            <div className={`type-opt${mode==="upload"?" active":""}`} onClick={()=>setMode("upload")}>🖼️ Upload</div>
          </div>
          <div className="upload-zone" onClick={()=>(mode==="camera"?imgRef:upRef).current.click()}>
            <div style={{fontSize:36,marginBottom:8}}>{mode==="camera"?"📸":"🖼️"}</div>
            <div style={{fontSize:14,color:"#555",fontWeight:500}}>{mode==="camera"?"Tap to scan return receipt":"Tap to upload receipt image"}</div>
            <div style={{fontSize:12,color:"#bbb",marginTop:4}}>Powered by Mindee OCR</div>
          </div>
          <input ref={imgRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>process(e.target.files[0])}/>
          <input ref={upRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>process(e.target.files[0])}/>
        </>}
        {st==="processing"&&<div style={{textAlign:"center",padding:"32px 0"}}><div className="spinner" style={{margin:"0 auto 16px",width:32,height:32,borderWidth:3}}/><div style={{fontSize:14,color:"#888"}}>Scanning return receipt…</div></div>}
        {st==="done"&&res&&<>
          <ReturnSummary store={res.store} item={res.item} amount={res.amount}/>
          <button className="sub-btn" onClick={()=>{onSave({store:res.store,item:`${res.item} (Return)`,type:"return",saved:res.amount});onClose();}}>
            Invest ${res.amount.toFixed(2)} →
          </button>
        </>}
      </div>
    </div>
  );
}

// ── Return Digital Modal ──────────────────────────────────────────
function ReturnEmailModal({onClose,onSave}) {
  const [st,setSt]=useState("idle");
  const [txt,setTxt]=useState("");
  const [res,setRes]=useState(null);
  const [err,setErr]=useState(null);
  const [tab,setTab]=useState("paste");

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
          <div className="type-sel">
            <div className={`type-opt${tab==="paste"?" active":""}`} onClick={()=>setTab("paste")}>✏️ Paste Text</div>
            <div className={`type-opt${tab==="gmail"?" active":""}`} onClick={()=>setTab("gmail")}>📬 Gmail</div>
          </div>
          {tab==="gmail"&&<GmailPanel onLoad={body=>{setTxt(body);setTab("paste");}}/>}
          {tab==="paste"&&<>
            <div style={{background:"#fce4ec",border:"1px solid #f48fb1",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#880e4f",marginBottom:14,display:"flex",gap:8}}>
              <span style={{flexShrink:0}}>🔍</span>
              <span><strong>Built-in parser</strong> reads return confirmations from Amazon, Target, Walmart and more.</span>
            </div>
            <div className="field">
              <label>Return Confirmation Text</label>
              <textarea rows={7} placeholder="Paste your return confirmation or refund email here…" value={txt} onChange={e=>setTxt(e.target.value)} style={{fontFamily:"monospace",fontSize:12,lineHeight:1.5}}/>
            </div>
          </>}
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

function ConfirmInvestModal({item,onConfirm,onCancel}) {
  const [investing,setInvesting]=useState(false);const [done,setDone]=useState(false);
  const match=KNOWN_RETAILERS.find(r=>item.description.toLowerCase().includes(r));
  const store=match?match.charAt(0).toUpperCase()+match.slice(1):"Bank Card";
  const confirm=()=>{ setInvesting(true); setTimeout(()=>{ setDone(true); setTimeout(()=>onConfirm({store,item:`${item.description} (Auto-Detected)`,type:"return",saved:item.amount}),900); },1400); };
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&!investing&&onCancel()}>
      <div className="modal">
        <div className="modal-handle"/><div className="modal-title">Confirm Investment</div>
        <div style={{background:"#fce4ec",border:"1px solid #f48fb1",borderRadius:14,padding:"16px",marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:700,color:"#ad1457",letterSpacing:1,marginBottom:10}}>🔄 RETURN DETECTED</div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#333",marginBottom:6}}><span>Transaction</span><span style={{fontWeight:600,maxWidth:180,textAlign:"right",fontSize:12}}>{item.description}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#333",marginBottom:6}}><span>Date</span><span>{item.date}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#333",marginBottom:6}}><span>Source</span><span style={{background:"#fff",borderRadius:8,padding:"2px 8px",fontSize:11,fontWeight:600,color:"#ad1457"}}>{item.source==="plaid"?"via Plaid":"via CSV"}</span></div>
          <div style={{borderTop:"1px solid #f48fb1",marginTop:10,paddingTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13,color:"#880e4f",fontWeight:600}}>Refund Amount</span><span style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#ad1457"}}>${item.amount.toFixed(2)}</span></div>
        </div>
        <div style={{background:"#f7f5f0",borderRadius:12,padding:"12px 14px",marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,background:"#1a1a2e",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>📈</div>
          <div><div style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>Invest into your portfolio</div><div style={{fontSize:11,color:"#aaa",marginTop:2}}>70% VOO · 30% IEMG · via Alpaca</div></div>
        </div>
        {!done?<>
          <button className="sub-btn" onClick={confirm} disabled={investing} style={{background:"#ad1457",marginBottom:10}}>
            {investing?<><span className="spinner" style={{borderColor:"rgba(255,255,255,0.3)",borderTopColor:"#fff"}}/>Investing…</>:`✓ Confirm — Invest $${item.amount.toFixed(2)}`}
          </button>
          <button onClick={onCancel} disabled={investing} style={{width:"100%",background:"none",border:"1.5px solid #e8e4dc",borderRadius:14,padding:"14px",fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"#888",cursor:"pointer"}}>Not now — skip</button>
        </>:<div style={{textAlign:"center",padding:"16px 0"}}><div style={{fontSize:40,marginBottom:8}}>🚀</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:600,color:"#1a1a2e",marginBottom:4}}>${item.amount.toFixed(2)} invested!</div><div style={{fontSize:13,color:"#aaa"}}>Added to your portfolio</div></div>}
      </div>
    </div>
  );
}

function AutoDetectPanel({onAccept}) {
  const [open,setOpen]=useState(true);const [plaid,setPlaid]=useState("idle");
  const [pending,setPending]=useState([]);const [dismissed,setDismissed]=useState([]);
  const [confirming,setConfirming]=useState(null);
  const csvRef=useRef();
  const visible=pending.filter(p=>!dismissed.includes(p.id));
  const connectPlaid=()=>{ setPlaid("connecting"); setTimeout(()=>{ const found=MOCK_PLAID.filter(t=>isReturn(t.description,t.amount)).map(t=>({...t,source:"plaid"})); setPending(p=>{const ids=new Set(p.map(x=>x.id));return [...p,...found.filter(f=>!ids.has(f.id))];});setPlaid("connected");},1800); };
  const handleCSV=file=>{ if(!file) return; const r=new FileReader(); r.onload=e=>{ const found=parseCSV(e.target.result).filter(t=>isReturn(t.description,t.amount)).map((t,i)=>({...t,id:`csv_${i}_${Date.now()}`,source:"csv"})); setPending(p=>[...p,...found]); }; r.readAsText(file); };
  const handleConfirmed=entry=>{ onAccept(entry); setDismissed(d=>[...d,confirming.id]); setConfirming(null); };
  return (
    <>
      <div className="detect-panel">
        <div className="detect-hdr" onClick={()=>setOpen(o=>!o)}>
          <div className="detect-hdr-left"><span style={{fontSize:20}}>🔍</span><div><div className="detect-title">Auto-Detect Returns</div><div className="detect-sub">{plaid==="connected"?"Bank & cards connected":"Connect bank/card or upload CSV"}</div></div></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>{visible.length>0&&<span className="detect-badge">{visible.length}</span>}<span style={{color:"#ccc",fontSize:12}}>{open?"▲":"▼"}</span></div>
        </div>
        {open&&<div className="detect-body">
          <button className={`plaid-btn${plaid==="connected"?" conn":""}`} onClick={plaid==="idle"?connectPlaid:undefined} disabled={plaid==="connecting"}>
            {plaid==="idle"&&<><span>🏦</span>Connect Bank &amp; Cards via Plaid</>}
            {plaid==="connecting"&&<><span className="spinner" style={{width:14,height:14,borderColor:"rgba(255,255,255,0.3)",borderTopColor:"#fff"}}/>Connecting…</>}
            {plaid==="connected"&&<><span>✓</span>Bank &amp; Cards Connected</>}
          </button>
          <div className="csv-zone" onClick={()=>csvRef.current.click()}><span>📄</span>Upload bank / card statement CSV</div>
          <input ref={csvRef} type="file" accept=".csv" style={{display:"none"}} onChange={e=>handleCSV(e.target.files[0])}/>
          {visible.length>0&&<><div className="pending-lbl">🔔 RETURNS DETECTED — TAP TO REVIEW</div>{visible.map(item=><div className="pend-row" key={item.id}><div className="pend-dot"/><div className="pend-info"><div className="pend-desc">{item.description}</div><div className="pend-date">{item.date}</div><div className="src-tag">{item.source==="plaid"?"via Plaid":"via CSV"}</div></div><div className="pend-right"><div className="pend-amt">+${item.amount.toFixed(2)}</div><div className="pend-acts"><button className="pa-yes" onClick={()=>setConfirming(item)}>Review</button><button className="pa-no" onClick={()=>setDismissed(d=>[...d,item.id])}>Skip</button></div></div></div>)}</>}
          {plaid==="connected"&&visible.length===0&&<div style={{marginTop:12,fontSize:12,color:"#aaa",textAlign:"center"}}>✓ No new returns detected</div>}
        </div>}
      </div>
      {confirming&&<ConfirmInvestModal item={confirming} onConfirm={handleConfirmed} onCancel={()=>{ setDismissed(d=>[...d,confirming.id]);setConfirming(null); }}/>}
    </>
  );
}

// ── Portfolio Screen ──────────────────────────────────────────────
function PortfolioScreen({savings,invested}) {
  const byType=[
    {name:"Shopping Savings", value:savings.filter(s=>s.type==="sale"||s.type==="bogo"||s.type==="manual").reduce((a,s)=>a+s.saved,0), color:"#4caf50"},
    {name:"Sale Tax",         value:savings.filter(s=>s.type==="taxexempt").reduce((a,s)=>a+s.saved,0),                                 color:"#ff9800"},
    {name:"Returns",          value:savings.filter(s=>s.type==="return").reduce((a,s)=>a+s.saved,0),                                    color:"#e91e63"},
  ].filter(x=>x.value>0);
  const totalSaved=savings.reduce((a,s)=>a+s.saved,0);
  return (
    <div style={{paddingBottom:90}}>
      <div className="port-header"><div className="port-title">Portfolio</div><div className="port-sub">Investment growth over time</div><div className="port-big">${invested.toFixed(2)}</div><div className="port-change">↑ +$126.83 (27.1%) all time</div></div>
      <div className="chart-card"><div className="chart-title">Portfolio Value ($)</div><ResponsiveContainer width="100%" height={160}><LineChart data={PORTFOLIO_HISTORY}><XAxis dataKey="month" tick={{fontSize:11,fill:"#aaa"}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={{borderRadius:10,border:"none",fontSize:12}} formatter={v=>[`$${v.toFixed(2)}`,"Value"]}/><Line type="monotone" dataKey="value" stroke="#d4af37" strokeWidth={2.5} dot={false}/></LineChart></ResponsiveContainer></div>
      <div className="chart-card"><div className="chart-title">Monthly Savings by Category ($)</div><ResponsiveContainer width="100%" height={160}><BarChart data={MONTHLY_SAVINGS} barSize={8}><XAxis dataKey="month" tick={{fontSize:11,fill:"#aaa"}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={{borderRadius:10,border:"none",fontSize:12}}/><Bar dataKey="shopping" stackId="a" fill="#4caf50" name="Shopping Savings"/><Bar dataKey="saleTax" stackId="a" fill="#ff9800" name="Sale Tax"/><Bar dataKey="returns" stackId="a" fill="#e91e63" radius={[4,4,0,0]} name="Returns"/></BarChart></ResponsiveContainer></div>
      <div className="chart-card"><div className="chart-title">Savings Breakdown</div><div className="pie-row"><PieChart width={120} height={120}><Pie data={byType} cx={55} cy={55} innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>{byType.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie></PieChart><div className="pie-legend">{byType.map((e,i)=><div key={i} className="pie-item"><div className="pie-dot" style={{background:e.color}}/><span>{e.name}: <strong>${e.value.toFixed(2)}</strong></span></div>)}</div></div></div>
      <div className="stat-grid"><div className="stat-card"><div className="stat-label">Total Saved</div><div className="stat-value">${totalSaved.toFixed(2)}</div><div className="stat-sub">All time</div></div><div className="stat-card"><div className="stat-label">Avg / Month</div><div className="stat-value">${(totalSaved/7).toFixed(2)}</div><div className="stat-sub">Last 7 months</div></div><div className="stat-card"><div className="stat-label">Best Month</div><div className="stat-value">Apr</div><div className="stat-sub">$117.24 saved</div></div><div className="stat-card"><div className="stat-label">Streak</div><div className="stat-value">7 mo</div><div className="stat-sub">Consecutive saves</div></div></div>
    </div>
  );
}

function InvestScreen({invested,riskId}) {
  const totalVal=MOCK_HOLDINGS.reduce((a,h)=>a+(h.shares?h.shares*h.price:h.price),0);
  const gain=totalVal-22.50;
  const profile=RISK_PROFILES.find(p=>p.id===riskId)||RISK_PROFILES[2];
  return (
    <div style={{paddingBottom:90}}>
      <div className="inv-header"><div className="inv-title">Investment Account</div><div className="inv-sub">Powered by Alpaca · Paper Trading</div><div className="inv-total">${totalVal.toFixed(2)}</div><div className="inv-gain" style={{color:"#81c784"}}>↑ +${gain.toFixed(2)} ({((gain/22.50)*100).toFixed(1)}%) all time</div></div>
      <div className="inv-action"><button className="inv-act-btn primary">🚀 Invest Savings</button><button className="inv-act-btn secondary">📊 View History</button></div>
      <div className="section" style={{paddingBottom:0}}>
        <div className="section-header"><div className="section-title">Holdings</div></div>
        {MOCK_HOLDINGS.map((h,i)=>{ const val=h.shares?h.shares*h.price:h.price; const pct=(val/totalVal*100).toFixed(0); return <div key={i} className="holding-card"><div className="holding-ticker">{h.ticker}</div><div className="holding-info"><div className="holding-name">{h.name}</div><div className="holding-shares">{h.shares?`${h.shares} shares @ $${h.price}`:"Cash balance"}</div><div className="alloc-bar"><div className="alloc-fill" style={{width:`${pct}%`}}/></div></div><div className="holding-right"><div className="holding-value">${val.toFixed(2)}</div><div style={{fontSize:11,color:h.change>0?"#4caf50":h.change<0?"#f44336":"#aaa",marginTop:2}}>{h.change>0?"+":""}{h.change!==0?`${h.change}%`:"—"}</div></div></div>; })}
      </div>
      <div className="section" style={{paddingTop:16}}>
        <div className="section-header"><div className="section-title">Investment Strategy</div></div>
        <div style={{background:profile.bg,border:`1.5px solid ${profile.color}33`,borderRadius:14,padding:"16px",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <span style={{fontSize:22}}>{profile.emoji}</span>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:profile.color}}>{profile.label} Risk Profile</div>
              <div style={{fontSize:12,color:"#666",marginTop:2}}>{profile.tag}</div>
            </div>
          </div>
          <div style={{fontSize:13,color:"#555",marginBottom:12}}>{profile.desc}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {profile.allocations.map((a,i)=>(
              <div key={i} style={{flex:1,minWidth:60,background:"#fff",borderRadius:10,padding:"10px 8px",textAlign:"center",border:`1px solid ${a.color}33`}}>
                <div style={{fontSize:11,color:"#aaa",marginBottom:3}}>{a.name.split(" ")[0]}</div>
                <div style={{fontSize:13,fontWeight:700,color:a.color}}>{a.ticker}</div>
                <div style={{fontSize:16,fontWeight:700,color:"#1a1a2e",marginTop:2}}>{a.pct}%</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{fontSize:11,color:"#aaa",textAlign:"center",marginTop:6}}>Change your risk profile in Settings</div>
      </div>
    </div>
  );
}

function SettingsScreen({user,onLogout,riskId,onSetRisk}) {
  const [notifs,setNotifs]=useState(true);const [autoDetect,setAutoDetect]=useState(true);const [dark,setDark]=useState(false);
  const [showRisk,setShowRisk]=useState(false);
  const profile=RISK_PROFILES.find(p=>p.id===riskId)||RISK_PROFILES[2];
  const Toggle=({on,toggle})=><div className={`toggle ${on?"on":"off"}`} onClick={toggle}><div className="toggle-knob"/></div>;
  return (
    <div style={{paddingBottom:90}}>
      <div className="set-header"><div className="set-title">Settings</div></div>
      <div className="set-avatar-row"><div className="set-avatar">{user.name.charAt(0).toUpperCase()}</div><div><div className="set-name">{user.name}</div><div className="set-email">{user.email}</div></div></div>

      <div className="set-section"><div className="set-section-title">Account</div>
        {[{icon:"🏦",bg:"#e3f2fd",label:"Linked Banks",sub:"1 account connected"},{icon:"💳",bg:"#e8f5e9",label:"Payment Methods",sub:"Visa ending 4242"},{icon:"📍",bg:"#fff8e1",label:"State / Tax Rate",sub:"Auto-detected · 7.00%"}].map((it,i)=><div key={i} className="set-item"><div className="set-item-left"><div className="set-item-icon" style={{background:it.bg}}>{it.icon}</div><div><div className="set-item-label">{it.label}</div><div className="set-item-sub">{it.sub}</div></div></div><span style={{color:"#ccc"}}>›</span></div>)}
      </div>

      {/* Risk Profile Section */}
      <div className="set-section">
        <div className="set-section-title">Investment Strategy</div>
        <div className="set-item" onClick={()=>setShowRisk(v=>!v)} style={{flexDirection:"column",alignItems:"stretch"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div className="set-item-left">
              <div className="set-item-icon" style={{background:profile.bg,fontSize:18}}>{profile.emoji}</div>
              <div>
                <div className="set-item-label">{profile.label} Risk</div>
                <div className="set-item-sub">{profile.tag}</div>
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
      </div>

      <div className="set-section"><div className="set-section-title">Preferences</div>
        <div className="set-item"><div className="set-item-left"><div className="set-item-icon" style={{background:"#f3e5f5"}}>🔔</div><div><div className="set-item-label">Return Notifications</div><div className="set-item-sub">Alert when return detected</div></div></div><Toggle on={notifs} toggle={()=>setNotifs(v=>!v)}/></div>
        <div className="set-item"><div className="set-item-left"><div className="set-item-icon" style={{background:"#fce4ec"}}>🔍</div><div><div className="set-item-label">Auto-Detect Returns</div><div className="set-item-sub">Monitor bank transactions</div></div></div><Toggle on={autoDetect} toggle={()=>setAutoDetect(v=>!v)}/></div>
        <div className="set-item"><div className="set-item-left"><div className="set-item-icon" style={{background:"#f5f2ec"}}>🌙</div><div><div className="set-item-label">Dark Mode</div><div className="set-item-sub">Coming soon</div></div></div><Toggle on={dark} toggle={()=>setDark(v=>!v)}/></div>
      </div>
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
  const handleAddSaving=async entry=>{
    await addSaving(entry);
    showToast(`✓ $${entry.saved.toFixed(2)} saved from ${entry.store}!`);
  };
  const uninvested=savings.filter(s=>!s.invested).reduce((a,s)=>a+s.saved,0);
  const handleInvest=()=>{ if(uninvested<=0) return; setInvesting(true); setTimeout(async()=>{await handleInvestAll(uninvested);setInvesting(false);showToast(`🚀 $${uninvested.toFixed(2)} invested!`);},1800); };
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
              <button className="drop-item" onClick={()=>{setModal("scan");setOpenDrop(null);}}><span className="drop-item-icon">📸</span><div><div className="drop-item-label">Scan Receipt</div><div className="drop-item-sub">Photo → Mindee OCR</div></div></button>
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
              <button className="drop-item" onClick={()=>{setModal("returnScan");setOpenDrop(null);}}><span className="drop-item-icon">📸</span><div><div className="drop-item-label">Scan Return Receipt</div><div className="drop-item-sub">Photo → Mindee OCR</div></div></button>
              <button className="drop-item" onClick={()=>{setModal("returnEmail");setOpenDrop(null);}}><span className="drop-item-icon">✨</span><div><div className="drop-item-label">Digital Return Receipt</div><div className="drop-item-sub">Paste confirmation or fetch from Gmail</div></div></button>
              <button className="drop-item" onClick={()=>{setModal("return");setOpenDrop(null);}}><span className="drop-item-icon">✏️</span><div><div className="drop-item-label">Manual Entry</div><div className="drop-item-sub">Enter store, item & refund amount</div></div></button>
              <div style={{paddingTop:4}}><AutoDetectPanel onAccept={addSaving}/></div>
            </div>}
          </div>
        </div>
        <div className="section" style={{paddingTop:16}}>
          <div className="section-header"><div className="section-title">Savings History</div><span className="see-all">${savings.reduce((a,s)=>a+s.saved,0).toFixed(2)} total</span></div>
          {savings.length===0&&<div className="empty">No savings yet!</div>}
          {savings.map(item=>{ const tc=TYPE_COLORS[item.type]||TYPE_COLORS.manual; return <div className="savings-item" key={item.id}><div className="savings-icon-wrap">{storeIcon(item.store)}</div><div className="savings-info"><div className="savings-store">{item.store}</div><div className="savings-name">{item.item}</div></div><div className="savings-right"><div className="savings-amount">+${item.saved.toFixed(2)}</div><div><span className="badge" style={{background:tc.bg,color:tc.text}}>{tc.label}</span></div>{item.invested?<div className="invested-tag">✓ Invested</div>:<div style={{fontSize:10,color:"#bbb",marginTop:3}}>{fmt(item.date)}</div>}</div></div>; })}
        </div>
      </div>
      {modal==="manual"&&<ManualModal onClose={()=>setModal(null)} onSave={handleAddSaving} taxRate={taxRate} stateCode={stateCode}/>}
      {modal==="scan"&&<ScanModal onClose={()=>setModal(null)} onSave={handleAddSaving}/>}
      {modal==="email"&&<EmailModal onClose={()=>setModal(null)} onSave={handleAddSaving}/>}
      {modal==="tax"&&<TaxModal onClose={()=>setModal(null)} onSave={handleAddSaving} taxRate={taxRate} stateCode={stateCode}/>}
      {modal==="return"&&<ReturnModal onClose={()=>setModal(null)} onSave={handleAddSaving}/>}
      {modal==="returnScan"&&<ReturnScanModal onClose={()=>setModal(null)} onSave={handleAddSaving}/>}
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
  const [taxRate,setTaxRate]=useState(0.07);
  const [stateCode,setStateCode]=useState(null);
  const [riskId,setRiskId]=useState("medium");
  const [loadingData,setLoadingData]=useState(false);

  // Load user savings from Supabase
  const loadUserData=async(userId)=>{
    setLoadingData(true);
    try {
      const {data,error}=await supabase
        .from("savings")
        .select("*")
        .eq("user_id",userId)
        .order("created_at",{ascending:false});
      if(!error&&data) {
        setSavings(data.map(s=>({
          id:s.id, store:s.store, item:s.item,
          type:s.type, saved:s.saved,
          date:s.date, invested:s.invested
        })));
        const totalInvested=data.filter(s=>s.invested).reduce((a,s)=>a+s.saved,0);
        setInvested(totalInvested);
      }
      // Load risk profile
      const {data:prefs}=await supabase
        .from("user_prefs")
        .select("risk_id")
        .eq("user_id",userId)
        .single();
      if(prefs?.risk_id) setRiskId(prefs.risk_id);
    } catch(e) {
      console.error("Error loading data:",e);
    } finally {
      setLoadingData(false);
    }
  };

  // Save a new saving entry to Supabase
  const addSavingToDb=async(entry,userId)=>{
    const {data,error}=await supabase.from("savings").insert([{
      user_id:userId, store:entry.store, item:entry.item,
      type:entry.type, saved:entry.saved,
      date:new Date().toISOString().split("T")[0], invested:false
    }]).select().single();
    if(!error&&data) return data;
    return null;
  };

  // Mark savings as invested in Supabase
  const markInvestedInDb=async(userId)=>{
    await supabase.from("savings")
      .update({invested:true})
      .eq("user_id",userId)
      .eq("invested",false);
  };

  // Check for existing Supabase session on load
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session?.user){
        const name=session.user.user_metadata?.full_name||session.user.email.split("@")[0];
        const u={name,email:session.user.email,id:session.user.id};
        setUser(u);
        loadUserData(session.user.id);
        setScreen("app"); // returning user — skip onboarding
      }
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(!session){ setUser(null); setSavings([]); setInvested(0); setScreen("login"); setTab("home"); }
    });
    return ()=>subscription.unsubscribe();
  },[]);

  // GPS tax rate detection
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

  // Wrap addSaving to also persist to Supabase
  const addSaving=async(entry)=>{
    if(user?.id){
      const saved=await addSavingToDb(entry,user.id);
      if(saved){
        setSavings(s=>[{...saved},...s]);
        return;
      }
    }
    // Fallback for demo user
    setSavings(s=>[{...entry,id:Date.now(),date:new Date().toISOString().split("T")[0],invested:false},...s]);
  };

  // Wrap invest to also persist to Supabase
  const handleInvestAll=async(uninvested)=>{
    if(user?.id) await markInvestedInDb(user.id);
    setInvested(v=>v+uninvested);
    setSavings(s=>s.map(x=>({...x,invested:true})));
  };

  if(screen==="login") return <><style>{S}</style><div className="app"><LoginScreen onLogin={(u,isNew)=>{setUser(u);loadUserData(u.id);setScreen(isNew?"onboarding":"app");}}/></div></>;
  if(screen==="onboarding") return <><style>{S}</style><div className="app"><OnboardingScreen onDone={()=>setScreen("app")} onSetRisk={setRiskId}/></div></>;

  if(loadingData) return <><style>{S}</style><div className="app" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",flexDirection:"column",gap:16}}><div className="spinner" style={{width:40,height:40,borderWidth:4}}/><div style={{fontSize:14,color:"#888",fontFamily:"'DM Sans',sans-serif"}}>Loading your account…</div></div></>;

  return (
    <>
      <style>{S}</style>
      <div className="app">
        {tab==="home"&&<HomeScreen user={user} savings={savings} setSavings={setSavings} addSaving={addSaving} handleInvestAll={handleInvestAll} invested={invested} setInvested={setInvested} taxRate={taxRate} stateCode={stateCode}/>}
        {tab==="portfolio"&&<PortfolioScreen savings={savings} invested={invested}/>}
        {tab==="invest"&&<InvestScreen invested={invested} riskId={riskId}/>}
        {tab==="settings"&&<SettingsScreen user={user} onLogout={handleLogout} riskId={riskId} onSetRisk={setRiskId}/>}
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
