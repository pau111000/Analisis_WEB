let RAW_ROWS = [];
let CLEAN_ROWS = [];
let FILTERED = [];
let CHARTS = {};
let LAST_FLEET_ANALYSIS = null;

const els = {
  fileInput: document.getElementById("fileInput"),
  btnDemoData: document.getElementById("btnDemoData"),
  filterMode: document.getElementById("filterMode"),
  monthField: document.getElementById("monthField"),
  yearField: document.getElementById("yearField"),
  rangeField: document.getElementById("rangeField"),
  monthInput: document.getElementById("monthInput"),
  yearSelect: document.getElementById("yearSelect"),
  startDate: document.getElementById("startDate"),
  endDate: document.getElementById("endDate"),
  viewMode: document.getElementById("viewMode"),
  rentableThreshold: document.getElementById("rentableThreshold"),
  applyBtn: document.getElementById("applyBtn"),
  kpiGrid: document.getElementById("kpiGrid"),
  insightList: document.getElementById("insightList"),
  periodBadge: document.getElementById("periodBadge"),
  tableBody: document.querySelector("#dataTable tbody"),
  monthlyGoal: document.getElementById("monthlyGoal"),
  goalType: document.getElementById("goalType"),
  recalcGoalBtn: document.getElementById("recalcGoalBtn"),
  goalTitle: document.getElementById("goalTitle"),
  goalSubtitle: document.getElementById("goalSubtitle"),
  goalMain: document.getElementById("goalMain"),
  goalFill: document.getElementById("goalFill"),
  goalMeta: document.getElementById("goalMeta"),

  heatmapGrid: document.getElementById("heatmapGrid"),
  actionList: document.getElementById("actionList"),

  driverRankingPanel: document.getElementById("driverRankingPanel"),
  driverRankingBody: document.getElementById("driverRankingBody"),
  driverExplainList: document.getElementById("driverExplainList"),
  exportFleetBtn: document.getElementById("exportFleetBtn"),

  // selector conductor (vista conductor)
  driverField: document.getElementById("driverField"),
  driverSelect: document.getElementById("driverSelect"),

  // ✅ NUEVO: export por conductor (en flota)
  exportDriverSelect: document.getElementById("exportDriverSelect"),
  exportDriverBtn: document.getElementById("exportDriverBtn"),
  driverExportPanel: document.getElementById("driverExportPanel"),

  // loader + toast
  loaderOverlay: document.getElementById("loaderOverlay"),
  loaderTitle: document.getElementById("loaderTitle"),
  loaderSub: document.getElementById("loaderSub"),
  toastHost: document.getElementById("toastHost"),

  // charts
  chartNetPerHour: document.getElementById("chartNetPerHour"),
  chartNetPerKm: document.getElementById("chartNetPerKm"),
  chartEfficiency: document.getElementById("chartEfficiency"),
  chartMix: document.getElementById("chartMix"),
};

// ---------- Loader + Toast ----------
function showLoader(title="Analizando…", sub="Normalizando datos y calculando KPIs"){
  if(!els.loaderOverlay) return;
  if(els.loaderTitle) els.loaderTitle.textContent = title;
  if(els.loaderSub) els.loaderSub.textContent = sub;
  els.loaderOverlay.classList.remove("hidden");
}
function hideLoader(){
  if(!els.loaderOverlay) return;
  els.loaderOverlay.classList.add("hidden");
}

function toast(type="info", title="Info", msg="", ttl=3400){
  if(!els.toastHost) return;
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `
    <div class="dot"></div>
    <div>
      <div class="t-title">${title}</div>
      <div class="t-msg">${msg}</div>
    </div>
    <button class="close" aria-label="Cerrar">✕</button>
  `;
  els.toastHost.appendChild(t);

  const close = ()=>{
    t.style.opacity = "0";
    t.style.transform = "translateY(6px)";
    setTimeout(()=> t.remove(), 180);
  };

  t.querySelector(".close")?.addEventListener("click", close);
  setTimeout(close, ttl);
}

// ---------- Utils ----------
function pad2(n){ return String(n).padStart(2,"0"); }
function safeDiv(a,b){ return b ? (a/b) : 0; }
function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }

function fmtEUR(x){
  return new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(x || 0);
}
function fmtNum(x, digits=2){
  return new Intl.NumberFormat("es-ES",{maximumFractionDigits:digits, minimumFractionDigits:digits}).format(x || 0);
}
function fmtPct(x, digits=1){
  return new Intl.NumberFormat("es-ES",{style:"percent",maximumFractionDigits:digits}).format(x || 0);
}
function fmtNumCSV(x, digits=2){
  const v = Number.isFinite(x) ? x : 0;
  return new Intl.NumberFormat("es-ES",{maximumFractionDigits:digits, minimumFractionDigits:digits}).format(v);
}
function csvEscape(v){
  const s = String(v ?? "");
  if(s.includes(";") || s.includes('"') || s.includes("\n")){
    return `"${s.replace(/"/g,'""')}"`;
  }
  return s;
}
function downloadTextFile(filename, content, mime="text/csv;charset=utf-8"){
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getField(row, ...keys){
  for(const k of keys){
    if(row && row[k] !== undefined) return row[k];
  }
  return undefined;
}

function toNumberEU(v){
  if(v === null || v === undefined) return 0;
  if(typeof v === "number") return v;
  const s = String(v).trim();
  if(!s) return 0;
  const normalized = s.replace(/\./g,"").replace(",",".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function parseDateDMY(s){
  if(!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(!m) return null;
  const d = Number(m[1]), mo = Number(m[2]) - 1, y = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function sortByDateAsc(rows){
  return [...rows].sort((x,y)=> (x.date?.getTime()||0)-(y.date?.getTime()||0));
}

function daysBetween(a,b){
  const ms = 24*3600*1000;
  return Math.round((b.getTime()-a.getTime())/ms);
}

function weekdayNameES(date){
  const names = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  return date ? names[date.getDay()] : "";
}
const WEEK_ORDER = ["lunes","martes","miércoles","jueves","viernes","sábado","domingo"];

// ---------- Normalización ----------
function normalizeRow(r){
  const driverNameRaw = getField(r, "Nombre_del_conductor", "Conductor", "Driver", "driver", "nombre_conductor");
  const driverName = driverNameRaw ? String(driverNameRaw).trim() : "";
  if(driverName && driverName.includes("===")) return { date:null };

  const date = parseDateDMY(getField(r, "Fecha_de_Jornada"));
  const minutes = toNumberEU(getField(r, "Minutos_trabajados"));
  const hours = minutes / 60;

  const km = toNumberEU(getField(r, "Km_recorridos"));
  const services = toNumberEU(getField(r, "Numero_de_servicios"));

  const gross = toNumberEU(getField(r, "Cierre_de_TAXIMETRO"));
  const visa = toNumberEU(getField(r, "Cierre_de_VISA"));
  const cash = toNumberEU(getField(r, "Efectivo"));
  const tipsVisa = toNumberEU(getField(r, "Propinas_en_Visa"));

  const netDriver = toNumberEU(getField(r, "Neto_con_propina")) ||
                    (toNumberEU(getField(r, "Saldo_neto_conductor_sin_efectivo")) + cash);

  const netBoss = toNumberEU(getField(r, "Ganancia_Neta_del_Jefe"));
  const costs = toNumberEU(getField(r, "Gastos_del_dia"));

  const visaShare = safeDiv(visa, gross);

  return {
    raw: r,
    driverName: driverName || "—",
    date,
    y: date ? date.getFullYear() : null,
    m: date ? (date.getMonth()+1) : null,
    iso: date ? `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}` : "",
    weekdayName: date ? weekdayNameES(date) : "",

    hours,
    km,
    services,
    gross,
    visa,
    cash,
    tipsVisa,
    netDriver,
    netBoss,
    costs,
    visaShare,

    netPerHour: safeDiv(netDriver, hours),
    netPerKm: safeDiv(netDriver, km),
    kmPerHour: safeDiv(km, hours),
    servicesPerHour: safeDiv(services, hours),
    avgTicketGross: safeDiv(gross, services),
  };
}

// ---------- Selector conductor ----------
function getDriverNames(){
  const names = [...new Set(CLEAN_ROWS.map(r=>r.driverName).filter(n=>n && n !== "—"))];
  names.sort((a,b)=> a.localeCompare(b, "es"));
  return names;
}

function buildDriverOptions(){
  if(!els.driverSelect || !els.driverField) return;

  const names = getDriverNames();
  const show = names.length >= 2;
  els.driverField.classList.toggle("hidden", !show);

  if(!show){
    els.driverSelect.innerHTML = "";
    return;
  }

  const current = els.driverSelect.value;
  const options = [
    `<option value="__ALL__">Todos (agregado)</option>`,
    ...names.map(n=>`<option value="${n}">${n}</option>`)
  ];
  els.driverSelect.innerHTML = options.join("");

  const exists = names.includes(current);
  if(exists){
    els.driverSelect.value = current;
  } else {
    els.driverSelect.value = names[0];
  }
}

// ✅ NUEVO: selector para export por conductor (flota)
function buildExportDriverOptions(){
  if(!els.exportDriverSelect || !els.exportDriverBtn || !els.driverExportPanel) return;

  const names = getDriverNames();
  const show = names.length >= 2;
  els.driverExportPanel.classList.toggle("hidden", !show);

  if(!show){
    els.exportDriverSelect.innerHTML = "";
    els.exportDriverBtn.disabled = true;
    return;
  }

  els.exportDriverSelect.innerHTML = names.map(n=>`<option value="${n}">${n}</option>`).join("");
  els.exportDriverBtn.disabled = false;
}

// ---------- Filtros ----------
function buildYearOptions(){
  const years = [...new Set(CLEAN_ROWS.map(r=>r.y).filter(Boolean))].sort((a,b)=>b-a);
  els.yearSelect.innerHTML = years.map(y=>`<option value="${y}">${y}</option>`).join("");
}

function setDefaultDates(){
  if(!CLEAN_ROWS.length) return;
  const sorted = sortByDateAsc(CLEAN_ROWS);
  const max = sorted[sorted.length-1].date;

  els.monthInput.value = `${max.getFullYear()}-${pad2(max.getMonth()+1)}`;

  const start = new Date(max.getTime() - 13*24*3600*1000);
  els.startDate.value = `${start.getFullYear()}-${pad2(start.getMonth()+1)}-${pad2(start.getDate())}`;
  els.endDate.value = `${max.getFullYear()}-${pad2(max.getMonth()+1)}-${pad2(max.getDate())}`;
}

function applyFilters(){
  if(!CLEAN_ROWS.length){
    toast("warn","Sin datos","Sube un CSV o usa la demo para ver el análisis.");
    return;
  }

  const mode = els.filterMode.value;
  const view = els.viewMode.value;

  let selected = CLEAN_ROWS;

  if(mode === "month"){
    const [yy,mm] = els.monthInput.value.split("-").map(Number);
    selected = CLEAN_ROWS.filter(r=> r.y===yy && r.m===mm);
    els.periodBadge.textContent = `Mes: ${pad2(mm)}/${yy}`;
  } else if(mode === "year"){
    const yy = Number(els.yearSelect.value);
    selected = CLEAN_ROWS.filter(r=> r.y===yy);
    els.periodBadge.textContent = `Año: ${yy}`;
  } else {
    const s = els.startDate.value ? new Date(els.startDate.value+"T00:00:00") : null;
    const e = els.endDate.value ? new Date(els.endDate.value+"T23:59:59") : null;
    selected = CLEAN_ROWS.filter(r=>{
      if(!r.date) return false;
      if(s && r.date < s) return false;
      if(e && r.date > e) return false;
      return true;
    });
    els.periodBadge.textContent = `Rango: ${els.startDate.value || "—"} → ${els.endDate.value || "—"}`;
  }

  // Si vista conductor y hay varios -> filtrar por conductor seleccionado (real real)
  if(view === "driver" && els.driverSelect && !els.driverField.classList.contains("hidden")){
    const chosen = els.driverSelect.value;
    if(chosen && chosen !== "__ALL__"){
      selected = selected.filter(r=> r.driverName === chosen);
    }
  }

  FILTERED = sortByDateAsc(selected);

  if(view === "fleet" && FILTERED.length){
    LAST_FLEET_ANALYSIS = buildFleetAnalysis(FILTERED);
  } else {
    LAST_FLEET_ANALYSIS = null;
  }

  if(els.exportFleetBtn) els.exportFleetBtn.disabled = FILTERED.length === 0;
  if(!FILTERED.length){
    toast("warn","Sin datos en el filtro","Cambia el mes/año/rango o revisa el CSV.");
  }

  renderAll(view);
}

// ---------- Agregación ----------
function aggregate(rows, viewMode){
  const sum = (k)=> rows.reduce((acc,r)=> acc + (r[k]||0), 0);

  const hours = sum("hours");
  const km = sum("km");
  const services = sum("services");
  const gross = sum("gross");
  const visa = sum("visa");
  const cash = sum("cash");
  const tips = sum("tipsVisa");
  const netDriver = sum("netDriver");
  const netBoss = sum("netBoss");
  const costs = sum("costs");

  let focus = netDriver;
  if(viewMode === "boss") focus = netBoss;
  if(viewMode === "fleet") focus = gross;

  return {
    days: rows.length,
    hours, km, services,
    gross, visa, cash, tips,
    netDriver, netBoss, costs,
    focusNet: focus,
    netPerHour: safeDiv(focus, hours),
    netPerKm: safeDiv(focus, km),
    kmPerHour: safeDiv(km, hours),
    servicesPerHour: safeDiv(services, hours),
    avgTicketGross: safeDiv(gross, services),
    visaShare: safeDiv(visa, gross),
  };
}

function getPreviousPeriod(rows){
  if(!rows.length) return [];
  const first = rows[0].date;
  const last = rows[rows.length-1].date;
  if(!first || !last) return [];

  const spanDays = Math.max(1, daysBetween(first, last) + 1);
  const prevEnd = new Date(first.getTime() - 1*24*3600*1000);
  const prevStart = new Date(prevEnd.getTime() - (spanDays-1)*24*3600*1000);

  return CLEAN_ROWS.filter(r=>{
    if(!r.date) return false;
    return r.date >= prevStart && r.date <= prevEnd;
  });
}

function deltaPct(current, previous){
  if(!previous) return null;
  return safeDiv(current - previous, Math.abs(previous));
}

function classifyDelta(d){
  if(d === null) return {cls:"warn", txt:"sin dato anterior"};
  if(d > 0.05) return {cls:"good", txt:`▲ ${fmtPct(d)}`};
  if(d < -0.05) return {cls:"bad", txt:`▼ ${fmtPct(Math.abs(d))}`};
  return {cls:"warn", txt:`≈ ${fmtPct(Math.abs(d))}`};
}

function linearTrend(values){
  const n = values.length;
  if(n < 4) return 0;
  let sx=0, sy=0, sxx=0, sxy=0;
  for(let i=0;i<n;i++){
    sx+=i; sy+=values[i]; sxx+=i*i; sxy+=i*values[i];
  }
  const denom = (n*sxx - sx*sx);
  if(!denom) return 0;
  return (n*sxy - sx*sy) / denom;
}

// ---------- Semana ----------
function getValueForView(r, viewMode){
  if(viewMode === "boss") return r.netBoss;
  if(viewMode === "fleet") return r.gross;
  return r.netDriver;
}

function summarizeByWeekday(rows, viewMode){
  const buckets = new Map();
  WEEK_ORDER.forEach(d=>buckets.set(d, {
    weekdayName: d,
    count:0, sumHours:0, sumKm:0, sumServices:0, sumGross:0, sumValue:0
  }));

  for(const r of rows){
    if(!r.date) continue;
    const w = r.weekdayName;
    if(!buckets.has(w)) continue;
    const b = buckets.get(w);
    b.count++;
    b.sumHours += r.hours||0;
    b.sumKm += r.km||0;
    b.sumServices += r.services||0;
    b.sumGross += r.gross||0;
    b.sumValue += getValueForView(r, viewMode);
  }

  return WEEK_ORDER.map(w=>{
    const b = buckets.get(w);
    return {
      weekdayName: w,
      count: b.count,
      eurH: safeDiv(b.sumValue, b.sumHours),
      eurKm: safeDiv(b.sumValue, b.sumKm),
      srvH: safeDiv(b.sumServices, b.sumHours),
      kmH: safeDiv(b.sumKm, b.sumHours),
      ticket: safeDiv(b.sumGross, b.sumServices),
      sumValue: b.sumValue,
      sumHours: b.sumHours,
      sumKm: b.sumKm,
      sumServices: b.sumServices,
      sumGross: b.sumGross,
    };
  });
}

function pickBestWorstWeekday(stats){
  const valid = stats.filter(s=>s.count>0);
  if(!valid.length) return {best:null, worst:null};
  let best = valid[0], worst = valid[0];
  for(const s of valid){
    if(s.eurH > best.eurH) best = s;
    if(s.eurH < worst.eurH) worst = s;
  }
  return {best, worst};
}

// ---------- Heatmap ----------
function heatClass(value, min, max){
  if(!Number.isFinite(value)) return "heat-0";
  if(max <= min) return "heat-3";
  const t = (value - min) / (max - min);
  const idx = Math.round(clamp(t, 0, 1) * 5);
  return `heat-${idx}`;
}

function renderHeatmap(statsByWeekday){
  const vals = statsByWeekday.map(s=>s.eurH).filter(v=>Number.isFinite(v));
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 1;

  els.heatmapGrid.innerHTML = "";

  statsByWeekday.forEach((s, i)=>{
    const cell = document.createElement("div");
    cell.className = "heat-cell";

    if(!s || s.count === 0){
      cell.innerHTML = `
        <div class="heat-day">${WEEK_ORDER[i]}</div>
        <div class="heat-value muted">—</div>
        <div class="heat-meta muted">0 jornadas</div>
      `;
      cell.classList.add("heat-0");
      els.heatmapGrid.appendChild(cell);
      return;
    }

    const cls = heatClass(s.eurH, min, max);
    cell.classList.add(cls);

    cell.innerHTML = `
      <div class="heat-day">${WEEK_ORDER[i]}</div>
      <div class="heat-value"><b>${fmtNum(s.eurH)} €/h</b></div>
      <div class="heat-meta">${s.count} jornadas · ${fmtNum(s.srvH)} serv/h</div>
    `;
    els.heatmapGrid.appendChild(cell);
  });
}

// ---------- Acciones ----------
function renderActionPlan(rows, viewMode){
  els.actionList.innerHTML = "";
  if(!rows.length){
    const li = document.createElement("li");
    li.textContent = "Sube un CSV para obtener recomendaciones accionables.";
    els.actionList.appendChild(li);
    return;
  }

  const agg = aggregate(rows, viewMode);
  const weekStats = summarizeByWeekday(rows, viewMode);
  const {best, worst} = pickBestWorstWeekday(weekStats);

  const actions = [];

  if(worst && best){
    actions.push({
      title: "Ataca el patrón malo",
      text: `El día más débil (media) es <b>${worst.weekdayName}</b> (${fmtNum(worst.eurH)} €/h). Replica estrategia del mejor día <b>${best.weekdayName}</b> (${fmtNum(best.eurH)} €/h): franjas, zonas y mix de servicios.`
    });
  }

  if(agg.servicesPerHour < 1.2){
    actions.push({
      title: "Sube servicios/h (palanca #1 del €/h)",
      text: `Estás en <b>${fmtNum(agg.servicesPerHour)} servicios/h</b>. Mañana prioriza zonas de rotación y reduce esperas largas.`
    });
  } else {
    actions.push({
      title: "Optimiza selección (no solo cantidad)",
      text: `Servicios/h está bien (${fmtNum(agg.servicesPerHour)}). El salto viene de mejor ticket y menos km en vacío.`
    });
  }

  if(agg.kmPerHour > 22 && agg.netPerHour < (Number(els.rentableThreshold.value||10))){
    actions.push({
      title: "Reduce km en vacío",
      text: `Señal típica: <b>km/h alto</b> (${fmtNum(agg.kmPerHour)} km/h) con <b>€/h</b> bajo (${fmtNum(agg.netPerHour)} €/h). Reposiciona a focos de demanda, no circules sin objetivo.`
    });
  }

  if(agg.avgTicketGross < 12){
    actions.push({
      title: "Mejora ticket medio",
      text: `Ticket medio bajo (${fmtEUR(agg.avgTicketGross)}). Alterna rotación con oportunidades de ticket alto cuando la demanda esté fuerte.`
    });
  }

  actions.slice(0,4).forEach(a=>{
    const li = document.createElement("li");
    li.innerHTML = `<b>${a.title}:</b> ${a.text}`;
    els.actionList.appendChild(li);
  });
}

// ---------- KPIs + Insights ----------
function kpiCard(label, value, deltaInfo){
  const div = document.createElement("div");
  div.className = "kpi";
  div.innerHTML = `
    <div class="top"><div class="label">${label}</div></div>
    <div class="value">${value}</div>
    <div class="delta ${deltaInfo?.cls || "warn"}">${deltaInfo?.txt || "—"}</div>
  `;
  return div;
}

function renderKPIs(agg, prevAgg, viewMode){
  els.kpiGrid.innerHTML = "";
  const prev = prevAgg && prevAgg.days ? prevAgg : null;

  const focusLabel = (viewMode==="driver") ? "Neto conductor"
                    : (viewMode==="boss") ? "Neto jefe"
                    : "Bruto (taxímetro)";

  const dFocus = prev ? classifyDelta(deltaPct(agg.focusNet, prev.focusNet)) : null;
  const dNPH = prev ? classifyDelta(deltaPct(agg.netPerHour, prev.netPerHour)) : null;

  els.kpiGrid.appendChild(kpiCard(focusLabel, fmtEUR(agg.focusNet), dFocus));
  els.kpiGrid.appendChild(kpiCard("€ / hora", `${fmtNum(agg.netPerHour)} €/h`, dNPH));
  els.kpiGrid.appendChild(kpiCard("€ / km", `${fmtNum(agg.netPerKm)} €/km`, null));
  els.kpiGrid.appendChild(kpiCard("Servicios / h", `${fmtNum(agg.servicesPerHour)} /h`, null));
  els.kpiGrid.appendChild(kpiCard("Km / h", `${fmtNum(agg.kmPerHour)} km/h`, null));
  els.kpiGrid.appendChild(kpiCard("Ticket medio bruto", fmtEUR(agg.avgTicketGross), null));
  els.kpiGrid.appendChild(kpiCard("% VISA", fmtPct(agg.visaShare), null));
}

function renderInsights(items){
  els.insightList.innerHTML = "";
  for(const it of items){
    const li = document.createElement("li");
    li.innerHTML = `<span class="tag ${it.tag}">${it.title}</span>${it.msg}`;
    els.insightList.appendChild(li);
  }
}

function pickBestWorstDays(rows, viewMode){
  if(!rows.length) return {best:null, worst:null};
  const score = (r)=> safeDiv(getValueForView(r, viewMode), r.hours);
  let best = rows[0], worst = rows[0];
  for(const r of rows){
    if(score(r) > score(best)) best = r;
    if(score(r) < score(worst)) worst = r;
  }
  return {best, worst};
}

function buildInsights(rows, agg, prevAgg, viewMode){
  const out = [];

  if(viewMode === "fleet"){
    out.push({tag:"info", title:"Flota", msg:"KPI clave = bruto/h + patrón semanal + ranking por conductor."});
  }

  if(prevAgg && prevAgg.days){
    const c1 = classifyDelta(deltaPct(agg.netPerHour, prevAgg.netPerHour));
    out.push({tag:c1.cls, title:"Comparativa €/h", msg:`Anterior ${fmtNum(prevAgg.netPerHour)} → ahora ${fmtNum(agg.netPerHour)} (${c1.txt}).`});
  } else {
    out.push({tag:"warn", title:"Comparativa", msg:"Sin periodo anterior comparable."});
  }

  const series = rows.map(r=> safeDiv(getValueForView(r, viewMode), r.hours)).filter(v=>Number.isFinite(v));
  if(series.length>=6){
    const slope = linearTrend(series);
    if(slope < -0.08) out.push({tag:"bad", title:"Tendencia", msg:"Caída clara en €/hora dentro del periodo."});
    else if(slope > 0.08) out.push({tag:"good", title:"Tendencia", msg:"Tendencia positiva en €/hora dentro del periodo."});
    else out.push({tag:"info", title:"Tendencia", msg:"€/hora estable dentro del periodo."});
  }

  const {best, worst} = pickBestWorstDays(rows, viewMode);
  if(best && worst){
    out.push({tag:"good", title:"Mejor día (fecha)", msg:`${best.iso} (${best.weekdayName})`});
    out.push({tag:"bad", title:"Peor día (fecha)", msg:`${worst.iso} (${worst.weekdayName})`});
  }

  const wstats = summarizeByWeekday(rows, viewMode);
  const ww = pickBestWorstWeekday(wstats);
  if(ww.best && ww.worst){
    out.push({tag:"info", title:"Patrón semanal", msg:`Mejor (media): ${ww.best.weekdayName} ${fmtNum(ww.best.eurH)} €/h · Peor (media): ${ww.worst.weekdayName} ${fmtNum(ww.worst.eurH)} €/h.`});
  }

  return out;
}

// ---------- Charts ----------
function destroyCharts(){
  for(const k of Object.keys(CHARTS)){
    try{ CHARTS[k].destroy(); }catch(e){}
  }
  CHARTS = {};
}

function renderCharts(rows, viewMode){
  if(!els.chartNetPerHour || !window.Chart) return;
  destroyCharts();

  const labels = rows.map(r=> r.iso);

  const eurH = rows.map(r=> safeDiv(getValueForView(r, viewMode), r.hours));
  const eurK = rows.map(r=> safeDiv(getValueForView(r, viewMode), r.km));
  const kmh = rows.map(r=> safeDiv(r.km, r.hours));
  const srvh = rows.map(r=> safeDiv(r.services, r.hours));
  const visaShare = rows.map(r=> r.visaShare);
  const avgTicket = rows.map(r=> r.avgTicketGross);

  CHARTS.netPerHour = new Chart(els.chartNetPerHour, {
    type: "line",
    data: { labels, datasets: [{ label:"€/hora", data: eurH, tension: .25, pointRadius: 2 }] },
    options: { responsive:true, plugins:{legend:{display:false}} }
  });

  CHARTS.netPerKm = new Chart(els.chartNetPerKm, {
    type: "line",
    data: { labels, datasets: [{ label:"€/km", data: eurK, tension: .25, pointRadius: 2 }] },
    options: { responsive:true, plugins:{legend:{display:false}} }
  });

  CHARTS.eff = new Chart(els.chartEfficiency, {
    type: "line",
    data: { labels, datasets: [
      { label:"Km/h", data: kmh, tension:.25, pointRadius:2 },
      { label:"Servicios/h", data: srvh, tension:.25, pointRadius:2 }
    ]},
    options: { responsive:true, plugins:{legend:{display:true}} }
  });

  CHARTS.mix = new Chart(els.chartMix, {
    type: "line",
    data: { labels, datasets: [
      { label:"% VISA", data: visaShare, tension:.25, pointRadius:2, yAxisID:"y" },
      { label:"Ticket medio bruto (€)", data: avgTicket, tension:.25, pointRadius:2, yAxisID:"y1" }
    ]},
    options: {
      responsive:true,
      plugins:{legend:{display:true}},
      scales:{
        y:{ position:"left" },
        y1:{ position:"right", grid:{drawOnChartArea:false} }
      }
    }
  });
}

// ---------- Tabla detalle ----------
function renderTable(rows, viewMode){
  if(!els.tableBody) return;
  els.tableBody.innerHTML = "";

  const {best, worst} = pickBestWorstDays(rows, viewMode);
  for(const r of rows){
    const v = getValueForView(r, viewMode);
    const eurH = safeDiv(v, r.hours);
    const eurK = safeDiv(v, r.km);

    const isBest = best && r.iso === best.iso;
    const isWorst = worst && r.iso === worst.iso;

    const bestTag = isBest ? `<span class="pill good">TOP</span>` : "";
    const worstTag = isWorst ? `<span class="pill bad">PEOR</span>` : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${bestTag}${worstTag}${r.iso} <span class="muted">(${r.weekdayName})</span></td>
      <td>${fmtNum(r.hours,1)}</td>
      <td>${fmtNum(r.km,1)}</td>
      <td>${fmtNum(r.services,0)}</td>
      <td>${fmtEUR(r.gross)}</td>
      <td>${fmtEUR(v)}</td>
      <td>${fmtNum(eurH)} €/h</td>
      <td>${fmtNum(eurK)} €/km</td>
      <td>${fmtPct(r.visaShare)}</td>
    `;
    els.tableBody.appendChild(tr);
  }
}

// ---------- Flota: ranking + explicación ----------
function groupByDriver(rows){
  const map = new Map();
  for(const r of rows){
    const name = r.driverName || "—";
    if(!map.has(name)) map.set(name, []);
    map.get(name).push(r);
  }
  return map;
}

function pickWorstDayFleet(rows){
  if(!rows.length) return null;
  const score = (r)=> safeDiv(r.gross, r.hours);
  let worst = rows[0];
  for(const r of rows){
    if(score(r) < score(worst)) worst = r;
  }
  return worst;
}

function pickBestDayFleet(rows){
  if(!rows.length) return null;
  const score = (r)=> safeDiv(r.gross, r.hours);
  let best = rows[0];
  for(const r of rows){
    if(score(r) > score(best)) best = r;
  }
  return best;
}

function explainWorstPerformanceFleet(driverRows){
  const sorted = sortByDateAsc(driverRows);
  const agg = aggregate(sorted, "fleet");
  const worst = pickWorstDayFleet(sorted);
  if(!worst) return null;

  const avgEurH = agg.netPerHour;
  const worstEurH = safeDiv(worst.gross, worst.hours);

  const diffSrv = agg.servicesPerHour - worst.servicesPerHour;
  const diffKmh = worst.kmPerHour - agg.kmPerHour;
  const diffTicket = agg.avgTicketGross - worst.avgTicketGross;

  const reasons = [];
  if(diffSrv > 0.25) reasons.push(`menos servicios/h (${fmtNum(worst.servicesPerHour)} vs ${fmtNum(agg.servicesPerHour)})`);
  if(diffKmh > 2 && worstEurH < avgEurH) reasons.push(`posible km en vacío (km/h ${fmtNum(worst.kmPerHour)} vs ${fmtNum(agg.kmPerHour)})`);
  if(diffTicket > 2) reasons.push(`ticket medio más bajo (${fmtEUR(worst.avgTicketGross)} vs ${fmtEUR(agg.avgTicketGross)})`);
  if(reasons.length === 0) reasons.push(`mezcla de factores (zona/franja/demanda)`);

  const recs = [];
  if(diffSrv > 0.25) recs.push(`subir servicios/h (zonas de rotación + menos espera)`);
  if(diffKmh > 2 && worstEurH < avgEurH) recs.push(`reducir km en vacío (reposicionar a foco de demanda)`);
  if(diffTicket > 2) recs.push(`buscar ticket mayor cuando la demanda lo permita`);
  if(recs.length === 0) recs.push(`replicar estrategia del mejor día del conductor`);

  return { worstIso: worst.iso, worstDow: worst.weekdayName, worstEurH, avgEurH, reasons, recs };
}

function buildFleetAnalysis(rows){
  const map = groupByDriver(rows);
  const entries = [];

  for(const [name, arrRaw] of map.entries()){
    const arr = sortByDateAsc(arrRaw);
    const a = aggregate(arr, "fleet");

    const series = arr.map(r=>safeDiv(r.gross, r.hours)).filter(v=>Number.isFinite(v));
    const slope = (series.length>=6) ? linearTrend(series) : 0;
    const status =
      (series.length<6) ? {tag:"warn", text:"pocos datos"} :
      (slope < -0.08) ? {tag:"bad", text:"cayendo"} :
      (slope > 0.08) ? {tag:"good", text:"mejorando"} :
      {tag:"info", text:"estable"};

    const best = pickBestDayFleet(arr);
    const worst = pickWorstDayFleet(arr);

    const weekStats = summarizeByWeekday(arr, "fleet");
    const bwWeek = pickBestWorstWeekday(weekStats);
    const explain = explainWorstPerformanceFleet(arr);

    entries.push({
      name,
      rows: arr,
      grossTotal: a.gross,
      count: a.days,
      hours: a.hours,
      km: a.km,
      services: a.services,
      eurHour: a.netPerHour,
      eurKm: a.netPerKm,
      srvH: a.servicesPerHour,
      kmH: a.kmPerHour,
      visaShare: a.visaShare,
      avgTicket: a.avgTicketGross,
      statusText: status.text,
      statusTag: status.tag,
      slope,
      bestDay: best ? best.iso : "",
      bestDayDow: best ? best.weekdayName : "",
      bestDayEurH: best ? safeDiv(best.gross,best.hours) : 0,
      worstDay: worst ? worst.iso : "",
      worstDayDow: worst ? worst.weekdayName : "",
      worstDayEurH: worst ? safeDiv(worst.gross,worst.hours) : 0,
      bestWeekday: bwWeek.best ? bwWeek.best.weekdayName : "",
      bestWeekdayEurH: bwWeek.best ? bwWeek.best.eurH : 0,
      worstWeekday: bwWeek.worst ? bwWeek.worst.weekdayName : "",
      worstWeekdayEurH: bwWeek.worst ? bwWeek.worst.eurH : 0,
      weekStats,
      explain
    });
  }

  entries.sort((a,b)=> b.eurHour - a.eurHour);
  return { entries };
}

function renderDriverRankingAndExplain(rows){
  const hasNames = rows.some(r=>r.driverName && r.driverName !== "—");
  const isFleet = (els.viewMode.value === "fleet");

  if(!els.driverRankingPanel) return;
  els.driverRankingPanel.classList.toggle("hidden", !(isFleet && hasNames));

  // ✅ mostrar/ocultar export por conductor según multi-conductor
  buildExportDriverOptions();

  if(!(isFleet && hasNames)){
    if(els.driverRankingBody) els.driverRankingBody.innerHTML = "";
    if(els.driverExplainList) els.driverExplainList.innerHTML = "";
    LAST_FLEET_ANALYSIS = null;
    return;
  }

  LAST_FLEET_ANALYSIS = buildFleetAnalysis(rows);
  const entries = LAST_FLEET_ANALYSIS.entries;

  if(els.driverRankingBody){
    els.driverRankingBody.innerHTML = "";
    entries.forEach((d, idx)=>{
      const rank = idx+1;
      const rankPill =
        rank === 1 ? `<span class="pill good">TOP</span>` :
        rank === entries.length ? `<span class="pill bad">PEOR</span>` :
        `<span class="pill warn">#${rank}</span>`;

      const statusPill =
        d.statusTag === "good" ? `<span class="pill good">${d.statusText}</span>` :
        d.statusTag === "bad" ? `<span class="pill bad">${d.statusText}</span>` :
        `<span class="pill warn">${d.statusText}</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${rankPill}</td>
        <td><b>${d.name}</b></td>
        <td>${fmtNum(d.count,0)}</td>
        <td>${fmtNum(d.hours,1)}</td>
        <td>${fmtNum(d.km,1)}</td>
        <td>${fmtNum(d.services,0)}</td>
        <td><b>${fmtNum(d.eurHour)} €/h</b></td>
        <td>${fmtNum(d.eurKm)} €/km</td>
        <td>${fmtNum(d.srvH)} /h</td>
        <td>${fmtNum(d.kmH)} km/h</td>
        <td>${fmtPct(d.visaShare)}</td>
        <td>${statusPill}</td>
      `;
      els.driverRankingBody.appendChild(tr);
    });
  }

  if(els.driverExplainList){
    els.driverExplainList.innerHTML = "";
    entries.forEach((d)=>{
      const exp = d.explain;
      if(!exp) return;
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="tag warn">${d.name}</span>
        Peor día: <b>${exp.worstIso}</b> (${exp.worstDow}) → <b>${fmtNum(exp.worstEurH)} €/h</b>
        (media ${fmtNum(exp.avgEurH)} €/h). Causa probable: <b>${exp.reasons.join(", ")}</b>.
        <div class="small muted" style="margin-top:6px;">
          Recomendación: ${exp.recs.join(" · ")}.
        </div>
      `;
      els.driverExplainList.appendChild(li);
    });
  }
}

// ---------- Goals ----------
function computeGoalProgress(){
  if(!FILTERED.length) {
    els.goalTitle.textContent = "Sube un CSV y aplica un filtro de mes para ver objetivos";
    els.goalSubtitle.textContent = "—";
    els.goalMain.textContent = "—";
    els.goalFill.style.width = "0%";
    els.goalMeta.textContent = "—";
    return;
  }

  const mode = els.filterMode.value;
  const goal = Number(els.monthlyGoal.value || 0);

  const agg = aggregate(FILTERED, "driver");
  const current = agg.netDriver;

  const pct = clamp(safeDiv(current, goal), 0, 1);
  const remaining = Math.max(0, goal - current);

  const today = new Date();
  let daysLeft = 0;

  if(mode === "month"){
    const [yy,mm] = els.monthInput.value.split("-").map(Number);
    const lastDay = new Date(yy, mm, 0);
    const effectiveNow = new Date(Math.min(today.getTime(), lastDay.getTime()));
    daysLeft = Math.max(0, daysBetween(effectiveNow, lastDay));
  }

  const perDayNeeded = daysLeft > 0 ? (remaining / daysLeft) : remaining;

  els.goalTitle.textContent = "Progreso hacia objetivo";
  els.goalSubtitle.textContent = `Objetivo: ${fmtEUR(goal)} | Llevas: ${fmtEUR(current)} | Falta: ${fmtEUR(remaining)}`;
  els.goalMain.textContent = `${Math.round(pct*100)}%`;
  els.goalFill.style.width = `${Math.round(pct*100)}%`;
  els.goalMeta.textContent = (mode === "month" && daysLeft > 0)
    ? `Para llegar, necesitas aprox. ${fmtEUR(perDayNeeded)} netos/día durante los ${daysLeft} días restantes.`
    : `Tip: para objetivos mensuales, usa el filtro “Mes”.`;
}

// ---------- Export ----------
function buildAutoExplanationForView(rows, viewMode, threshold){
  const agg = aggregate(rows, viewMode);

  const alerts = [];
  if(agg.netPerHour < threshold){
    alerts.push(`NO rentable: ${fmtNum(agg.netPerHour)} €/h < umbral ${fmtNum(threshold)} €/h`);
  } else {
    alerts.push(`Rentable: ${fmtNum(agg.netPerHour)} €/h ≥ umbral ${fmtNum(threshold)} €/h`);
  }

  if(agg.servicesPerHour < 1.2) alerts.push(`Servicios/h bajos (${fmtNum(agg.servicesPerHour)})`);
  if(agg.avgTicketGross < 12) alerts.push(`Ticket medio bajo (${fmtNum(agg.avgTicketGross)} €)`);
  if(agg.kmPerHour > 22 && agg.netPerHour < threshold) alerts.push(`Posible km en vacío (km/h ${fmtNum(agg.kmPerHour)})`);

  const recs = [];
  if(agg.servicesPerHour < 1.2) recs.push("subir servicios/h: zonas de rotación + menos espera");
  if(agg.avgTicketGross < 12) recs.push("mejorar ticket: combinar rotación con oportunidades de ticket alto");
  if(agg.kmPerHour > 22 && agg.netPerHour < threshold) recs.push("reducir km en vacío: reposicionar a focos de demanda");
  if(!recs.length) recs.push("replicar estrategia del mejor día (franja + zona + tipo de servicio)");

  return { alerts, recommendation: recs.join(" · ") };
}

function exportSingleViewAnalysis(viewMode, forcedRows=null, fileSuffix=""){
  const rows = sortByDateAsc(forcedRows || FILTERED);
  const period = els.periodBadge.textContent || "—";
  const generatedAtRaw = new Date().toISOString();
  const generatedAt = generatedAtRaw.replace(/[:.]/g,"-");
  const threshold = Number(els.rentableThreshold.value || 10);

  const suffix = fileSuffix ? `_${fileSuffix}` : "";
  const base = `taxi360_${viewMode}${suffix}_${generatedAt}`;

  const agg = aggregate(rows, viewMode);
  const {best, worst} = pickBestWorstDays(rows, viewMode);

  const weekStats = summarizeByWeekday(rows, viewMode);
  const bwWeek = pickBestWorstWeekday(weekStats);

  const explanation = buildAutoExplanationForView(rows, viewMode, threshold);

  const bestEurH = best ? safeDiv(getValueForView(best, viewMode), best.hours) : 0;
  const worstEurH = worst ? safeDiv(getValueForView(worst, viewMode), worst.hours) : 0;

  const h1 = [
    "periodo","generado_en","vista",
    "umbral_rentable_eur_h",
    "total_valor","eur_h","eur_km","servicios_h","km_h","ticket_medio_bruto","visa_share",
    "mejor_dia_fecha","mejor_dia_semana","mejor_dia_eur_h",
    "peor_dia_fecha","peor_dia_semana","peor_dia_eur_h",
    "mejor_semana_dia","mejor_semana_dia_eur_h",
    "peor_semana_dia","peor_semana_dia_eur_h",
    "alertas","recomendacion_manana"
  ];
  const l1 = [
    period, generatedAtRaw, viewMode,
    fmtNumCSV(threshold,2),
    fmtNumCSV(agg.focusNet,2),
    fmtNumCSV(agg.netPerHour,2),
    fmtNumCSV(agg.netPerKm,2),
    fmtNumCSV(agg.servicesPerHour,2),
    fmtNumCSV(agg.kmPerHour,2),
    fmtNumCSV(agg.avgTicketGross,2),
    fmtNumCSV(agg.visaShare,4),
    best?.iso || "", best?.weekdayName || "", fmtNumCSV(bestEurH,2),
    worst?.iso || "", worst?.weekdayName || "", fmtNumCSV(worstEurH,2),
    bwWeek.best?.weekdayName || "", fmtNumCSV(bwWeek.best?.eurH || 0,2),
    bwWeek.worst?.weekdayName || "", fmtNumCSV(bwWeek.worst?.eurH || 0,2),
    explanation.alerts.join(" | "),
    explanation.recommendation
  ];
  downloadTextFile(`${base}_resumen.csv`, [h1.map(csvEscape).join(";"), l1.map(csvEscape).join(";")].join("\n"));

  const h2 = [
    "periodo","generado_en","vista","dia_semana",
    "jornadas","eur_h","eur_km","servicios_h","km_h","ticket_medio","total_valor"
  ];
  const lines2 = [h2.map(csvEscape).join(";")];
  weekStats.forEach(w=>{
    lines2.push([
      period, generatedAtRaw, viewMode, w.weekdayName,
      fmtNumCSV(w.count,0),
      fmtNumCSV(w.eurH,2),
      fmtNumCSV(w.eurKm,2),
      fmtNumCSV(w.srvH,2),
      fmtNumCSV(w.kmH,2),
      fmtNumCSV(w.ticket,2),
      fmtNumCSV(w.sumValue,2)
    ].map(csvEscape).join(";"));
  });
  setTimeout(()=>downloadTextFile(`${base}_heatmap_semanal.csv`, lines2.join("\n")), 250);

  const h3 = [
    "periodo","generado_en","vista",
    "fecha","dia_semana",
    "horas","km","servicios","bruto","valor_vista",
    "eur_h","eur_km","servicios_h","km_h","visa_share","ticket_medio",
    "rentable_umbral","rentable"
  ];
  const lines3 = [h3.map(csvEscape).join(";")];

  rows.forEach(r=>{
    const v = getValueForView(r, viewMode);
    const eurH = safeDiv(v, r.hours);
    const rentable = eurH >= threshold ? "SI" : "NO";
    lines3.push([
      period, generatedAtRaw, viewMode,
      r.iso, r.weekdayName,
      fmtNumCSV(r.hours,1),
      fmtNumCSV(r.km,1),
      fmtNumCSV(r.services,0),
      fmtNumCSV(r.gross,2),
      fmtNumCSV(v,2),
      fmtNumCSV(eurH,2),
      fmtNumCSV(safeDiv(v,r.km),2),
      fmtNumCSV(safeDiv(r.services,r.hours),2),
      fmtNumCSV(safeDiv(r.km,r.hours),2),
      fmtNumCSV(r.visaShare,4),
      fmtNumCSV(r.avgTicketGross,2),
      fmtNumCSV(threshold,2),
      rentable
    ].map(csvEscape).join(";"));
  });

  setTimeout(()=>downloadTextFile(`${base}_serie_diaria.csv`, lines3.join("\n")), 500);

  toast("good","Export generado",`Se han descargado 3 CSV (${viewMode}${fileSuffix ? " · "+fileSuffix : ""}).`);
}

function exportFleetFullAnalysis(){
  if(!LAST_FLEET_ANALYSIS || !LAST_FLEET_ANALYSIS.entries?.length){
    LAST_FLEET_ANALYSIS = buildFleetAnalysis(FILTERED);
  }
  if(!LAST_FLEET_ANALYSIS.entries.length){
    toast("warn","Sin análisis de flota","No hay datos de flota para exportar.");
    return;
  }

  const period = els.periodBadge.textContent || "—";
  const generatedAtRaw = new Date().toISOString();
  const generatedAt = generatedAtRaw.replace(/[:.]/g,"-");
  const base = `taxi360_flota_${generatedAt}`;

  const h1 = [
    "periodo","generado_en","ranking","conductor","estado",
    "jornadas","horas","km","servicios","bruto_total",
    "eur_h","eur_km","servicios_h","km_h","ticket_medio_bruto","visa_share",
    "mejor_dia_fecha","mejor_dia_semana","mejor_dia_eur_h",
    "peor_dia_fecha","peor_dia_semana","peor_dia_eur_h",
    "mejor_semana_dia","mejor_semana_dia_eur_h",
    "peor_semana_dia","peor_semana_dia_eur_h",
    "causas_probables","recomendaciones"
  ];
  const lines1 = [h1.map(csvEscape).join(";")];

  LAST_FLEET_ANALYSIS.entries.forEach((d, idx)=>{
    const exp = d.explain || null;
    lines1.push([
      period, generatedAtRaw, String(idx+1), d.name, d.statusText,
      fmtNumCSV(d.count,0), fmtNumCSV(d.hours,1), fmtNumCSV(d.km,1), fmtNumCSV(d.services,0), fmtNumCSV(d.grossTotal,2),
      fmtNumCSV(d.eurHour,2), fmtNumCSV(d.eurKm,2), fmtNumCSV(d.srvH,2), fmtNumCSV(d.kmH,2),
      fmtNumCSV(d.avgTicket,2), fmtNumCSV(d.visaShare,4),
      d.bestDay, d.bestDayDow, fmtNumCSV(d.bestDayEurH,2),
      d.worstDay, d.worstDayDow, fmtNumCSV(d.worstDayEurH,2),
      d.bestWeekday, fmtNumCSV(d.bestWeekdayEurH,2),
      d.worstWeekday, fmtNumCSV(d.worstWeekdayEurH,2),
      exp?.reasons?.join(" | ") || "",
      exp?.recs?.join(" | ") || ""
    ].map(csvEscape).join(";"));
  });

  downloadTextFile(`${base}_resumen.csv`, lines1.join("\n"));

  const h2 = [
    "periodo","generado_en","conductor","dia_semana",
    "jornadas","eur_h","eur_km","servicios_h","km_h","ticket_medio","bruto_total"
  ];
  const lines2 = [h2.map(csvEscape).join(";")];

  LAST_FLEET_ANALYSIS.entries.forEach((d)=>{
    d.weekStats.forEach((w)=>{
      lines2.push([
        period, generatedAtRaw, d.name, w.weekdayName,
        fmtNumCSV(w.count,0),
        fmtNumCSV(w.eurH,2),
        fmtNumCSV(w.eurKm,2),
        fmtNumCSV(w.srvH,2),
        fmtNumCSV(w.kmH,2),
        fmtNumCSV(w.ticket,2),
        fmtNumCSV(w.sumValue,2)
      ].map(csvEscape).join(";"));
    });
  });

  setTimeout(()=> downloadTextFile(`${base}_heatmap_semanal.csv`, lines2.join("\n")), 250);

  const h3 = [
    "periodo","generado_en","conductor","fecha","dia_semana",
    "horas","km","servicios","bruto",
    "eur_h","eur_km","servicios_h","km_h","visa_share","ticket_medio"
  ];
  const lines3 = [h3.map(csvEscape).join(";")];

  LAST_FLEET_ANALYSIS.entries.forEach((d)=>{
    d.rows.forEach((r)=>{
      lines3.push([
        period, generatedAtRaw, d.name, r.iso, r.weekdayName,
        fmtNumCSV(r.hours,1),
        fmtNumCSV(r.km,1),
        fmtNumCSV(r.services,0),
        fmtNumCSV(r.gross,2),
        fmtNumCSV(safeDiv(r.gross,r.hours),2),
        fmtNumCSV(safeDiv(r.gross,r.km),2),
        fmtNumCSV(safeDiv(r.services,r.hours),2),
        fmtNumCSV(safeDiv(r.km,r.hours),2),
        fmtNumCSV(r.visaShare,4),
        fmtNumCSV(r.avgTicketGross,2),
      ].map(csvEscape).join(";"));
    });
  });

  setTimeout(()=> downloadTextFile(`${base}_serie_diaria.csv`, lines3.join("\n")), 500);

  toast("good","Export flota generado","Se han descargado 3 CSV con el análisis completo de todos los conductores.");
}

// ✅ NUEVO: exportar un conductor desde la vista flota (usa vista 'fleet' pero filtrado por nombre)
function exportOneDriverFromFleet(driverName){
  if(!driverName){
    toast("warn","Selecciona conductor","Elige un conductor para exportar.");
    return;
  }
  const rows = FILTERED.filter(r=> r.driverName === driverName);
  if(!rows.length){
    toast("warn","Sin datos","No hay jornadas de ese conductor en el periodo filtrado.");
    return;
  }
  // usamos el mismo export single de vista fleet, pero con filas filtradas y sufijo con nombre
  const safeName = String(driverName).trim().replace(/\s+/g,"_").replace(/[^\w\-áéíóúüñÁÉÍÓÚÜÑ]/g,"");
  exportSingleViewAnalysis("fleet", rows, `conductor_${safeName}`);
}

function exportUniversalAnalysis(){
  if(!FILTERED.length){
    toast("warn","Sin datos filtrados","Sube CSV y pulsa Aplicar.");
    return;
  }
  const view = els.viewMode.value;
  if(view === "fleet") exportFleetFullAnalysis();
  else exportSingleViewAnalysis(view);
}

// ---------- Render principal ----------
function renderAll(viewMode){
  const agg = aggregate(FILTERED, viewMode);
  const prevRows = getPreviousPeriod(FILTERED);
  const prevAgg = prevRows.length ? aggregate(prevRows, viewMode) : null;

  renderKPIs(agg, prevAgg, viewMode);
  renderInsights(buildInsights(FILTERED, agg, prevAgg, viewMode));

  const weekStats = summarizeByWeekday(FILTERED, viewMode);
  renderHeatmap(weekStats);

  renderActionPlan(FILTERED, viewMode);
  renderDriverRankingAndExplain(FILTERED);

  renderCharts(FILTERED, viewMode);
  renderTable(FILTERED, viewMode);

  computeGoalProgress();
}

// ---------- CSV Load ----------
function loadCsvFile(file){
  showLoader("Analizando CSV…","Leyendo, normalizando y calculando KPIs");

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    delimiter: ";",
    complete: (res)=>{
      RAW_ROWS = res.data || [];
      CLEAN_ROWS = RAW_ROWS.map(normalizeRow).filter(r=>r.date && r.hours>0);

      buildYearOptions();
      setDefaultDates();

      buildDriverOptions();
      buildExportDriverOptions();

      applyFilters();
      hideLoader();

      toast("good","CSV cargado",`Filas: ${CLEAN_ROWS.length}. KPI listos para analizar.`);
    },
    error: (err)=> {
      hideLoader();
      toast("bad","Error leyendo CSV", err.message || "No se pudo leer el archivo.");
      alert("Error leyendo CSV: " + err.message);
    }
  });
}

// ---------- Demo ----------
function loadDemo(){
  showLoader("Cargando demo…","Generando datos sintéticos para presentación");
  const base = new Date(2026, 1, 1);
  RAW_ROWS = [];
  const names = ["adan","carlos","marta"];

  for(let i=0;i<18;i++){
    const d = new Date(base.getTime() + i*24*3600*1000);
    const iso = `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;

    const minutes = 860 + Math.round(Math.random()*220);
    const km = 210 + Math.random()*160;
    const services = 14 + Math.round(Math.random()*14);
    const gross = 210 + Math.random()*180;
    const visa = gross*(0.7 + Math.random()*0.25);
    const cash = gross - visa;

    RAW_ROWS.push({
      Nombre_del_conductor: names[i % names.length],
      Fecha_de_Jornada: iso,
      Minutos_trabajados: String(minutes),
      Km_recorridos: String(fmtNum(km,2)).replace(".", ","),
      Numero_de_servicios: String(services),
      Cierre_de_TAXIMETRO: String(fmtNum(gross,2)).replace(".", ","),
      Cierre_de_VISA: String(fmtNum(visa,2)).replace(".", ","),
      Efectivo: String(fmtNum(cash,2)).replace(".", ","),
      Propinas_en_Visa: "0,00",
      Neto_con_propina: String(fmtNum(gross*0.45,2)).replace(".", ","),
      Ganancia_Neta_del_Jefe: String(fmtNum(gross*0.55,2)).replace(".", ","),
      Gastos_del_dia: "0,00"
    });
  }

  CLEAN_ROWS = RAW_ROWS.map(normalizeRow).filter(r=>r.date && r.hours>0);
  buildYearOptions();
  setDefaultDates();

  buildDriverOptions();
  buildExportDriverOptions();

  applyFilters();
  hideLoader();

  toast("info","Demo lista","Datos demo cargados. Cambia la vista o filtra por rango.");
}

// ---------- Eventos ----------
els.fileInput.addEventListener("change", (e)=>{
  const f = e.target.files?.[0];
  if(!f) return;
  loadCsvFile(f);
});
els.btnDemoData.addEventListener("click", loadDemo);

els.filterMode.addEventListener("change", ()=>{
  const mode = els.filterMode.value;
  els.monthField.classList.toggle("hidden", mode!=="month");
  els.yearField.classList.toggle("hidden", mode!=="year");
  els.rangeField.classList.toggle("hidden", mode!=="range");
});

els.viewMode.addEventListener("change", ()=>{
  buildDriverOptions();
  buildExportDriverOptions();
  applyFilters();
});

els.driverSelect?.addEventListener("change", applyFilters);
els.applyBtn.addEventListener("click", applyFilters);
els.recalcGoalBtn.addEventListener("click", computeGoalProgress);

// export flota completa
els.exportFleetBtn?.addEventListener("click", exportUniversalAnalysis);

// ✅ NUEVO: export conductor desde flota
els.exportDriverBtn?.addEventListener("click", ()=>{
  const name = els.exportDriverSelect?.value;
  exportOneDriverFromFleet(name);
});

(() => {
  els.filterMode.dispatchEvent(new Event("change"));
  if(els.exportFleetBtn) els.exportFleetBtn.disabled = true;
  if(els.exportDriverBtn) els.exportDriverBtn.disabled = true;
})();
