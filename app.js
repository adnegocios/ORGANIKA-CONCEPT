(function(){
  const agg = JSON.parse(document.getElementById('app-data-agg').textContent);
  const top10 = JSON.parse(document.getElementById('app-data-top10').textContent);
  const ventasRaw = JSON.parse(document.getElementById('app-data-ventasraw').textContent);
  const comprasRaw = JSON.parse(document.getElementById('app-data-comprasraw').textContent);
  const presupuestoRaw = JSON.parse(document.getElementById('app-data-presupuesto').textContent);

  const fmtUSD0 = new Intl.NumberFormat('es-EC', { style:'currency', currency:'USD', maximumFractionDigits:0 });
  const fmtUSD2 = new Intl.NumberFormat('es-EC', { style:'currency', currency:'USD', maximumFractionDigits:2 });
  const fmtNum = new Intl.NumberFormat('es-EC', { maximumFractionDigits:0 });
  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  function monthLabel(ym){
    const [y,m] = ym.split('-');
    return MESES[parseInt(m,10)-1] + " '" + y.slice(2);
  }
  function weekLabel(iso){
    const [y,m,d] = iso.split('-');
    return d + ' ' + MESES[parseInt(m,10)-1] + " '" + y.slice(2);
  }
  function addDaysISO(iso, days){
    const dt = new Date(iso + 'T00:00:00');
    dt.setDate(dt.getDate() + days);
    return dt.toISOString().slice(0,10);
  }

  // ---------- theme colors (read CSS vars so charts follow light/dark) ----------
  const css = getComputedStyle(document.documentElement);
  const cvar = (name) => css.getPropertyValue(name).trim();
  const inkColor = () => getComputedStyle(document.body).getPropertyValue('--ink-2').trim() || cvar('--ink-2');
  const gridColor = () => cvar('--grid');
  const s1 = cvar('--s1'), s2 = cvar('--s2'), s3 = cvar('--s3'), s4 = cvar('--s4');

  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = inkColor();

  // ================= KPI builders =================
  function kpiCard(label, value, sub, accent){
    const div = document.createElement('div');
    div.className = 'kpi' + (accent ? ' accent' : '');
    div.innerHTML = `<div class="label">${label}</div><div class="value num">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}`;
    return div;
  }

  // ================= Top 10 productos / servicios =================
  function renderTop10(containerId, items, color){
    const el = document.getElementById(containerId);
    const max = Math.max(...items.map(i => i.unidades));
    items.forEach((item, idx) => {
      const pct = max ? (item.unidades / max * 100) : 0;
      const div = document.createElement('div');
      div.className = 'top-item';
      div.innerHTML = `
        <div class="t-head">
          <span class="t-rank">${idx+1}</span>
          <span class="t-name" title="${item.nombre}">${item.nombre}</span>
          <span class="t-value num">${fmtNum.format(item.unidades)} uds</span>
        </div>
        <span class="rank-track"><span class="rank-fill" style="width:${pct}%; background:${color}"></span></span>
        <div class="t-sub num">${fmtUSD0.format(item.ventas)} en ventas · ${fmtNum.format(item.transacciones)} transacciones</div>`;
      el.appendChild(div);
    });
  }
  renderTop10('top-productos', top10.productos, s2);
  renderTop10('top-servicios', top10.servicios, s4);

  // ================= Tabs =================
  const tabBtns = Array.from(document.querySelectorAll('.tab-btn'));
  const panels = Array.from(document.querySelectorAll('[data-tab-panel]'));
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.setAttribute('aria-selected', b === btn ? 'true' : 'false'));
      panels.forEach(p => { p.hidden = p.getAttribute('data-tab-panel') !== btn.dataset.tab; });
      Object.values(charts).forEach(c => c && c.resize());
    });
  });

  // ================= Charts =================
  const charts = {};
  const gridC = gridColor();
  const tickC = inkColor();

  function baseScales(yTicksCallback){
    return {
      x: { grid: { display:false }, ticks: { color: tickC, maxRotation:0, autoSkip:true } },
      y: { grid: { color: gridC }, border: { display:false }, ticks: { color: tickC, callback: yTicksCallback } }
    };
  }

  charts.resumen = new Chart(document.getElementById('chart-resumen'), {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        { label: 'Ventas', data: [], backgroundColor: s1, borderRadius: 3, maxBarThickness: 14 },
        { label: 'Compras', data: [], backgroundColor: s2, borderRadius: 3, maxBarThickness: 14 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display:false }, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtUSD0.format(ctx.parsed.y)}` } } },
      scales: baseScales(v => fmtUSD0.format(v))
    }
  });

  charts.ventas = new Chart(document.getElementById('chart-ventas'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Ventas', data: [],
        borderColor: s1, backgroundColor: s1 + '26', fill: true, tension: 0.3,
        pointRadius: 0, pointHoverRadius: 4, borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display:false }, tooltip: { callbacks: { label: (ctx) => `Ventas: ${fmtUSD0.format(ctx.parsed.y)}` } } },
      scales: baseScales(v => fmtUSD0.format(v))
    }
  });

  charts.presupuesto = new Chart(document.getElementById('chart-presupuesto'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Ventas reales', data: [], borderColor: s1, backgroundColor: s1 + '26', fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 },
        { label: 'Punto de equilibrio', data: [], borderColor: s2, backgroundColor: 'transparent', borderDash: [5,4], fill: false, tension: 0, pointRadius: 0, borderWidth: 1.5 },
        { label: 'Meta comercial', data: [], borderColor: s4, backgroundColor: 'transparent', borderDash: [5,4], fill: false, tension: 0, pointRadius: 0, borderWidth: 1.5 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display:false }, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtUSD0.format(ctx.parsed.y)}` } } },
      scales: baseScales(v => fmtUSD0.format(v))
    }
  });

  // ================= Ventas tab: filtro por año / mes + Top 10 clientes =================
  const MESES_CAP = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const elNote = document.getElementById('ventas-filter-note');
  const elChartTitle = document.getElementById('chart-ventas-title');
  const elChartSub = document.getElementById('chart-ventas-sub');
  const kpiVentasEl = document.getElementById('kpi-ventas');
  const rankAniosEl = document.getElementById('rank-anios-ventas');
  const topClientesEl = document.getElementById('top-clientes');
  const anioRowEl = document.getElementById('anio-pills');
  const mesRowEl = document.getElementById('mes-pills');
  const anioAllBtn = anioRowEl.querySelector('[data-role="all"]');
  const mesAllBtn = mesRowEl.querySelector('[data-role="all"]');

  // Build the year pill list from the data's actual range
  const allYears = Array.from(new Set(ventasRaw.map(r => r.f.slice(0,4)))).sort();
  const anioPills = allYears.map(anio => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'pill'; btn.dataset.value = anio;
    btn.setAttribute('aria-pressed', 'true'); btn.textContent = anio;
    anioRowEl.appendChild(btn);
    return btn;
  });
  const mesPills = MESES_CAP.map((nombre, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'pill'; btn.dataset.value = String(idx+1);
    btn.setAttribute('aria-pressed', 'true'); btn.textContent = nombre;
    mesRowEl.appendChild(btn);
    return btn;
  });

  function togglePill(btn){
    const pressed = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', pressed ? 'false' : 'true');
  }

  function syncAllPill(allBtn, pills){
    const allOn = pills.every(b => b.getAttribute('aria-pressed') === 'true');
    allBtn.setAttribute('aria-pressed', allOn ? 'true' : 'false');
  }

  function toggleAllPill(allBtn, pills){
    const allOn = pills.every(b => b.getAttribute('aria-pressed') === 'true');
    const next = allOn ? 'false' : 'true';
    pills.forEach(b => b.setAttribute('aria-pressed', next));
    allBtn.setAttribute('aria-pressed', next);
  }

  anioAllBtn.addEventListener('click', () => { toggleAllPill(anioAllBtn, anioPills); renderVentasTab(); });
  mesAllBtn.addEventListener('click', () => { toggleAllPill(mesAllBtn, mesPills); renderVentasTab(); });
  anioPills.forEach(b => b.addEventListener('click', () => { togglePill(b); syncAllPill(anioAllBtn, anioPills); renderVentasTab(); }));
  mesPills.forEach(b => b.addEventListener('click', () => { togglePill(b); syncAllPill(mesAllBtn, mesPills); renderVentasTab(); }));

  function selectedSet(pills){
    return new Set(pills.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.value));
  }

  function describeSelection(selYears, selMeses){
    const aniosTxt = selYears.size === allYears.length ? 'Todos' : (Array.from(selYears).sort().join(', ') || 'ninguno');
    const mesesTxt = selMeses.size === 12 ? 'Todos' : (Array.from(selMeses).map(m => MESES_CAP[parseInt(m,10)-1]).join(', ') || 'ninguno');
    return `Año: ${aniosTxt} · Mes: ${mesesTxt}`;
  }

  function computeVentasAgg(selYears, selMeses){
    const byMonth = new Map();
    const byDay = new Map();
    const byYear = new Map();
    const byClient = new Map();
    let total = 0, n = 0;
    for (const r of ventasRaw){
      const y = r.f.slice(0,4);
      const m = String(parseInt(r.f.slice(5,7),10));
      if (!selYears.has(y) || !selMeses.has(m)) continue;
      const ym = r.f.slice(0,7);
      byMonth.set(ym, (byMonth.get(ym)||0) + r.t);
      byDay.set(r.f, (byDay.get(r.f)||0) + r.t);
      byYear.set(y, (byYear.get(y)||0) + r.t);
      const c = byClient.get(r.c) || { total:0, n:0 };
      c.total += r.t; c.n += 1;
      byClient.set(r.c, c);
      total += r.t; n += 1;
    }
    return { byMonth, byDay, byYear, byClient, total, n };
  }

  function renderVentasTab(){
    const selYears = selectedSet(anioPills);
    const selMeses = selectedSet(mesPills);
    const a = computeVentasAgg(selYears, selMeses);
    const ticket = a.n ? a.total / a.n : 0;
    const desc = describeSelection(selYears, selMeses);

    // KPI cards
    let mejorMes = null, mejorMesTotal = -1;
    for (const [ym, t] of a.byMonth) { if (t > mejorMesTotal) { mejorMesTotal = t; mejorMes = ym; } }

    kpiVentasEl.innerHTML = '';
    kpiVentasEl.append(
      kpiCard('Ventas totales', fmtUSD0.format(a.total), desc, true),
      kpiCard('Comprobantes emitidos', a.n.toLocaleString('es-EC')),
      kpiCard('Ticket promedio', fmtUSD2.format(ticket)),
      kpiCard('Mejor mes', mejorMes ? monthLabel(mejorMes) : '—', mejorMes ? fmtUSD0.format(mejorMesTotal) : '')
    );

    // Chart: monthly evolution by default; daily when a specific month (or months) is filtered
    const dailyMode = selMeses.size < 12;
    if (dailyMode){
      const days = Array.from(a.byDay.keys()).sort();
      charts.ventas.data.labels = days.map(weekLabel);
      charts.ventas.data.datasets[0].data = days.map(d => a.byDay.get(d));
      elChartTitle.textContent = 'Evolución diaria de ventas';
      elChartSub.textContent = `Total facturado por día · ${desc}.`;
    } else {
      const months = Array.from(a.byMonth.keys()).sort();
      charts.ventas.data.labels = months.map(monthLabel);
      charts.ventas.data.datasets[0].data = months.map(m => a.byMonth.get(m));
      elChartTitle.textContent = 'Evolución mensual de ventas';
      elChartSub.textContent = `Total facturado por mes · ${desc}.`;
    }
    charts.ventas.update();

    // Ranking: ventas por año (dentro de la selección)
    rankAniosEl.innerHTML = '';
    const years = Array.from(a.byYear.keys()).sort();
    const maxAnio = Math.max(...years.map(y => a.byYear.get(y)), 0);
    years.forEach(anio => {
      const total = a.byYear.get(anio);
      const pct = maxAnio ? (total / maxAnio * 100) : 0;
      const row = document.createElement('div');
      row.className = 'rank-row';
      row.innerHTML = `
        <div class="rlabel">${anio}</div>
        <span class="rank-track"><span class="rank-fill" style="width:${pct}%; background:${s1}"></span></span>
        <div class="rvalue num">${fmtUSD0.format(total)}</div>`;
      rankAniosEl.appendChild(row);
    });
    if (!years.length) rankAniosEl.innerHTML = '<p class="panel-sub">Sin datos en la selección actual.</p>';

    // Top 10 clientes
    topClientesEl.innerHTML = '';
    const clientes = Array.from(a.byClient.entries())
      .map(([nombre, v]) => ({ nombre, total: v.total, n: v.n }))
      .sort((x,y) => y.total - x.total)
      .slice(0, 10);
    const maxCliente = Math.max(...clientes.map(c => c.total), 0);
    clientes.forEach((c, idx) => {
      const pct = maxCliente ? (c.total / maxCliente * 100) : 0;
      const div = document.createElement('div');
      div.className = 'top-item';
      div.innerHTML = `
        <div class="t-head">
          <span class="t-rank">${idx+1}</span>
          <span class="t-name" title="${c.nombre}">${c.nombre}</span>
          <span class="t-value num">${fmtUSD0.format(c.total)}</span>
        </div>
        <span class="rank-track"><span class="rank-fill" style="width:${pct}%; background:${s2}"></span></span>
        <div class="t-sub num">${fmtNum.format(c.n)} compra${c.n===1?'':'s'}</div>`;
      topClientesEl.appendChild(div);
    });
    if (!clientes.length) topClientesEl.innerHTML = '<p class="panel-sub">Sin datos en la selección actual.</p>';

    elNote.textContent = `${a.n.toLocaleString('es-EC')} comprobantes en la selección`;
  }

  renderVentasTab();

  // ================= Compras tab: filtro por año / mes =================
  const elComprasNote = document.getElementById('compras-filter-note');
  const elResumenSub = document.getElementById('chart-resumen-sub');
  const elProveedoresSub = document.getElementById('proveedores-sub');
  const kpiResumenEl = document.getElementById('kpi-resumen');
  const rankProvEl = document.getElementById('rank-proveedores');
  const anioRowElC = document.getElementById('anio-pills-compras');
  const mesRowElC = document.getElementById('mes-pills-compras');
  const anioAllBtnC = anioRowElC.querySelector('[data-role="all"]');
  const mesAllBtnC = mesRowElC.querySelector('[data-role="all"]');

  const allYearsC = Array.from(new Set([...ventasRaw, ...comprasRaw].map(r => r.f.slice(0,4)))).sort();
  const anioPillsC = allYearsC.map(anio => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'pill'; btn.dataset.value = anio;
    btn.setAttribute('aria-pressed', 'true'); btn.textContent = anio;
    anioRowElC.appendChild(btn);
    return btn;
  });
  const mesPillsC = MESES_CAP.map((nombre, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'pill'; btn.dataset.value = String(idx+1);
    btn.setAttribute('aria-pressed', 'true'); btn.textContent = nombre;
    mesRowElC.appendChild(btn);
    return btn;
  });

  anioAllBtnC.addEventListener('click', () => { toggleAllPill(anioAllBtnC, anioPillsC); renderComprasTab(); });
  mesAllBtnC.addEventListener('click', () => { toggleAllPill(mesAllBtnC, mesPillsC); renderComprasTab(); });
  anioPillsC.forEach(b => b.addEventListener('click', () => { togglePill(b); syncAllPill(anioAllBtnC, anioPillsC); renderComprasTab(); }));
  mesPillsC.forEach(b => b.addEventListener('click', () => { togglePill(b); syncAllPill(mesAllBtnC, mesPillsC); renderComprasTab(); }));

  function describeSelectionC(selYears, selMeses){
    const aniosTxt = selYears.size === allYearsC.length ? 'Todos' : (Array.from(selYears).sort().join(', ') || 'ninguno');
    const mesesTxt = selMeses.size === 12 ? 'Todos' : (Array.from(selMeses).map(m => MESES_CAP[parseInt(m,10)-1]).join(', ') || 'ninguno');
    return `Año: ${aniosTxt} · Mes: ${mesesTxt}`;
  }

  function computeComprasAgg(selYears, selMeses){
    const byMonthV = new Map(), byMonthC = new Map(), byProv = new Map();
    let vTotal = 0, vN = 0, cTotal = 0, cN = 0;
    for (const r of ventasRaw){
      const y = r.f.slice(0,4), m = String(parseInt(r.f.slice(5,7),10));
      if (!selYears.has(y) || !selMeses.has(m)) continue;
      const ym = r.f.slice(0,7);
      byMonthV.set(ym, (byMonthV.get(ym)||0) + r.t);
      vTotal += r.t; vN += 1;
    }
    for (const r of comprasRaw){
      const y = r.f.slice(0,4), m = String(parseInt(r.f.slice(5,7),10));
      if (!selYears.has(y) || !selMeses.has(m)) continue;
      const ym = r.f.slice(0,7);
      byMonthC.set(ym, (byMonthC.get(ym)||0) + r.t);
      byProv.set(r.p, (byProv.get(r.p)||0) + r.t);
      cTotal += r.t; cN += 1;
    }
    return { byMonthV, byMonthC, byProv, vTotal, vN, cTotal, cN };
  }

  function renderComprasTab(){
    const selYears = selectedSet(anioPillsC);
    const selMeses = selectedSet(mesPillsC);
    const a = computeComprasAgg(selYears, selMeses);
    const desc = describeSelectionC(selYears, selMeses);
    const margen = a.vTotal - a.cTotal;
    const margenPct = a.vTotal ? (margen / a.vTotal * 100) : 0;
    const vTicket = a.vN ? a.vTotal / a.vN : 0;
    const cTicket = a.cN ? a.cTotal / a.cN : 0;

    kpiResumenEl.innerHTML = '';
    kpiResumenEl.append(
      kpiCard('Ventas totales', fmtUSD0.format(a.vTotal), a.vN.toLocaleString('es-EC') + ' comprobantes', true),
      kpiCard('Compras totales', fmtUSD0.format(a.cTotal), a.cN.toLocaleString('es-EC') + ' facturas'),
      kpiCard('Diferencia venta – compra', fmtUSD0.format(margen), `<span class="${margen>=0?'good':'critical'}">${margenPct.toFixed(1)}% sobre ventas</span>`),
      kpiCard('Ticket promedio venta', fmtUSD2.format(vTicket))
    );

    // Chart: Ventas vs Compras por mes (unión de meses presentes en la selección)
    const months = Array.from(new Set([...a.byMonthV.keys(), ...a.byMonthC.keys()])).sort();
    charts.resumen.data.labels = months.map(monthLabel);
    charts.resumen.data.datasets[0].data = months.map(m => a.byMonthV.get(m) || 0);
    charts.resumen.data.datasets[1].data = months.map(m => a.byMonthC.get(m) || 0);
    charts.resumen.update();
    elResumenSub.textContent = `Comparación mensual · ${desc}.`;

    // Top 10 proveedores (dentro de la selección)
    rankProvEl.innerHTML = '';
    const proveedores = Array.from(a.byProv.entries())
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((x,y) => y.total - x.total)
      .slice(0, 10);
    const maxProv = Math.max(...proveedores.map(p => p.total), 0);
    proveedores.forEach(p => {
      const pct = maxProv ? (p.total / maxProv * 100) : 0;
      const row = document.createElement('div');
      row.className = 'rank-row';
      row.title = p.nombre;
      row.innerHTML = `
        <div class="rlabel">${p.nombre}</div>
        <span class="rank-track"><span class="rank-fill" style="width:${pct}%; background:${s3}"></span></span>
        <div class="rvalue num">${fmtUSD0.format(p.total)}</div>`;
      rankProvEl.appendChild(row);
    });
    if (!proveedores.length) rankProvEl.innerHTML = '<p class="panel-sub">Sin datos en la selección actual.</p>';
    elProveedoresSub.textContent = `Proveedores con mayor monto acumulado de compras · ${desc}.`;

    elComprasNote.textContent = `${a.cN.toLocaleString('es-EC')} facturas de compra en la selección`;
  }

  renderComprasTab();

  // ================= Presupuesto tab: filtro por año / mes =================
  // Índice diario de ventas para sumar rápido por semana (día a día, máx. 7 iteraciones por semana)
  const dailyVentas = new Map();
  ventasRaw.forEach(r => dailyVentas.set(r.f, (dailyVentas.get(r.f)||0) + r.t));

  function ventasEnSemana(desde, hasta){
    let total = 0;
    let d = desde;
    while (d <= hasta){
      total += dailyVentas.get(d) || 0;
      d = addDaysISO(d, 1);
    }
    return total;
  }

  const elPresupuestoNote = document.getElementById('presupuesto-filter-note');
  const elChartPresupuestoSub = document.getElementById('chart-presupuesto-sub');
  const elSemanasRiesgoSub = document.getElementById('semanas-riesgo-sub');
  const kpiPresupuestoEl = document.getElementById('kpi-presupuesto');
  const semanasRiesgoEl = document.getElementById('semanas-riesgo');
  const anioRowElP = document.getElementById('anio-pills-presupuesto');
  const mesRowElP = document.getElementById('mes-pills-presupuesto');
  const anioAllBtnP = anioRowElP.querySelector('[data-role="all"]');
  const mesAllBtnP = mesRowElP.querySelector('[data-role="all"]');

  const allYearsP = Array.from(new Set(presupuestoRaw.map(w => w.desde.slice(0,4)))).sort();
  const anioPillsP = allYearsP.map(anio => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'pill'; btn.dataset.value = anio;
    btn.setAttribute('aria-pressed', 'true'); btn.textContent = anio;
    anioRowElP.appendChild(btn);
    return btn;
  });
  const mesPillsP = MESES_CAP.map((nombre, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'pill'; btn.dataset.value = String(idx+1);
    btn.setAttribute('aria-pressed', 'true'); btn.textContent = nombre;
    mesRowElP.appendChild(btn);
    return btn;
  });

  anioAllBtnP.addEventListener('click', () => { toggleAllPill(anioAllBtnP, anioPillsP); renderPresupuestoTab(); });
  mesAllBtnP.addEventListener('click', () => { toggleAllPill(mesAllBtnP, mesPillsP); renderPresupuestoTab(); });
  anioPillsP.forEach(b => b.addEventListener('click', () => { togglePill(b); syncAllPill(anioAllBtnP, anioPillsP); renderPresupuestoTab(); }));
  mesPillsP.forEach(b => b.addEventListener('click', () => { togglePill(b); syncAllPill(mesAllBtnP, mesPillsP); renderPresupuestoTab(); }));

  function describeSelectionP(selYears, selMeses){
    const aniosTxt = selYears.size === allYearsP.length ? 'Todos' : (Array.from(selYears).sort().join(', ') || 'ninguno');
    const mesesTxt = selMeses.size === 12 ? 'Todos' : (Array.from(selMeses).map(m => MESES_CAP[parseInt(m,10)-1]).join(', ') || 'ninguno');
    return `Año: ${aniosTxt} · Mes: ${mesesTxt}`;
  }

  function renderPresupuestoTab(){
    const selYears = selectedSet(anioPillsP);
    const selMeses = selectedSet(mesPillsP);
    const desc = describeSelectionP(selYears, selMeses);

    const semanas = presupuestoRaw
      .filter(w => selYears.has(w.desde.slice(0,4)) && selMeses.has(String(parseInt(w.desde.slice(5,7),10))))
      .map(w => ({ ...w, ventas: ventasEnSemana(w.desde, w.hasta) }));

    const sumVentas = semanas.reduce((acc,w) => acc + w.ventas, 0);
    const sumMeta = semanas.reduce((acc,w) => acc + w.meta, 0);
    const sumPE = semanas.reduce((acc,w) => acc + w.pe, 0);
    const cumplMeta = sumMeta ? (sumVentas / sumMeta * 100) : 0;
    const cumplPE = sumPE ? (sumVentas / sumPE * 100) : 0;
    const bajoPE = semanas.filter(w => w.ventas < w.pe).length;

    kpiPresupuestoEl.innerHTML = '';
    kpiPresupuestoEl.append(
      kpiCard('Ventas reales', fmtUSD0.format(sumVentas), desc, true),
      kpiCard('Meta comercial', fmtUSD0.format(sumMeta), `<span class="${cumplMeta>=100?'good':'critical'}">${cumplMeta.toFixed(1)}% cumplido</span>`),
      kpiCard('Punto de equilibrio', fmtUSD0.format(sumPE), `<span class="${cumplPE>=100?'good':'critical'}">${cumplPE.toFixed(1)}% cumplido</span>`),
      kpiCard('Semanas bajo punto de equilibrio', bajoPE.toLocaleString('es-EC'), `de ${semanas.length.toLocaleString('es-EC')} semanas`)
    );

    charts.presupuesto.data.labels = semanas.map(w => weekLabel(w.desde));
    charts.presupuesto.data.datasets[0].data = semanas.map(w => w.ventas);
    charts.presupuesto.data.datasets[1].data = semanas.map(w => w.pe);
    charts.presupuesto.data.datasets[2].data = semanas.map(w => w.meta);
    charts.presupuesto.update();
    elChartPresupuestoSub.textContent = `Comparación semanal · ${desc}.`;

    semanasRiesgoEl.innerHTML = '';
    const riesgo = semanas
      .filter(w => w.ventas < w.pe)
      .map(w => ({ ...w, deficit: w.pe - w.ventas }))
      .sort((a,b) => b.deficit - a.deficit)
      .slice(0, 10);
    const maxDeficit = Math.max(...riesgo.map(w => w.deficit), 0);
    riesgo.forEach((w, idx) => {
      const pct = maxDeficit ? (w.deficit / maxDeficit * 100) : 0;
      const label = `${weekLabel(w.desde)} – ${weekLabel(w.hasta)}`;
      const div = document.createElement('div');
      div.className = 'top-item';
      div.innerHTML = `
        <div class="t-head">
          <span class="t-rank">${idx+1}</span>
          <span class="t-name" title="${label}">${label}</span>
          <span class="t-value num">-${fmtUSD0.format(w.deficit)}</span>
        </div>
        <span class="rank-track"><span class="rank-fill" style="width:${pct}%; background:${s2}"></span></span>
        <div class="t-sub num">Ventas: ${fmtUSD0.format(w.ventas)} · Punto de equilibrio: ${fmtUSD0.format(w.pe)}</div>`;
      semanasRiesgoEl.appendChild(div);
    });
    if (!riesgo.length && semanas.length) {
      semanasRiesgoEl.innerHTML = '<p class="panel-sub">Todas las semanas de la selección superaron el punto de equilibrio.</p>';
    } else if (!semanas.length) {
      semanasRiesgoEl.innerHTML = '<p class="panel-sub">Sin datos en la selección actual.</p>';
    }
    elSemanasRiesgoSub.textContent = `${bajoPE} de ${semanas.length} semanas de la selección no alcanzaron el punto de equilibrio.`;

    elPresupuestoNote.textContent = `${semanas.length.toLocaleString('es-EC')} semanas en la selección`;
  }

  renderPresupuestoTab();

  // Encabezado: fechas de corte calculadas desde los datos
  (function(){
    const maxF = (rows) => rows.reduce((m, r) => r.f > m ? r.f : m, '');
    const lab = (iso) => MESES[parseInt(iso.slice(5,7),10)-1] + ' ' + iso.slice(0,4);
    const v = lab(maxF(ventasRaw)), c = lab(maxF(comprasRaw));
    const badge = document.querySelector('.badge');
    if (badge) badge.lastChild.textContent = (v === c) ? ' Ventas y compras hasta ' + v : ' Ventas hasta ' + v + ' · Compras hasta ' + c;
  })();
})();
