(() => {
  // Temperaturkurve: glatte Linie durch die Stundenwerte, Werte über den Punkten.
  let uid = 0;
  function curve(hours, { w, h }) {
    const t = hours.map(x => x.temp);
    const hi = Math.max(...t), lo = Math.min(...t);
    const top = 32, bot = h - 16;
    const f = n => n.toFixed(1);
    const pts = hours.map((x, i) => [(i + 0.5) * w / hours.length, hi === lo ? (top + bot) / 2 : top + (hi - x.temp) / (hi - lo) * (bot - top)]);
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    const first = pts[0], last = pts[pts.length - 1];
    const id = `we-g${++uid}`;
    return `<svg class="we-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style="stop-color:var(--c-on-dark);stop-opacity:.22"/>
        <stop offset="1" style="stop-color:var(--c-on-dark);stop-opacity:0"/>
      </linearGradient></defs>
      <path d="${d} L${f(last[0])} ${h} L${f(first[0])} ${h} Z" fill="url(#${id})"/>
      <path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      ${pts.map(([x, y], i) => `
        <circle cx="${f(x)}" cy="${f(y)}" r="${i ? 3 : 4.5}" fill="${i ? 'var(--we-bg)' : 'currentColor'}" stroke="currentColor" stroke-width="2"/>
        <text x="${f(x)}" y="${f(y - 14)}" text-anchor="middle" font-size="14" font-weight="500" fill="currentColor">${hours[i].temp}°</text>`).join('')}
    </svg>`;
  }

  const sym = (h, name, size) => `<span class="we-sym${name === 'sun' ? ' is-sun' : ''}">${h.icon(name, size)}</span>`;

  Factory.register({
    id: 'weather',
    name: 'Wetter',
    aliases: ['weather', 'forecast', 'wetter', 'vorhersage', 'temperatur'],
    data: {
      place: 'Hamburg',
      temp: 14,
      cond: 'Wolkig',
      icon: 'cloud',
      hi: 16,
      lo: 9,
      hours: [
        { t: 'Jetzt', temp: 14 },
        { t: '14:00', temp: 16 },
        { t: '16:00', temp: 16 },
        { t: '18:00', temp: 13 },
        { t: '20:00', temp: 11 },
        { t: '22:00', temp: 10 },
      ],
      days: [
        { day: 'Mo', icon: 'cloud', hi: 16, lo: 9 },
        { day: 'Di', icon: 'sun', hi: 18, lo: 10 },
        { day: 'Mi', icon: 'rain', hi: 15, lo: 11 },
        { day: 'Do', icon: 'rain', hi: 13, lo: 8 },
        { day: 'Fr', icon: 'sun', hi: 17, lo: 9 },
      ],
    },
    css: `
      /* Gedeckter, kühler Blauverlauf aus Akzent und Grau/Dunkel gemischt; heller Text darauf.
         Bewusst &.cf-card statt oberster Ebene: [data-c] trägt in der Schichten-Ansicht auch die ganze Zeile. */
      &.cf-card {
        --we-bg: color-mix(in oklab, var(--c-accent) 26%, var(--c-dark-2));
        --we-2: color-mix(in srgb, var(--c-on-dark) 70%, transparent);
        --we-fill: color-mix(in srgb, var(--c-on-dark) 10%, transparent);
        background: linear-gradient(170deg, color-mix(in oklab, var(--c-accent) 34%, var(--c-ink-2)) 0%, var(--we-bg) 100%);
        color: var(--c-on-dark);
      }
      .ink-2 { color: var(--we-2); }
      .we-sym { display: grid; place-items: center; color: var(--c-on-dark); }
      .we-sym.is-sun { color: var(--c-warm); }

      .we-now { display: grid; grid-template-rows: 24px 64px 24px; row-gap: 16px; height: 100%; }
      .we-hero { display: grid; grid-template-columns: 1fr 64px; }
      .we-hero .icon { stroke-width: 1.2; }

      .we-week { display: flex; flex-direction: column; gap: 16px; }
      .we-days { display: grid; grid-template-columns: repeat(5, 48px); column-gap: 16px; }
      .we-day { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 0; border-radius: 999px; }
      .we-day .we-sym { height: 24px; margin-bottom: 8px; }
      .we-day.is-today { background: var(--we-fill); }

      .we-hours { display: flex; flex-direction: column; gap: 16px; }
      .we-chart { display: flex; flex-direction: column; gap: 8px; }
      .we-svg { display: block; }
      .we-times { display: grid; grid-template-columns: repeat(6, 1fr); text-align: center; }
      .we-times .is-now { color: var(--c-on-dark); }
    `,
    layouts: [
      {
        id: 'jetzt',
        name: 'Jetzt',
        idea: 'Die Temperatur zuerst: 14° groß, darunter nur Lage und Tageshoch/-tief.',
        height: 192,
        render: (d, h) => `
          <div class="we-now">
            <div class="row between" data-area="text:ort">
              <p class="t-16 w-500">${h.esc(d.place)}</p>
              <p class="t-14 ink-2">${h.now.toLocaleDateString('de-DE', { weekday: 'long' })}</p>
            </div>
            <div class="we-hero">
              <p class="t-64 num" data-area="text:temperatur">${d.temp}°</p>
              <div data-area="media:symbol">${sym(h, d.icon, 64)}</div>
            </div>
            <div class="row between" data-area="text:lage">
              <p class="t-16">${h.esc(d.cond)}</p>
              <p class="t-14 ink-2 num">H ${d.hi}° · T ${d.lo}°</p>
            </div>
          </div>`,
      },
      {
        id: 'woche',
        name: 'Woche',
        idea: 'Die Woche im Vergleich: fünf Tage als Spalten, Symbol und Höchstwert führen, heute ist hinterlegt.',
        height: 240,
        render: (d, h) => `
          <div class="we-week">
            <div class="row between" data-area="text:kopf">
              <p class="t-16 w-500">${h.esc(d.place)}</p>
              <p class="t-14 ink-2 num">${d.temp}° · ${h.esc(d.cond)}</p>
            </div>
            <div class="we-days">
              ${d.days.map((x, i) => `
                <div class="we-day${i === 0 ? ' is-today' : ''}" data-area="text:tag-${i + 1}">
                  <p class="t-12 ink-2">${x.day}</p>
                  ${sym(h, x.icon, 24)}
                  <p class="t-16 w-500 num">${x.hi}°</p>
                  <p class="t-14 ink-2 num">${x.lo}°</p>
                </div>`).join('')}
            </div>
          </div>`,
      },
      {
        id: 'stunden',
        name: 'Stunden',
        idea: 'Der Verlauf des Tages: eine Temperaturkurve bis in den Abend, die Uhrzeiten darunter.',
        height: 216,
        render: (d, h) => `
          <div class="we-hours">
            <div class="row between" data-area="text:kopf">
              <p class="t-16 w-500">${h.esc(d.place)}</p>
              <p class="t-14 ink-2 num">${h.esc(d.cond)} · H ${d.hi}° · T ${d.lo}°</p>
            </div>
            <div class="we-chart">
              <div data-area="media:kurve">${curve(d.hours, { w: 304, h: 104 })}</div>
              <div class="we-times" data-area="meta:uhrzeiten">
                ${d.hours.map((x, i) => `<p class="t-12 num${i ? ' ink-2' : ' w-500 is-now'}">${x.t}</p>`).join('')}
              </div>
            </div>
          </div>`,
      },
    ],
  });
})();
