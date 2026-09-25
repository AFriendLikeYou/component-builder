(() => {
  // Aktie: Kurs, Verlauf und Kennzahlen. Kurse stehen als Zahlen in data und werden erst beim Rendern deutsch formatiert.
  // Die Farbe folgt der Richtung: im ZDS Grün/Rot aus den Status-Tokens, in der Fabrik fällt sie auf --c-accent/--c-warm zurück.
  // Die Kartenhöhe ist fest; die Höhe des Charts rechnet sich aus dem Innenabstand des Regelwerks.
  const RANGES = [['1T', '1 Tag'], ['1W', '1 Woche'], ['1M', '1 Monat'], ['1J', '1 Jahr'], ['5J', '5 Jahre']];
  const num = (n, dg = 2) => Number(n).toLocaleString('de-DE', { minimumFractionDigits: dg, maximumFractionDigits: dg });
  const signed = (n, dg = 2) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${num(Math.abs(n), dg)}`;
  const pct = (a, b) => (b ? (a - b) / b * 100 : 0);
  const dir = n => (n > 0 ? 'is-up' : n < 0 ? 'is-down' : 'is-flat');
  const f = n => n.toFixed(1);
  let uid = 0;

  const inner = (h, H) => ({ w: h.width - 2 * h.S.inset, h: H - 2 * h.S.inset });
  const rangeName = d => (RANGES.find(r => r[0] === d.range) || RANGES[2])[1];

  const head = (d, h, right) => `
    <div class="row between g-16 ak-head" data-area="text:kopf">
      <p class="t-16 w-500 clip">${h.esc(d.name)}</p>
      ${right ?? `<p class="t-12 ink-2 clip">${h.esc(d.code)} · ${h.esc(d.exchange)}</p>`}
    </div>`;

  // Veränderung mit Pfeil: ↗ steigt, ↘ fällt, → unverändert. Nie nur über die Farbe.
  const delta = (h, n, text, cls = 't-16 w-500') =>
    `<p class="${cls} ak-delta ${dir(n)}">${h.icon(n ? 'arrow-up-right' : 'arrow-right', 16)}<span class="clip">${text}</span></p>`;

  // Werte in die Fläche x0…x1 × y0…y1 legen (hi oben). Kurse als gerade Strecken, nicht geglättet.
  const place = (v, { x1, y0, y1, lo, hi }) => v.map((x, i) => [
    v.length > 1 ? i * x1 / (v.length - 1) : x1 / 2,
    hi === lo ? (y0 + y1) / 2 : y0 + (hi - x) / (hi - lo) * (y1 - y0),
  ]);
  const pathOf = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join(' ');
  const wash = id => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" class="ak-stop" style="stop-opacity:.16"/><stop offset="1" class="ak-stop" style="stop-opacity:0"/>
  </linearGradient></defs>`;
  // Runde Rasterschritte: 1, 2, 2,5, 5 × 10^n, der nächste zu einem Drittel der Spanne
  const nice = raw => {
    if (!(raw > 0)) return 1;
    const p = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].map(k => k * p).reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a));
  };

  const empty = (H, text) => `
    <div class="ak-empty" style="height:${H}px" data-area="media:verlauf">
      <p class="t-12 ink-2">${text}</p>
    </div>`;

  // Kleine Kurve für „Kurs“: Fläche bis zum Boden, Endpunkt mit Ring
  function spark(s, w, H) {
    const v = s.map(p => p.v);
    const pts = place(v, { x1: w - 6, y0: 6, y1: H - 12, lo: Math.min(...v), hi: Math.max(...v) });
    const id = `ak-g${++uid}`, line = pathOf(pts), last = pts[pts.length - 1];
    return `<svg class="ak-svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" aria-hidden="true">
      ${wash(id)}
      <path d="${line} L${f(last[0])} ${H} L0 ${H} Z" fill="url(#${id})"/>
      <line x1="0" y1="${H - 0.5}" x2="${w}" y2="${H - 0.5}" class="ak-grid"/>
      <path d="${line}" class="ak-line"/>
      <circle cx="${f(last[0])}" cy="${f(last[1])}" r="4" class="ak-end"/>
    </svg>`;
  }

  // Großer Chart für „Verlauf“: Raster mit runden Werten rechts, Datum unten, Schlusskurs am Linienende,
  // darüber je Handelstag eine unsichtbare Spalte mit Fadenkreuz und Wert beim Überfahren.
  function chart(s, w, H, h) {
    const v = s.map(p => p.v), lo = Math.min(...v), hi = Math.max(...v);
    const step = nice((hi - lo) / 3), dg = Number.isInteger(step) ? 0 : Number.isInteger(step * 10) ? 1 : 2;
    let a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
    if (b - a < step / 2) b = a + step;
    const pw = w - 48, top = 8, pb = H - 26;
    const Y = t => top + (b - t) / (b - a) * (pb - top);
    const pts = place(v, { x1: pw, y0: top, y1: pb, lo: a, hi: b });
    const id = `ak-g${++uid}`, line = pathOf(pts), last = pts[pts.length - 1];
    const ticks = [];
    for (let t = a; t <= b + step / 1000; t += step) ticks.push(t);
    const xs = [...new Set([0, Math.round((v.length - 1) / 3), Math.round(2 * (v.length - 1) / 3), v.length - 1])];
    const anchor = i => (i === 0 ? 'start' : i === v.length - 1 ? 'end' : 'middle');
    const dx = pw / Math.max(1, v.length - 1);
    const cols = pts.map(([x, y], i) => {
      const l = Math.max(0, x - dx / 2), r = Math.min(pw, x + dx / 2);
      return `<span class="ak-col${x > pw / 2 ? ' is-r' : ''}" style="left:${f(l)}px;width:${f(r - l)}px;--cx:${f(x - l)}px;--y:${f(y)}px"><span class="ak-tip t-12 num">${h.esc(s[i].d)} · ${num(s[i].v)}</span></span>`;
    }).join('');
    return `<svg class="ak-svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" aria-hidden="true">
      ${wash(id)}
      ${ticks.map(t => `<line x1="0" y1="${Math.round(Y(t)) + 0.5}" x2="${pw}" y2="${Math.round(Y(t)) + 0.5}" class="ak-grid"/>`).join('')}
      ${ticks.filter(t => Math.abs(Y(t) - last[1]) >= 14).map(t => `<text x="${w}" y="${f(Y(t) + 4)}" text-anchor="end" class="t-12 num">${num(t, dg)}</text>`).join('')}
      <path d="${line} L${f(last[0])} ${f(pb)} L0 ${f(pb)} Z" fill="url(#${id})"/>
      <path d="${line}" class="ak-line"/>
      <circle cx="${f(last[0])}" cy="${f(last[1])}" r="4" class="ak-end"/>
      <text x="${f(last[0] + 8)}" y="${f(last[1] + 4)}" class="t-12 w-500 num ak-last">${num(v[v.length - 1])}</text>
      ${xs.map(i => `<text x="${f(pts[i][0])}" y="${H - 5}" text-anchor="${anchor(i)}" class="t-12 num">${h.esc(s[i].d)}</text>`).join('')}
    </svg>
    <div class="ak-hov" style="width:${pw}px;height:${f(pb)}px">${cols}</div>`;
  }

  // Tages- und 52-Wochen-Spanne: wie weit der Kurs vom Tief zum Hoch steht
  const span = (label, lo, hi, v) => {
    const p = hi > lo ? Math.min(1, Math.max(0, (v - lo) / (hi - lo))) : 0;
    return `
      <div class="ak-span">
        <p class="t-12 ink-2 clip">${label}</p>
        <p class="t-12 num">${num(lo)}</p>
        <div class="progress" style="--p: ${p.toFixed(2)}" role="img" aria-label="${label}: ${num(v)} zwischen ${num(lo)} und ${num(hi)}"><i></i></div>
        <p class="t-12 num">${num(hi)}</p>
      </div>`;
  };

  Factory.register({
    id: 'stock',
    name: 'Aktie',
    aliases: ['stock', 'aktie', 'aktienchart', 'aktienkurs', 'kurs', 'börse', 'boerse', 'ticker', 'apple', 'aapl', 'chart'],
    data: {
      name: 'Apple',
      code: 'AAPL',
      exchange: 'Nasdaq',
      unit: 'USD',
      price: 254.63,
      prev: 251.51,
      open: 252.04,
      high: 255.20,
      low: 251.36,
      lo52: 196.20,
      hi52: 258.40,
      volume: '48,2 Mio.',
      cap: '3,78 Bio.',
      pe: 38.6,
      yield: 0.41,
      range: '1M',
      series: [
        { d: '26.08.', v: 238.41 }, { d: '27.08.', v: 239.87 }, { d: '28.08.', v: 241.12 }, { d: '31.08.', v: 240.35 },
        { d: '01.09.', v: 242.90 }, { d: '02.09.', v: 244.18 }, { d: '03.09.', v: 243.05 }, { d: '04.09.', v: 245.61 },
        { d: '08.09.', v: 246.92 }, { d: '09.09.', v: 242.30 }, { d: '10.09.', v: 239.74 }, { d: '11.09.', v: 240.88 },
        { d: '14.09.', v: 243.51 }, { d: '15.09.', v: 245.07 }, { d: '16.09.', v: 247.63 }, { d: '17.09.', v: 246.80 },
        { d: '18.09.', v: 249.42 }, { d: '21.09.', v: 250.15 }, { d: '22.09.', v: 248.96 }, { d: '23.09.', v: 251.37 },
        { d: '24.09.', v: 251.51 }, { d: '25.09.', v: 254.63 },
      ],
    },
    css: `
      /* Richtungsfarben. &.cf-card statt oberster Ebene: [data-c] trägt in der Schichten-Ansicht auch die ganze Zeile. */
      &.cf-card {
        --ak-up: var(--z-ds-color-background-success, var(--c-accent));
        --ak-down: var(--z-ds-color-error-70, var(--c-warm));
      }
      .is-up { --ak-c: var(--ak-up); }
      .is-down { --ak-c: var(--ak-down); }
      .is-flat { --ak-c: var(--c-ink-2); }
      .ak-c { color: var(--ak-c); }

      .ak-head > * { min-width: 0; }
      .ak-head > :last-child { flex: none; max-width: 50%; }
      .ak-delta { display: flex; align-items: center; min-width: 0; color: var(--ak-c); }
      .ak-delta .icon { margin-right: 2px; }
      .ak-delta.is-down .icon { transform: rotate(90deg); }

      .ak-svg { display: block; }
      .ak-stop { stop-color: var(--ak-c); }
      .ak-line { fill: none; stroke: var(--ak-c); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
      .ak-end { fill: var(--ak-c); stroke: var(--c-surface); stroke-width: 2; }
      .ak-grid { stroke: var(--c-line); stroke-width: 1; }
      .ak-svg text { fill: var(--c-ink-2); }
      .ak-svg .ak-last { fill: var(--c-ink); }
      .ak-empty { display: grid; place-items: center; border-radius: var(--r-8); background: var(--c-fill); }

      /* Kurs: Preis groß, Tagesveränderung darunter, Monatskurve als Fläche */
      .ak-k { display: flex; flex-direction: column; gap: 16px; }
      .ak-hero { display: grid; grid-template-rows: 56px 24px; }
      .ak-price { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
      .ak-plotbox { display: flex; flex-direction: column; gap: 8px; }
      .ak-foot { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 8px; height: 24px; }
      .ak-foot > :last-child { text-align: right; }

      /* Verlauf: Zeitraum oben, Chart mit Raster, Fadenkreuz beim Überfahren */
      .ak-v { display: flex; flex-direction: column; gap: 16px; }
      .ak-range { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
      .ak-range .toggle { padding: 0 8px; }
      .ak-plot { position: relative; }
      .ak-hov { position: absolute; left: 0; top: 0; cursor: crosshair; }
      .ak-col { position: absolute; top: 0; bottom: 0; }
      .ak-col:hover::before { content: ''; position: absolute; left: var(--cx); top: 0; bottom: 0; width: 1px; background: var(--c-ink-3); }
      .ak-col:hover::after { content: ''; position: absolute; left: calc(var(--cx) - 5px); top: calc(var(--y) - 5px); width: 10px; height: 10px; border-radius: 50%; background: var(--ak-c); box-shadow: 0 0 0 2px var(--c-surface); }
      .ak-tip { display: none; position: absolute; top: 0; left: calc(var(--cx) + 8px); height: 24px; padding: 0 8px; align-items: center; white-space: nowrap; border-radius: var(--r-8); background: var(--c-surface); box-shadow: 0 0 0 1px var(--c-line), 0 4px 12px -4px rgba(0, 0, 0, .16); }
      .ak-col.is-r .ak-tip { left: auto; right: calc(100% - var(--cx) + 8px); }
      .ak-col:hover .ak-tip { display: flex; }

      /* Kennzahlen: Kurs, Spannen als Balken, sechs Werte in drei Spalten */
      .ak-z { display: flex; flex-direction: column; gap: 16px; height: 100%; }
      .ak-row { height: 40px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .ak-spans { display: flex; flex-direction: column; gap: 8px; }
      .ak-span { display: grid; grid-template-columns: 64px auto minmax(0, 1fr) auto; align-items: center; column-gap: 8px; height: 24px; }
      .ak-facts { flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); column-gap: 16px; }
      .ak-fact { min-width: 0; padding-top: 8px; border-top: 1px solid var(--c-line); }
    `,
    layouts: [
      {
        id: 'kurs',
        name: 'Kurs',
        family: 'karte',
        idea: 'Der Kurs zuerst: 254,63 Dollar groß, darunter das Tagesplus mit Pfeil und der Monatsverlauf als leise Fläche.',
        height: 296,
        render: (d, h) => {
          const box = inner(h, 296), X = box.h - 168;
          const chg = d.price - d.prev, s = d.series;
          const ok = s.length > 1, pp = ok ? pct(s[s.length - 1].v, s[0].v) : 0;
          return `
          <div class="ak-k">
            ${head(d, h)}
            <div class="ak-hero" data-area="text:kurs">
              <div class="ak-price">
                <p class="t-48 w-500">${num(d.price)}</p>
                <p class="t-16 ink-2">${h.esc(d.unit)}</p>
              </div>
              <div class="row g-8">
                ${delta(h, chg, `${signed(chg)} (${signed(pct(d.price, d.prev))}&nbsp;%)`)}
                <p class="t-16 ink-2">heute</p>
              </div>
            </div>
            ${ok ? `
            <div class="ak-plotbox">
              <div class="${dir(pp)}" data-area="media:verlauf" role="img" aria-label="Kursverlauf ${rangeName(d)}: von ${num(s[0].v)} auf ${num(s[s.length - 1].v)} ${h.esc(d.unit)}">${spark(s, box.w, X)}</div>
              <div class="ak-foot" data-area="meta:zeitraum">
                <p class="t-12 ink-2 num">${h.esc(s[0].d)}</p>
                <p class="t-12 ink-2">${rangeName(d)} <span class="w-500 ak-c ${dir(pp)}">${signed(pp)}&nbsp;%</span></p>
                <p class="t-12 ink-2 num">${h.esc(s[s.length - 1].d)}</p>
              </div>
            </div>` : empty(X + 32, 'Noch kein Kursverlauf')}
          </div>`;
        },
      },
      {
        id: 'verlauf',
        name: 'Verlauf',
        family: 'karte',
        idea: 'Der Verlauf zuerst: ein großer Monatschart mit Raster und Schlusskurs am Linienende, darüber der Zeitraum; beim Überfahren zeigt ein Fadenkreuz jeden Handelstag.',
        height: 304,
        render: (d, h) => {
          const box = inner(h, 304), X = box.h - 88, s = d.series;
          const ok = s.length > 1, pp = ok ? pct(s[s.length - 1].v, s[0].v) : 0;
          return `
          <div class="ak-v">
            ${head(d, h, ok ? `<div class="row g-8"><p class="t-12 ink-2">${rangeName(d)}</p>${delta(h, pp, `${signed(pp)}&nbsp;%`)}</div>` : `<p class="t-12 ink-2 clip">${h.esc(d.code)}</p>`)}
            <div class="ak-range" data-area="control:zeitraum">
              ${RANGES.map(([k, name]) => `<button class="toggle t-14${k === d.range ? ' is-on' : ''}" aria-pressed="${k === d.range}" aria-label="${name}">${k}</button>`).join('')}
            </div>
            ${ok ? `
            <div class="ak-plot ${dir(pp)}" data-area="media:verlauf" role="img" aria-label="Kursverlauf ${rangeName(d)}: von ${num(s[0].v)} auf ${num(s[s.length - 1].v)} ${h.esc(d.unit)}">
              ${chart(s, box.w, X, h)}
            </div>` : empty(X, 'Noch kein Kursverlauf')}
          </div>`;
        },
      },
      {
        id: 'kennzahlen',
        name: 'Kennzahlen',
        family: 'karte',
        idea: 'Die Einordnung zuerst: wo der Kurs in der Tages- und Jahresspanne steht, darunter sechs Kennzahlen zum Nachschlagen.',
        height: 320,
        render: (d, h) => {
          const chg = d.price - d.prev;
          const facts = [
            ['Eröffnung', num(d.open)], ['Vortag', num(d.prev)], ['Volumen', h.esc(d.volume)],
            ['Börsenwert', h.esc(d.cap)], ['KGV', num(d.pe, 1)], ['Dividende', `${num(d.yield)}&nbsp;%`],
          ];
          return `
          <div class="ak-z">
            ${head(d, h)}
            <div class="ak-row" data-area="text:kurs">
              <div class="ak-price">
                <p class="t-32 w-500">${num(d.price)}</p>
                <p class="t-16 ink-2">${h.esc(d.unit)}</p>
              </div>
              ${delta(h, chg, `${signed(pct(d.price, d.prev))}&nbsp;%`)}
            </div>
            <div class="ak-spans" data-area="meta:spannen">
              ${span('Tag', d.low, d.high, d.price)}
              ${span('52 Wochen', d.lo52, d.hi52, d.price)}
            </div>
            <div class="ak-facts" data-area="text:kennzahlen">
              ${facts.map(([k, v]) => `
                <div class="ak-fact">
                  <p class="t-12 ink-2 clip">${k}</p>
                  <p class="t-16 w-500 clip">${v}</p>
                </div>`).join('')}
            </div>
          </div>`;
        },
      },
    ],
  });
})();
