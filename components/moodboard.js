Factory.register({
  id: 'moodboard',
  name: 'Moodboard',
  aliases: ['moodboard', 'inspiration', 'referenzen', 'collage', 'bilder', 'galerie'],
  data: {
    title: 'Stille Räume',
    kind: 'Moodboard',
    about: 'Gesammelte Inspiration',
    note: 'Leinen, helles Holz und viel Luft – Referenzen für den Umbau des Studios.',
    refs: ['Morgenlicht', 'Leinen', 'Eichenholz', 'Salbei'],
  },
  css: `
    .mb-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 40px; }

    .mb-r { display: flex; flex-direction: column; gap: 16px; height: 100%; }
    .mb-grid { flex: 1 1 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .mb-grid .cf-media { border-radius: var(--r-16); }

    .mb-h { display: grid; grid-template-rows: 240px 56px; row-gap: 24px; }
    .mb-h .mb-row { display: flex; gap: 16px; padding: 0 24px; }
    .mb-h .mb-text { display: flex; flex-direction: column; justify-content: center; }
    .mb-thumbs { display: flex; gap: 8px; }
    .mb-thumbs .cf-media { width: 56px; height: 56px; border-radius: 8px; }

    .mb-s { display: flex; flex-direction: column; gap: 24px; padding: 24px 0; }
    .mb-s .mb-pad { margin: 0 24px; }
    .mb-kopf { display: flex; flex-direction: column; gap: 8px; }
    .mb-strip { display: grid; grid-template-columns: repeat(4, 88px); height: 112px; }
    .mb-strip .cf-media + .cf-media { border-left: 2px solid var(--c-surface); }
  `,
  layouts: [
    {
      id: 'raster',
      name: 'Raster',
      idea: 'Die Bilder zuerst: vier gleich große Referenzen im Raster, Titel und Zahl nur als Kopfzeile.',
      height: 408,
      render: (d, h) => `
        <div class="mb-r">
          <div class="mb-head">
            <div class="stack grow" data-area="text:kopf">
              <p class="t-16 w-500 clip">${h.esc(d.title)}</p>
              <p class="t-12 ink-2 clip">${h.esc(d.kind)} · ${d.refs.length} Referenzen</p>
            </div>
            <div data-area="control:hinzufuegen">
              <button class="btn-round" aria-label="Referenz hinzufügen">${h.icon('plus', 20)}</button>
            </div>
          </div>
          <div class="mb-grid" data-area="media:raster">
            ${d.refs.map((r, i) => h.media(i, { area: `media:bild-${i + 1}` })).join('')}
          </div>
        </div>`,
    },
    {
      id: 'held',
      name: 'Held',
      idea: 'Ein Bild trägt: randabfallend über die ganze Breite, zwei kleine Referenzen daneben deuten den Rest an.',
      height: 344,
      padding: 0,
      render: (d, h) => `
        <div class="mb-h">
          ${h.media(0, { area: 'media:held', bleed: true })}
          <div class="mb-row">
            <div class="mb-text grow" data-area="text:titel">
              <p class="t-16 w-500 clip">${h.esc(d.title)}</p>
              <p class="t-12 ink-2 clip">${h.esc(d.kind)} · ${d.refs.length} Referenzen</p>
            </div>
            <div class="mb-thumbs" data-area="media:weitere">
              ${h.media(1, { area: 'media:bild-2' })}${h.media(2, { area: 'media:bild-3' })}
            </div>
          </div>
        </div>`,
    },
    {
      id: 'streifen',
      name: 'Streifen',
      idea: 'Erst der Gedanke, dann die Bilder: Titel und Notiz rahmen einen randabfallenden Bildstreifen.',
      height: 312,
      padding: 0,
      render: (d, h) => `
        <div class="mb-s">
          <div class="mb-kopf mb-pad" data-area="text:kopf">
            <p class="t-12 ink-2 clip">${h.esc(d.kind)} · ${h.esc(d.about)} · ${d.refs.length} Referenzen</p>
            <p class="t-24 w-500 clip">${h.esc(d.title)}</p>
          </div>
          <div class="mb-strip" data-area="media:streifen" data-bleed>
            ${d.refs.map((r, i) => h.media(i, { area: `media:bild-${i + 1}`, bleed: true })).join('')}
          </div>
          <p class="t-14 serif mb-pad" data-area="text:notiz">${h.esc(d.note)}</p>
        </div>`,
    },
  ],
});
