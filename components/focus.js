(() => {
  // Ein Strich pro Minute. Verstrichene Minuten (ab 12 Uhr im Uhrzeigersinn) sind leise, die verbleibenden warm.
  function ring(d, size) {
    const c = size / 2, n = d.total, spent = d.total - d.left;
    const r1 = c - 2, r2 = c - 18;
    let ticks = '';
    for (let i = 0; i < n; i++) {
      const on = i >= spent;
      ticks += `<line x1="${c}" y1="${c - r1}" x2="${c}" y2="${c - r2}" stroke="${on ? 'var(--c-warm)' : 'var(--fo-dim)'}" stroke-width="3" stroke-linecap="round" transform="rotate(${(i + 0.5) * 360 / n} ${c} ${c})"/>`;
    }
    return `<svg class="fo-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${ticks}</svg>`;
  }

  // Dieselben Minutenstriche als Leiste
  const bar = d => `<div class="fo-bar" aria-hidden="true">${Array.from({ length: d.total }, (_, i) => `<i class="${i >= d.total - d.left ? 'on' : ''}"></i>`).join('')}</div>`;

  const dur = m => (m >= 60 ? `${Math.floor(m / 60)} Std. ` : '') + `${m % 60} Min.`;

  const head = (d, right = '') => `
    <div class="row between fo-head" data-area="text:kopf">
      <div class="stack">
        <p class="t-16 w-500">${d.title}</p>
        <p class="t-14 ink-2">${d.sub}</p>
      </div>
      ${right}
    </div>`;

  Factory.register({
    id: 'focus',
    name: 'Fokus-Timer',
    aliases: ['focus', 'fokus', 'timer', 'pomodoro', 'konzentration'],
    dark: true,
    data: {
      title: 'Fokus',
      sub: '25-Minuten-Sitzung',
      total: 25,
      left: 18,
      until: '11:59',
      sessions: [
        { at: '08:30', label: 'Konzept' },
        { at: '09:05', label: 'Mails' },
        { at: '09:40', label: 'Entwurf' },
        { at: '10:25', label: 'Entwurf' },
        { at: '11:00', label: 'Abstimmung' },
      ],
      current: { at: '11:34', label: 'Entwurf' },
    },
    css: `
      &.cf-card { --fo-dim: color-mix(in srgb, var(--c-on-dark) 16%, transparent); }
      .fo-head { align-items: flex-start; }
      .fo-warm { color: var(--c-warm); }
      .fo-btn { height: 40px; padding: 0 16px; border-radius: 999px; display: inline-flex; align-items: center; gap: 8px; background: var(--c-dark-2); color: var(--c-on-dark); }
      .fo-btn.is-main { background: var(--c-warm); color: var(--c-dark); }
      .btn-round.is-main { background: var(--c-warm); color: var(--c-dark); }
      .btn-round.fo-big { width: 48px; height: 48px; }

      .fo-ring { display: flex; flex-direction: column; gap: 16px; }
      .fo-dial { position: relative; width: 192px; height: 192px; align-self: center; border-radius: 999px; }
      .fo-svg { display: block; }
      .fo-mid { position: absolute; left: 32px; top: 32px; width: 128px; height: 128px; border-radius: 999px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .fo-ctl { display: flex; justify-content: center; gap: 8px; }

      .fo-strip { display: flex; flex-direction: column; gap: 16px; }
      .fo-val { height: 40px; display: flex; align-items: baseline; justify-content: space-between; }
      .fo-bar { height: 16px; display: flex; justify-content: space-between; }
      .fo-bar i { width: 4px; height: 16px; border-radius: 999px; background: var(--fo-dim); }
      .fo-bar i.on { background: var(--c-warm); }

      .fo-day { display: flex; flex-direction: column; gap: 16px; }
      .fo-list { display: flex; flex-direction: column; gap: 8px; }
      .fo-item { height: 24px; display: flex; align-items: center; gap: 16px; }
      .fo-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--c-warm); flex: none; }
      .fo-item.is-now .fo-dot { background: none; box-shadow: inset 0 0 0 2px var(--c-warm); }
      .fo-item .at { width: 40px; flex: none; }
      .fo-sum { height: 40px; display: flex; align-items: flex-end; justify-content: space-between; border-top: 1px solid var(--fo-dim); padding-top: 15px; }
    `,
    layouts: [
      {
        id: 'ring',
        name: 'Ring',
        idea: 'Die Restzeit zuerst: 18 groß in einem Ring aus Minutenstrichen, darunter Pause und Neustart.',
        height: 360,
        render: (d, h) => `
          <div class="fo-ring">
            ${head(d, `<p class="t-14 ink-2 num">bis ${d.until}</p>`)}
            <div class="fo-dial" data-area="media:ring">
              ${ring(d, 192)}
              <div class="fo-mid" data-area="text:restzeit">
                <p class="t-64 num" data-role="Restzeit">${d.left}</p>
                <p class="t-14 ink-2">Min.</p>
              </div>
            </div>
            <div class="fo-ctl" data-area="control:steuerung">
              <button class="fo-btn t-14">${h.icon('refresh', 18)}Neu starten</button>
              <button class="fo-btn is-main t-14 w-500">${h.icon('pause', 18)}Pause</button>
            </div>
          </div>`,
      },
      {
        id: 'leiste',
        name: 'Leiste',
        idea: 'Kompakt: die Restzeit als Zahl, darunter 25 Minutenstriche als Leiste, nur ein Knopf.',
        height: 184,
        render: (d, h) => `
          <div class="fo-strip">
            ${head(d, `<div data-area="control:pause"><button class="btn-round is-main fo-big" aria-label="Pause">${h.icon('pause', 20)}</button></div>`)}
            <div class="fo-val" data-area="text:restzeit">
              <p class="t-32 num" data-role="Restzeit">${d.left} Min.</p>
              <p class="t-14 ink-2 num">bis ${d.until}</p>
            </div>
            <div data-area="meta:fortschritt">${bar(d)}</div>
          </div>`,
      },
      {
        id: 'sitzungen',
        name: 'Sitzungen',
        idea: 'Der Tag als Liste: jede erledigte Sitzung ein Punkt, die laufende hohl, unten die Summe.',
        height: 352,
        render: (d, h) => `
          <div class="fo-day">
            ${head(d, `<span class="t-14 ink-2">Heute</span>`)}
            <div class="fo-list" data-area="text:liste">
              ${d.sessions.map((s, i) => `
                <div class="fo-item" data-area="text:sitzung-${i + 1}">
                  <span class="fo-dot"></span>
                  <p class="t-12 ink-2 num at">${s.at}</p>
                  <p class="t-14 grow clip">${h.esc(s.label)}</p>
                </div>`).join('')}
              <div class="fo-item is-now" data-area="text:laufend">
                <span class="fo-dot"></span>
                <p class="t-12 ink-2 num at">${d.current.at}</p>
                <p class="t-14 grow clip">${h.esc(d.current.label)}</p>
                <p class="t-14 fo-warm num">noch ${d.left} Min.</p>
              </div>
            </div>
            <div class="fo-sum" data-area="text:summe">
              <p class="t-14 ink-2">${d.sessions.length} Sitzungen</p>
              <p class="t-16 w-500 num">${dur(d.sessions.length * d.total)} fokussiert</p>
            </div>
          </div>`,
      },
    ],
  });
})();
