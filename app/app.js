/* Recicla PUCP · lógica de la app. Sin dependencias ni compilación.
   Archivos relacionados: config.js (ajustes), content.js (textos y datos), art.js (dibujos),
   cloud.js (envío a la hoja de Google). Mapa del código: ver MANUAL.md. */
(() => {
  'use strict';

  const C = window.RP_CONFIG;
  const T = window.RP_CONTENT;
  const ART = window.RP_ART;

  // Lector QR de respaldo para navegadores sin BarcodeDetector (iPhone, escritorio).
  // Versión fija + hash de integridad; el service worker lo guarda para uso sin conexión.
  const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
  const JSQR_SRI = 'sha384-b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n) => (n === 1 ? 'vez' : 'veces');
  const svgIcon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;

  const state = {
    profile: null,   // { names, surnames, code, email, createdAt }
    screen: null,
    flow: null,      // QR en uso: { tacho, scannedAt, geo, deposits, bin, waste, photo, hash, takenAt }
    last: null,      // último registro guardado (pantalla "listo")
    stream: null,
    scanToken: null,
    camToken: null,
    histUrls: [],
    histShown: 0,
  };

  // ================================================================ almacenamiento
  const mem = new Map();
  const store = {
    get(k, fb = null) {
      try { const v = localStorage.getItem(k); return v === null ? fb : JSON.parse(v); }
      catch { return mem.has(k) ? mem.get(k) : fb; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { mem.set(k, v); } },
    del(k) { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } mem.delete(k); },
  };

  // Las fotos van a IndexedDB (localStorage se llenaría); los datos del registro, a localStorage.
  const photos = {
    _db: null,
    open() {
      if (!this._db) {
        this._db = new Promise((resolve, reject) => {
          const req = indexedDB.open('recicla-pucp', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('photos');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      }
      return this._db;
    },
    async _tx(mode, fn) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('photos', mode);
        const out = fn(tx.objectStore('photos'));
        tx.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
    put(id, blob) { return this._tx('readwrite', (s) => s.put(blob, id)); },
    get(id) { return this._tx('readonly', (s) => s.get(id)); },
    del(ids) { return this._tx('readwrite', (s) => { ids.forEach((id) => s.delete(id)); }); },
  };

  const settings = () => store.get('rp:settings', { demo: false });
  const saveSettings = (patch) => store.set('rp:settings', { ...settings(), ...patch });
  const demoOn = () => !!settings().demo;
  function setDemo(on) { saveSettings({ demo: !!on }); syncBanner(); }
  function syncBanner() { $('#demo-banner').hidden = !demoOn(); }

  const recKeyFor = (code) => 'rp:rec:' + code;
  const getRecs = () => (state.profile ? store.get(recKeyFor(state.profile.code), []) : []);
  const putRecs = (arr) => store.set(recKeyFor(state.profile.code), arr);

  // ================================================================ perfil
  const toTitle = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const emailRe = new RegExp('^[^\\s@]+@(' + C.emailDomains.map(escapeRe).join('|') + ')$', 'i');
  const codeRe = new RegExp('^\\d{' + C.codeDigits.min + ',' + C.codeDigits.max + '}$');

  function validateProfile(v) {
    const names = toTitle(v.names || ''), surnames = toTitle(v.surnames || '');
    const code = String(v.code || '').trim(), email = String(v.email || '').trim().toLowerCase();
    if (names.length < 2) return { error: 'Escribe tus nombres.' };
    if (surnames.length < 2) return { error: 'Escribe tus apellidos.' };
    if (!codeRe.test(code)) return { error: `Tu código PUCP son solo números (entre ${C.codeDigits.min} y ${C.codeDigits.max} dígitos). Ej.: 20231234.` };
    if (!emailRe.test(email)) return { error: 'Usa tu correo institucional (@' + C.emailDomains.join(' o @') + ').' };
    return { value: { names, surnames, code, email } };
  }

  // ================================================================ tiempo (hora de Lima)
  const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const tzFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone: C.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'long',
  });

  function limaParts(d = new Date()) {
    const p = {};
    for (const x of tzFormat.formatToParts(d)) p[x.type] = x.value;
    return {
      day: `${p.year}-${p.month}-${p.day}`,
      h: parseInt(p.hour, 10),
      mi: parseInt(p.minute, 10),
      dow: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(p.weekday.slice(0, 3).toLowerCase()),
      label: `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`,
    };
  }

  function shiftDay(dayStr, delta) {
    const [y, m, d] = dayStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
  }

  const hh = (h) => String(h).padStart(2, '0') + ':00';

  function scheduleText() {
    const d = [...C.hours.days].sort((a, b) => a - b);
    const contiguous = d.every((v, i) => i === 0 || v === d[i - 1] + 1);
    const days = contiguous && d.length > 2 ? `${DAYS[d[0]]} a ${DAYS[d[d.length - 1]]}` : d.map((v) => DAYS[v]).join(', ');
    return `${days}, de ${hh(C.hours.open)} a ${hh(C.hours.close)}`;
  }

  function checkSchedule(d = new Date()) {
    const t = limaParts(d);
    if (C.hours.days.includes(t.dow) && t.h >= C.hours.open && t.h < C.hours.close) return { ok: true };
    return { ok: false, msg: `Fuera de horario. Se puede registrar ${scheduleText()}.` };
  }

  // ================================================================ ubicación
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function getPosition(maxAge = 60000) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject({ code: 0 });
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy), t: Date.now() }),
        (e) => reject({ code: e.code }),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: maxAge },
      );
    });
  }

  async function checkLocation(cached) {
    if (demoOn()) return { ok: true, geo: cached || null };
    let geo = cached && Date.now() - cached.t < 180000 ? cached : null;
    if (!geo) {
      try { geo = await getPosition(); }
      catch (e) {
        return {
          ok: false,
          msg: e.code === 1 ? 'Necesito tu ubicación para comprobar que estás en el campus. Actívala para este sitio y vuelve a intentar.'
            : e.code === 0 ? 'Este dispositivo no permite obtener la ubicación.'
              : 'No pude obtener tu ubicación a tiempo. Sal a un lugar más abierto e inténtalo otra vez.',
        };
      }
    }
    if (geo.acc > C.maxAccuracyM) return { ok: false, msg: `La ubicación es muy imprecisa (±${geo.acc} m). Espera unos segundos y vuelve a intentar.` };
    const dist = Math.round(haversine(geo.lat, geo.lon, C.campus.lat, C.campus.lon));
    if (dist > C.campus.radiusM) return { ok: false, msg: `Parece que estás a ${dist} m del campus. Solo se puede registrar dentro de la PUCP.` };
    return { ok: true, geo: { ...geo, dist } };
  }

  // ================================================================ estadísticas y niveles
  function stats() {
    const recs = getRecs();
    const today = limaParts().day;
    const days = new Set(recs.map((r) => r.day));
    let streak = 0;
    for (let cur = days.has(today) ? today : shiftDay(today, -1); days.has(cur); cur = shiftDay(cur, -1)) streak++;
    return {
      total: recs.length, today: recs.filter((r) => r.day === today).length, streak, days: days.size,
      pending: recs.filter((r) => !r.sync).length, last: recs[0] || null,
    };
  }

  function levelInfo(total) {
    const L = C.levels;
    let i = 0;
    while (i + 1 < L.length && total >= L[i + 1].min) i++;
    const cur = L[i], next = L[i + 1] || null;
    return { cur, next, left: next ? next.min - total : 0, pct: next ? Math.round(((total - cur.min) / (next.min - cur.min)) * 100) : 100 };
  }

  // Reglas que se comprueban antes de aceptar un registro (salvo duplicados de foto).
  async function precheck(cachedGeo) {
    if (!demoOn()) {
      const s = stats();
      if (s.today >= C.dailyLimit) return { ok: false, msg: `Llegaste al máximo de ${C.dailyLimit} registros por hoy. ¡Vuelve mañana!` };
      if (s.last) {
        const wait = Math.ceil(C.cooldownSec - (Date.now() - s.last.t) / 1000);
        if (wait > 0) return { ok: false, msg: `Un momento: espera ${wait} s para hacer el siguiente registro.` };
      }
      const sc = checkSchedule();
      if (!sc.ok) return sc;
    }
    return checkLocation(cachedGeo);
  }

  // ================================================================ datos curiosos
  function pickFact(binId) {
    const recent = settings().recentFacts || [];
    const pool = T.FACTS.filter((f) => !binId || !f.bins.length || f.bins.includes(binId));
    let fresh = pool.filter((f) => !recent.includes(f.id));
    if (!fresh.length) fresh = pool;
    const pucp = fresh.filter((f) => f.scope === 'PUCP');
    const from = pucp.length && Math.random() < 0.6 ? pucp : fresh;
    const fact = from[Math.floor(Math.random() * from.length)];
    saveSettings({ recentFacts: [fact.id, ...recent].slice(0, 8) });
    return fact;
  }

  function factHtml(f) {
    return `<span class="ico" aria-hidden="true">💡</span><div><span class="tag">${esc(f.scope)}</span><p>${esc(f.text)}</p>` +
      `<a href="${esc(f.src.url)}" target="_blank" rel="noopener">Fuente: ${esc(f.src.label)}</a></div>`;
  }

  // ================================================================ interfaz común
  function toast(msg, ms = 3400) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), ms);
  }

  /* Ventana inferior. actions: [{ id, label, kind }]. Devuelve el id elegido ('cancel' si se cierra).
     beforeClose(id) puede devolver false para mantenerla abierta (p. ej. formulario con error). */
  function modal({ title = '', body = '', node = null, quilla = '', actions = [{ id: 'ok', label: 'Entendido', kind: 'primary' }], beforeClose = null }) {
    return new Promise((resolve) => {
      const m = $('#modal');
      const sheet = document.createElement('div');
      sheet.className = 'sheet';
      if (quilla) { const q = document.createElement('div'); q.className = 'sheet-quilla'; q.innerHTML = ART.quilla(quilla); sheet.appendChild(q); }
      if (title) { const h = document.createElement('h3'); h.textContent = title; sheet.appendChild(h); }
      if (body) { const p = document.createElement('div'); p.className = 'body'; p.textContent = body; sheet.appendChild(p); }
      if (node) sheet.appendChild(node);
      const box = document.createElement('div');
      box.className = 'actions';
      const close = (id) => {
        if (beforeClose && id !== 'cancel' && beforeClose(id) === false) return;
        m.hidden = true; m.replaceChildren(); document.removeEventListener('keydown', onKey); resolve(id);
      };
      const onKey = (e) => { if (e.key === 'Escape') close('cancel'); };
      actions.forEach((a) => {
        const b = document.createElement('button');
        b.className = 'btn ' + (a.kind || 'ghost');
        b.textContent = a.label;
        b.addEventListener('click', () => close(a.id));
        box.appendChild(b);
      });
      sheet.appendChild(box);
      m.replaceChildren(sheet);
      m.hidden = false;
      m.onclick = (e) => { if (e.target === m) close('cancel'); };
      document.addEventListener('keydown', onKey);
      const first = sheet.querySelector('input') || box.querySelector('button');
      if (first) first.focus();
    });
  }

  const binById = (id) => C.bins.find((b) => b.id === id);
  const wasteOf = (bin, id) => (bin && bin.wastes.find((w) => w.id === id)) || C.otherWaste;
  const binVars = (b) => `--bin:${b.color};--bin-ink:${b.ink};--bin-edge:${b.edge || ART.darker(b.color)}`;
  const placeOf = (n) => C.tachoLabel(n) + (C.tachoPlace(n) ? ' · ' + C.tachoPlace(n) : '');

  // ================================================================ navegación
  const NEEDS = {
    bins: ['tacho'], waste: ['tacho', 'bin'], camera: ['tacho', 'bin', 'waste'],
  };

  function resetPhoto() {
    if (state.flow && state.flow.photo) URL.revokeObjectURL(state.flow.photo.url);
    if (state.flow) { state.flow.photo = null; state.flow.hash = null; state.flow.takenAt = null; }
    $('#cap-still').removeAttribute('src'); // no dejar apuntando a una foto ya liberada
  }

  function dropFlow() {
    resetPhoto();
    state.flow = null;
  }

  function leave() {
    stopCamera();
    state.scanToken = null;
    state.camToken = null;
    if (state.screen === 'history') { state.histUrls.forEach((u) => URL.revokeObjectURL(u)); state.histUrls = []; }
  }

  function go(name, { replace = false, fromPop = false } = {}) {
    const wanted = name;
    if (!state.profile && name !== 'welcome') name = 'welcome';
    if (state.profile && name === 'welcome') name = 'scan';
    if (NEEDS[name]) {
      const f = state.flow;
      if (!(f && NEEDS[name].every((k) => f[k]))) name = 'scan';
      else if (Date.now() - f.scannedAt > C.tachoTtlMin * 60000) { dropFlow(); toast('Pasó un rato: escanea de nuevo el QR del tacho.'); name = 'scan'; }
    }
    if (name === 'done' && !state.last) name = 'scan';
    leave();
    state.screen = name;
    $$('.screen').forEach((s) => { s.hidden = s.id !== 's-' + name; });
    const entry = { s: name };
    if (fromPop) { if (name !== wanted) history.replaceState(entry, '', '#' + name); }
    else history[replace ? 'replaceState' : 'pushState'](entry, '', '#' + name);
    window.scrollTo(0, 0);
    syncInstallBanner();
    ENTER[name]();
  }

  window.addEventListener('popstate', (e) => go((e.state && e.state.s) || 'scan', { fromPop: true }));

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) {
      if (history.length > 1) history.back(); else go('scan');
      return;
    }
    const g = e.target.closest('[data-go]');
    if (g) go(g.dataset.go);
  });

  // ================================================================ instalación como app (PWA)
  const Install = {
    deferred: null,

    standalone() {
      return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: minimal-ui)').matches || navigator.standalone === true;
    },

    // Qué dispositivo y navegador es, para mostrar los pasos correctos.
    env() {
      const ua = navigator.userAgent;
      const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const android = /android/i.test(ua);
      const inApp = /FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|Snapchat|Line\/|MicroMessenger|Twitter|LinkedInApp|Pinterest|; wv\)/i.test(ua);
      let browser = 'other';
      if (/Edg(A|iOS)?\//.test(ua)) browser = 'edge';
      else if (/SamsungBrowser/i.test(ua)) browser = 'samsung';
      else if (/Firefox|FxiOS/i.test(ua)) browser = 'firefox';
      else if (/OPR\/|Opera/i.test(ua)) browser = 'opera';
      else if (/Chrome|CriOS/i.test(ua)) browser = 'chrome';
      else if (/Safari/i.test(ua)) browser = 'safari';
      return { os: ios ? 'ios' : android ? 'android' : 'desktop', browser, inApp };
    },

    steps() {
      const e = this.env();
      const share = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-share"/></svg>`;
      const dots = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-dots"/></svg>`;
      if (e.inApp) {
        return { title: 'Ábrela en tu navegador', quilla: 'pensando', copy: true,
          steps: [`Toca el menú ${dots} de esta pantalla`, 'Elige «Abrir en Chrome» o «Abrir en Safari»', 'Allí aparecerá el botón <b>Instalar</b>'],
          note: 'Las ventanas de WhatsApp, Instagram o Facebook no permiten instalar apps.' };
      }
      if (e.os === 'ios') {
        return { title: 'Instálala en tu iPhone', quilla: 'hola',
          steps: [`Toca <b>Compartir</b> ${share} en la barra del navegador`, 'Desliza y toca <b>«Añadir a pantalla de inicio»</b>', 'Toca <b>«Añadir»</b>: ¡listo!'],
          note: e.browser === 'safari' ? '' : 'Si no ves esa opción, abre este enlace en Safari.' };
      }
      if (e.os === 'android') {
        if (e.browser === 'samsung') return { title: 'Instálala en tu Android', quilla: 'hola', steps: ['Toca el menú ☰ del navegador', 'Elige <b>«Añadir página a»</b> y luego <b>«Pantalla de inicio»</b>', 'Confirma con <b>«Añadir»</b>'], note: '' };
        if (e.browser === 'firefox') return { title: 'Instálala en tu Android', quilla: 'hola', steps: [`Toca el menú ${dots}`, 'Elige <b>«Instalar»</b>', 'Confirma con <b>«Añadir»</b>'], note: '' };
        return { title: 'Instálala en tu Android', quilla: 'hola', steps: [`Toca el menú ${dots} del navegador`, 'Elige <b>«Instalar app»</b> o <b>«Añadir a pantalla de inicio»</b>', 'Confirma con <b>«Instalar»</b>'], note: '' };
      }
      if (e.browser === 'safari') return { title: 'Instálala en tu Mac', quilla: 'hola', steps: ['En el menú <b>Archivo</b> elige <b>«Añadir al Dock»</b>', 'Confirma con <b>«Añadir»</b>'], note: 'Requiere macOS Sonoma o más reciente.' };
      if (e.browser === 'firefox') return { title: 'Mejor usa Chrome o Edge', quilla: 'pensando', steps: ['Firefox de escritorio no instala apps web', 'Abre este enlace en <b>Chrome</b> o <b>Edge</b>', 'Allí aparecerá el botón <b>Instalar</b>'], note: 'Mientras tanto puedes usarla desde el navegador.', copy: true };
      return { title: 'Instálala en tu computadora', quilla: 'hola', steps: ['Busca el ícono <b>«Instalar»</b> al final de la barra de direcciones', 'Haz clic en <b>«Instalar»</b>', 'Se abrirá como una app independiente'], note: 'Si no lo ves, abre el menú del navegador y busca «Instalar Recicla PUCP».' };
    },

    dismissedRecently() { const t = settings().installDismissedAt; return !!t && Date.now() - t < 3 * 86400000; },
  };

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); Install.deferred = e; syncInstallBanner(); renderSettingsInstall(); });
  window.addEventListener('appinstalled', () => { Install.deferred = null; saveSettings({ installed: true }); syncInstallBanner(); renderSettingsInstall(); toast('¡Listo! Busca «Recicla PUCP» entre tus aplicaciones.'); });

  // El aviso es un solo elemento que se mueve al "hueco" de la pantalla activa (bienvenida o escáner).
  function syncInstallBanner() {
    const banner = $('#install-banner');
    const show = !Install.standalone() && !settings().installed && !Install.dismissedRecently();
    const slot = $(`#s-${state.screen} [data-install-slot]`);
    if (show && slot) {
      if (banner.parentElement !== slot) slot.appendChild(banner);
      banner.hidden = false;
    } else banner.hidden = true;
  }

  async function installNow() {
    if (Install.deferred) {
      const ev = Install.deferred;
      Install.deferred = null;
      ev.prompt();
      const choice = await ev.userChoice.catch(() => ({}));
      if (choice.outcome !== 'accepted') saveSettings({ installDismissedAt: Date.now() });
      syncInstallBanner(); renderSettingsInstall();
      return;
    }
    const s = Install.steps();
    const list = document.createElement('ol');
    list.className = 'steps';
    list.innerHTML = s.steps.map((x) => `<li><span>${x}</span></li>`).join('');
    const wrap = document.createElement('div');
    wrap.appendChild(list);
    if (s.note) { const n = document.createElement('p'); n.className = 'hint'; n.textContent = s.note; n.style.marginBottom = '14px'; wrap.appendChild(n); }
    const actions = [{ id: 'ok', label: 'Entendido', kind: 'primary' }];
    if (s.copy) actions.unshift({ id: 'copy', label: 'Copiar enlace de la app', kind: 'ghost' });
    const a = await modal({ title: s.title, quilla: s.quilla, node: wrap, actions });
    if (a === 'copy') copyLink();
  }

  function appUrl() { return location.href.split('#')[0].split('?')[0].replace(/index\.html$/, ''); }

  async function copyLink() {
    try { await navigator.clipboard.writeText(appUrl()); toast('Enlace copiado. Pégalo en Chrome o Safari.'); }
    catch { await modal({ title: 'Copia este enlace', body: appUrl() }); }
  }

  async function shareApp() {
    if (navigator.share) {
      try { await navigator.share({ title: C.appName, text: '¡Recicla en el campus y suma con Quilla! 🌙♻️', url: appUrl() }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    copyLink();
  }

  function renderSettingsInstall() {
    const done = Install.standalone() || settings().installed;
    $('#btn-install-set').hidden = done;
    $('#set-install-note').textContent = done ? 'Ya la tienes instalada ✓' : 'Ábrela como cualquier app, sin buscar el enlace.';
  }

  $('#btn-install').addEventListener('click', installNow);
  $('#btn-install-set').addEventListener('click', installNow);
  $('#btn-install-x').addEventListener('click', () => { saveSettings({ installDismissedAt: Date.now() }); syncInstallBanner(); });
  $('#btn-share').addEventListener('click', shareApp);

  // ================================================================ cámara
  async function startCamera(video) {
    stopCamera();
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw Object.assign(new Error('insecure'), { name: 'SecurityError' });
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
    });
    state.stream = stream;
    video.srcObject = stream;
    await video.play();
  }

  function stopCamera() {
    if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
    $$('video').forEach((v) => { v.srcObject = null; });
  }

  function camErrorText(e) {
    switch (e && e.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError': return 'Necesito la cámara para escanear. Permítela en el navegador (candado o ícono de cámara junto a la dirección) y toca Reintentar.';
      case 'NotFoundError':
      case 'OverconstrainedError': return 'No encontré una cámara en este dispositivo.';
      case 'SecurityError': return 'La cámara solo funciona con conexión segura (HTTPS). Abre la app desde su enlace oficial.';
      case 'NotReadableError': return 'Otra aplicación está usando la cámara. Ciérrala y toca Reintentar.';
      default: return 'No se pudo abrir la cámara. Toca Reintentar.';
    }
  }

  // ================================================================ pantalla: bienvenida y registro
  $('#reg-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('#reg-error');
    const fail = (msg) => { err.textContent = msg; err.hidden = false; err.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    const v = validateProfile({ names: $('#reg-names').value, surnames: $('#reg-surnames').value, code: $('#reg-code').value, email: $('#reg-email').value });
    if (v.error) return fail(v.error);
    if (!$('#reg-consent').checked) return fail('Marca la casilla para aceptar que se guarden tus datos y fotos.');
    err.hidden = true;
    state.profile = { ...v.value, createdAt: Date.now() };
    store.set('rp:profile', state.profile);
    startCloud();
    toast('¡Listo! Ya puedes reciclar.');
    go('scan', { replace: true });
  });

  $('#reg-code').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, C.codeDigits.max); });

  function showPrivacy(e) {
    if (e) e.preventDefault();
    const ul = document.createElement('ul');
    ul.className = 'facts';
    ul.innerHTML = T.PRIVACY.map((x) => {
      const i = x.indexOf(':');
      return `<li><b>${esc(x.slice(0, i + 1))}</b>${esc(x.slice(i + 1))}</li>`;
    }).join('');
    return modal({ title: 'Tu privacidad', quilla: 'feliz', node: ul });
  }
  $('#link-privacy').addEventListener('click', showPrivacy);
  $('#btn-privacy').addEventListener('click', showPrivacy);

  // ================================================================ pantalla: escáner de QR (inicio)
  let jsQRPromise = null;
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve();
    if (!jsQRPromise) {
      jsQRPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = JSQR_URL;
        s.integrity = JSQR_SRI;
        s.crossOrigin = 'anonymous';
        s.onload = resolve;
        s.onerror = () => { jsQRPromise = null; reject(new Error('JSQR_LOAD')); };
        document.head.appendChild(s);
      });
    }
    return jsQRPromise;
  }

  async function makeDecoder() {
    if ('BarcodeDetector' in window) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        if (formats.includes('qr_code')) {
          const det = new window.BarcodeDetector({ formats: ['qr_code'] });
          return async (v) => { const r = await det.detect(v); return r.length ? r[0].rawValue : null; };
        }
      } catch { /* se usa jsQR */ }
    }
    await loadJsQR();
    const cv = document.createElement('canvas');
    const cx = cv.getContext('2d', { willReadFrequently: true });
    return async (v) => {
      const s = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
      cv.width = Math.round(v.videoWidth * s);
      cv.height = Math.round(v.videoHeight * s);
      cx.drawImage(v, 0, 0, cv.width, cv.height);
      const img = cx.getImageData(0, 0, cv.width, cv.height);
      const r = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      return r ? r.data : null;
    };
  }

  const setScanMsg = (t) => { $('#scan-msg').textContent = t; };
  function scanProblem(text) {
    $('#scan-problem-text').textContent = text;
    $('#scan-problem').hidden = false;
    $('#scan-msg').hidden = true;
  }

  function renderScanHeader() {
    const s = stats();
    $('#chip-count').textContent = s.total;
    $('#chip-icon').textContent = levelInfo(s.total).cur.icon;
    const f = pickFact(null);
    $('#scan-fact').innerHTML = factHtml(f);
  }

  async function startScan() {
    const token = (state.scanToken = Symbol('scan'));
    renderScanHeader();
    $('#scan-problem').hidden = true;
    $('#scan-msg').hidden = false;
    setScanMsg('Iniciando cámara…');
    renderDemoSim();
    let decode;
    try {
      await startCamera($('#scan-video'));
      if (state.scanToken !== token) { stopCamera(); return; }
      setScanMsg('Preparando lector QR…');
      decode = await makeDecoder();
    } catch (e) {
      if (state.scanToken !== token) return;
      return scanProblem(e && e.message === 'JSQR_LOAD'
        ? 'No se pudo cargar el lector de QR. Conéctate a internet una vez para descargarlo y toca Reintentar.'
        : camErrorText(e));
    }
    if (state.scanToken !== token) return;
    setScanMsg('Apunta al QR pegado en el tacho');
    if (!demoOn()) getPosition().catch(() => { /* adelanta el permiso de ubicación */ });

    const video = $('#scan-video');
    let lastText = '', lastAt = 0;
    while (state.scanToken === token) {
      if (video.readyState >= 2 && video.videoWidth) {
        let text = null;
        try { text = await decode(video); } catch { /* fotograma ilegible */ }
        if (text && state.scanToken === token && (text !== lastText || Date.now() - lastAt > 2500)) {
          lastText = text; lastAt = Date.now();
          const n = C.parsePayload(text);
          if (n) return onTachoScanned(n);
          toast('Ese QR no es de un tacho de Recicla PUCP.');
        }
      }
      await sleep(160);
    }
  }

  function renderDemoSim() {
    const box = $('#scan-demo');
    box.hidden = !demoOn();
    if (!demoOn()) return;
    $('#scan-demo-list').innerHTML = Array.from({ length: C.tachoCount }, (_, i) =>
      `<button type="button" data-sim="${i + 1}">${C.tachoId(i + 1)}</button>`).join('');
  }

  $('#scan-demo-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sim]');
    if (b) onTachoScanned(parseInt(b.dataset.sim, 10));
  });
  $('#btn-scan-retry').addEventListener('click', startScan);
  $('#btn-rescan-bins').addEventListener('click', () => go('scan'));
  $('#btn-rescan-done').addEventListener('click', () => go('scan'));

  let handling = false;
  async function onTachoScanned(n) {
    if (handling || state.screen !== 'scan') return;
    handling = true;
    try {
      stopCamera();
      state.scanToken = null;
      if (navigator.vibrate) { try { navigator.vibrate(60); } catch { /* sin vibración */ } }
      $('#scan-msg').hidden = false;
      setScanMsg(`${C.tachoLabel(n)} detectado · verificando…`);
      const pre = await precheck(null);
      if (state.screen !== 'scan') return; // la persona volvió atrás mientras se verificaba
      if (!pre.ok) {
        await modal({ title: 'No se puede registrar ahora', quilla: 'pensando', body: pre.msg });
        startScan(); // sin await: el escáner debe poder volver a llamar a esta función
        return;
      }
      dropFlow();
      state.flow = { tacho: n, scannedAt: Date.now(), geo: pre.geo, deposits: 0, bin: null, waste: null, photo: null, hash: null, takenAt: null };
      go('bins');
    } finally { handling = false; }
  }

  // ================================================================ pantallas: tacho y residuo
  function renderBins() {
    const f = state.flow;
    f.bin = null; f.waste = null; resetPhoto();
    $('#bins-where').textContent = placeOf(f.tacho);
    $('#bins-lead').textContent = f.deposits
      ? `¿Otro residuo? Escoge el tacho (seguimos en ${C.tachoLabel(f.tacho)}).`
      : 'Fíjate en el color y en los dibujos: ¿en cuál vas a botar?';
    $('#bin-grid').innerHTML = C.bins.map((b) => `
      <button class="bin-card" data-bin="${esc(b.id)}" style="${binVars(b)}">
        ${ART.bin(b)}
        <span class="bin-name">${esc(b.name)}</span>
        <span class="bin-items">${b.wastes.map((w) => `<span>${ART.material(w.icon)}${esc(w.label)}</span>`).join('')}</span>
      </button>`).join('');
  }

  $('#bin-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-bin]');
    if (!b) return;
    state.flow.bin = b.dataset.bin;
    state.flow.waste = null;
    go('waste');
  });

  function renderWaste() {
    const f = state.flow, b = binById(f.bin);
    $('#waste-where').textContent = placeOf(f.tacho);
    const banner = $('#waste-banner');
    banner.setAttribute('style', binVars(b));
    banner.innerHTML = `${ART.bin(b)}<span>${esc(b.name)}</span>`;
    $('#waste-grid').innerHTML = [...b.wastes, C.otherWaste].map((w) => `
      <button class="waste-btn" data-waste="${esc(w.id)}">${ART.material(w.icon)}<span>${esc(w.label)}</span></button>`).join('');
  }

  $('#waste-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-waste]');
    if (!b) return;
    state.flow.waste = b.dataset.waste;
    go('camera');
  });

  // ================================================================ pantalla: foto
  function resetCaptureUi() {
    $('#cap-still').hidden = true;
    $('#cap-confirm').hidden = true;
    $('#cap-error').hidden = true;
    $('#cap-controls').hidden = false;
    $('#btn-send').disabled = false;
    $('#btn-send').lastChild.textContent = ' Enviar';
  }

  async function startCapture() {
    const token = (state.camToken = Symbol('cam'));
    const f = state.flow, b = binById(f.bin), w = wasteOf(b, f.waste);
    resetPhoto();
    resetCaptureUi();
    $('#cap-what').textContent = `${w.label} · ${b.name}`;
    $('#cap-problem').hidden = true;
    $('#shutter').disabled = true;
    try {
      await startCamera($('#cap-video'));
      if (state.camToken !== token) stopCamera();
    } catch (e) {
      if (state.camToken !== token) return;
      $('#cap-problem-text').textContent = camErrorText(e);
      $('#cap-problem').hidden = false;
    }
  }

  $('#cap-video').addEventListener('playing', () => { $('#shutter').disabled = false; });
  $('#btn-cap-retry').addEventListener('click', startCapture);
  $('#shutter').addEventListener('click', capture);

  // Huella de 256 bits (dHash 16×16) para detectar fotos repetidas, más brillo medio.
  function fingerprint(src) {
    const W = 17, H = 16;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(src, 0, 0, W, H);
    const px = cx.getImageData(0, 0, W, H).data;
    const g = [];
    let sum = 0;
    for (let i = 0; i < W * H; i++) {
      g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
      sum += g[i];
    }
    let hash = '';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < 16; x += 4) {
        let nib = 0;
        for (let k = 0; k < 4; k++) nib = (nib << 1) | (g[y * W + x + k] > g[y * W + x + k + 1] ? 1 : 0);
        hash += nib.toString(16);
      }
    }
    return { hash, brightness: sum / (W * H) };
  }

  function hamming(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i++) {
      for (let v = parseInt(a[i], 16) ^ parseInt(b[i], 16); v; v >>= 1) d += v & 1;
    }
    return d;
  }

  function stamp(cx, w, h, text) {
    const fs = Math.max(12, Math.round(w / 34)), pad = Math.round(fs * 0.6), bar = fs + pad * 2;
    cx.font = `700 ${fs}px system-ui, sans-serif`;
    cx.fillStyle = 'rgba(0,0,0,.62)';
    cx.fillRect(0, h - bar, w, bar);
    cx.fillStyle = '#fff';
    cx.textBaseline = 'middle';
    cx.fillText(text, pad, h - bar / 2);
  }

  async function capture() {
    const v = $('#cap-video');
    const btn = $('#shutter');
    if (!v.videoWidth || btn.disabled) return;
    btn.disabled = true;
    const scale = Math.min(1, C.photo.maxSide / Math.max(v.videoWidth, v.videoHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(v.videoWidth * scale);
    cv.height = Math.round(v.videoHeight * scale);
    const cx = cv.getContext('2d');
    cx.drawImage(v, 0, 0, cv.width, cv.height); // la foto sale solo del visor en vivo: no hay selector de archivos
    const fp = fingerprint(cv);
    if (fp.brightness < C.minBrightness) {
      toast('La foto salió muy oscura. Destapa la cámara o busca más luz.');
      btn.disabled = false;
      return;
    }
    const takenAt = Date.now();
    stamp(cx, cv.width, cv.height, `${C.tachoLabel(state.flow.tacho)} · ${limaParts(new Date(takenAt)).label} · ${C.appName}`);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', C.photo.quality));
    if (!blob) { toast('No se pudo tomar la foto. Intenta otra vez.'); btn.disabled = false; return; }
    resetPhoto();
    const f = state.flow;
    f.photo = { blob, url: URL.createObjectURL(blob) };
    f.hash = fp.hash;
    f.takenAt = takenAt;
    // Vista previa sobre el visor: Repetir o Enviar
    $('#cap-still').src = f.photo.url;
    $('#cap-still').hidden = false;
    $('#cap-controls').hidden = true;
    $('#cap-confirm').hidden = false;
    $('#cap-error').hidden = true;
  }

  $('#btn-retake').addEventListener('click', () => { resetPhoto(); resetCaptureUi(); $('#shutter').disabled = false; });
  $('#btn-send').addEventListener('click', saveRecord);

  async function saveRecord() {
    const f = state.flow;
    if (!f || !f.photo) return;
    const btn = $('#btn-send'), err = $('#cap-error');
    btn.disabled = true;
    btn.lastChild.textContent = ' Enviando…';
    err.hidden = true;
    const fail = (msg) => { err.textContent = msg; err.hidden = false; btn.disabled = false; btn.lastChild.textContent = ' Enviar'; };

    const pre = await precheck(f.geo);
    if (!pre.ok) return fail(pre.msg);

    // Fotos repetidas: se compara con los últimos 30 registros (no en modo demostración).
    let alert = '';
    if (!demoOn()) {
      let closest = null;
      for (const r of getRecs().slice(0, 30)) {
        if (!r.hash) continue;
        const d = hamming(r.hash, f.hash);
        if (!closest || d < closest.d) closest = { d, r };
      }
      if (closest && closest.d <= C.similarBitDiff) {
        const same = closest.r.bin === f.bin && closest.r.waste === f.waste;
        if (same && closest.d <= C.duplicateMaxBitDiff) {
          return fail('Esta foto es casi idéntica a la anterior. Toma una foto nueva, en el momento en que botas el residuo.');
        }
        alert = (closest.d <= C.duplicateMaxBitDiff ? 'Foto casi idéntica a otro registro' : 'Foto parecida a otro registro') + ` (${closest.d}/256)`;
      }
    }

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    try { await photos.put(id, f.photo.blob); }
    catch { return fail('No pude guardar la foto en este dispositivo (¿poco espacio o navegación privada?).'); }

    const g = pre.geo;
    const rec = {
      id, t: f.takenAt, day: limaParts(new Date(f.takenAt)).day,
      tacho: f.tacho, bin: f.bin, waste: f.waste,
      lat: g ? +g.lat.toFixed(5) : null, lon: g ? +g.lon.toFixed(5) : null,
      acc: g ? g.acc : null, dist: g && g.dist !== undefined ? g.dist : null,
      demo: demoOn(), hash: f.hash, alert, sync: 0,
    };
    const recs = getRecs();
    recs.unshift(rec);
    putRecs(recs);
    state.last = rec;
    f.deposits++;
    resetPhoto();
    f.bin = null; f.waste = null;
    cloud.flush({ force: true });
    go('done', { replace: true });
  }

  // ================================================================ pantalla: celebración
  function renderDone() {
    const r = state.last, s = stats();
    const b = binById(r.bin);
    const milestone = T.MILESTONES[s.total];
    $('#done-cheer').textContent = milestone || T.CHEERS[Math.floor(Math.random() * T.CHEERS.length)];
    $('#done-total').textContent = s.total;
    $('#done-label').textContent = plural(s.total) + (s.streak >= 2 ? ` · 🔥 ${s.streak} días seguidos` : '');

    const lv = levelInfo(s.total);
    $('#lvl-name').textContent = `${lv.cur.icon} ${lv.cur.name}`;
    $('#lvl-next').textContent = lv.next ? `${lv.left} para ${lv.next.icon} ${lv.next.name}` : '¡Nivel máximo!';
    const bar = $('#lvl-bar');
    bar.style.animation = 'none';
    bar.style.setProperty('--w', lv.pct + '%');
    void bar.offsetWidth; // reinicia la animación de llenado (definida en styles.css)
    bar.style.animation = '';

    $('#done-fact').innerHTML = factHtml(pickFact(b ? b.id : null));
    refreshSyncUi();
    $('#done-community').hidden = true;
    cloud.stats().then((st) => {
      if (st && st.total && state.screen === 'done') {
        const el = $('#done-community');
        el.innerHTML = `Entre todos ya llevamos <b>${Number(st.total).toLocaleString('es-PE')}</b> reciclajes en la comunidad 💙`;
        el.hidden = false;
      }
    });

    // Confeti (se omite con "reducir movimiento")
    const box = $('#confetti');
    box.replaceChildren();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const colors = ['#ffe9a8', '#7dffb5', '#ffffff', '#6f86ff', '#f2c75c'];
      for (let i = 0; i < 26; i++) {
        const p = document.createElement('i');
        p.style.left = Math.round(Math.random() * 100) + '%';
        p.style.background = colors[i % colors.length];
        p.style.animationDuration = (1.6 + Math.random() * 1.6).toFixed(2) + 's';
        p.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
        box.appendChild(p);
      }
    }
  }

  $('#btn-keep').addEventListener('click', () => go('bins'));

  function refreshSyncUi() {
    const st = cloud.status();
    const s = stats();
    if (state.screen === 'done') {
      $('#done-sync').textContent = !st.enabled ? '💾 Guardado en este celular'
        : s.pending ? '☁️ Guardado. Se enviará apenas haya internet' : '☁️ Enviado ✓';
    }
    if (state.screen === 'settings') renderSettingsCloud();
    if (state.screen === 'history') renderHistorySub();
  }

  // ================================================================ nube
  function recPayload(r) {
    const b = binById(r.bin);
    return {
      id: r.id, t: r.t, tacho: r.tacho, bin: r.bin, binName: b ? b.name : r.bin, waste: r.waste, wasteLabel: wasteOf(b, r.waste).label,
      lat: r.lat, lon: r.lon, acc: r.acc, dist: r.dist, demo: !!r.demo, hash: r.hash, alert: r.alert || '', v: 2,
    };
  }

  const cloud = window.RP_CLOUD.create({
    getPending: () => {
      const p = state.profile;
      if (!p) return [];
      const who = { code: p.code, email: p.email, names: p.names, surnames: p.surnames };
      return getRecs().filter((r) => !r.sync).reverse().map((r) => ({ code: p.code, profile: who, rec: recPayload(r) }));
    },
    getPhoto: (id) => photos.get(id),
    markSynced: (item) => {
      const key = recKeyFor(item.code);
      const recs = store.get(key, []);
      const r = recs.find((x) => x.id === item.rec.id);
      if (r) { r.sync = 1; store.set(key, recs); }
    },
    onChange: refreshSyncUi,
  });

  function startCloud() { if (state.profile) cloud.start(); }

  function renderSettingsCloud() {
    const st = cloud.status();
    $('#btn-sync').hidden = !st.enabled;
    if (!st.enabled) {
      $('#set-cloud-title').textContent = 'Solo en este celular';
      $('#set-cloud-note').textContent = 'Tus registros no se envían a ninguna hoja todavía.';
      return;
    }
    $('#set-cloud-title').textContent = st.pending ? '☁️ Por enviar: ' + st.pending : '☁️ Todo enviado ✓';
    $('#set-cloud-note').textContent = st.lastError ? `Último intento: ${st.lastError}. Se reintenta solo.` : st.pending ? 'Se envían solos cuando hay internet.' : 'Tus reciclajes ya están en la hoja del proyecto.';
  }

  $('#btn-sync').addEventListener('click', async () => {
    const r = await cloud.flush({ force: true });
    toast(r.sent ? `Se enviaron ${r.sent} registros.` : cloud.status().lastError ? 'No se pudo enviar. Revisa tu conexión.' : 'No hay nada pendiente.');
  });

  // ================================================================ pantalla: historial
  function renderHistorySub() {
    const s = stats();
    $('#hist-sub').textContent = `${s.total} ${s.total === 1 ? 'reciclaje' : 'reciclajes'}${s.pending && cloud.enabled() ? ` · ${s.pending} por enviar` : ''}`;
  }

  function renderHistory() {
    state.histShown = 0;
    $('#hist-list').replaceChildren();
    renderHistorySub();
    showMore();
  }

  function showMore() {
    const recs = getRecs();
    recs.slice(state.histShown, state.histShown + 30).forEach(appendItem);
    state.histShown = Math.min(recs.length, state.histShown + 30);
    $('#hist-empty').hidden = recs.length > 0;
    $('#btn-more').hidden = state.histShown >= recs.length;
    $('#btn-export').hidden = recs.length === 0;
  }

  $('#btn-more').addEventListener('click', showMore);

  function appendItem(r) {
    const b = binById(r.bin) || { name: r.bin, color: '#999', wastes: [] };
    const w = wasteOf(b, r.waste);
    const el = document.createElement('div');
    el.className = 'card hist-item';
    const synced = !!r.sync;
    el.innerHTML = `
      <button class="thumb" aria-label="Ver foto"><span>Sin foto</span></button>
      <div class="hist-meta">
        <b>${esc(w.label)}${r.demo ? '<span class="badge">DEMO</span>' : ''}</b>
        <small><span class="dot" style="--c:${b.color};--edge:${b.edge || ART.darker(b.color)}"></span>${esc(b.name)} · ${esc(C.tachoLabel(r.tacho))}</small>
        <small>${esc(limaParts(new Date(r.t)).label)}${r.dist != null ? ' · 📍 ' + r.dist + ' m' : ''}</small>
      </div>
      ${cloud.enabled() ? `<span class="hist-sync ${synced ? 'ok' : ''}" title="${synced ? 'Enviado' : 'Por enviar'}">${synced ? '<svg viewBox="0 0 24 24"><use href="#i-check"/></svg>' : '<svg viewBox="0 0 24 24"><use href="#i-cloud"/></svg>'}</span>` : ''}`;
    $('#hist-list').appendChild(el);
    const thumb = $('.thumb', el);
    photos.get(r.id).then((blob) => {
      if (!blob || state.screen !== 'history') return;
      const url = URL.createObjectURL(blob);
      state.histUrls.push(url);
      const img = new Image();
      img.src = url;
      img.alt = `Foto de ${w.label}`;
      thumb.replaceChildren(img);
      thumb.onclick = () => {
        const big = new Image();
        big.src = url;
        big.alt = img.alt;
        big.className = 'photo';
        modal({ title: `${w.label} · ${C.tachoLabel(r.tacho)}`, node: big, actions: [{ id: 'ok', label: 'Cerrar', kind: 'primary' }] });
      };
    }).catch(() => { /* sin foto */ });
  }

  function exportCsv() {
    const csvCell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['id', 'fecha_hora_lima', 'tacho', 'contenedor', 'residuo', 'lat', 'lon', 'precision_m', 'distancia_centro_m', 'demo', 'enviado']];
    getRecs().slice().reverse().forEach((r) => {
      const b = binById(r.bin);
      rows.push([r.id, limaParts(new Date(r.t)).label, C.tachoLabel(r.tacho), b ? b.name : r.bin, wasteOf(b, r.waste).label, r.lat, r.lon, r.acc, r.dist, r.demo ? 'si' : 'no', r.sync ? 'si' : 'no']);
    });
    const csv = '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `recicla-pucp-${state.profile.code}-${limaParts().day}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  $('#btn-export').addEventListener('click', exportCsv);

  // ================================================================ pantalla: ajustes
  function renderSettings() {
    const p = state.profile;
    $('#demo-toggle').checked = demoOn();
    $('#set-name').textContent = `${p.names} ${p.surnames}`;
    $('#set-code').textContent = 'Código ' + p.code;
    $('#set-email').textContent = p.email;
    $('#set-avatar').textContent = p.names.charAt(0).toUpperCase();
    renderSettingsInstall();
    renderSettingsCloud();
  }

  $('#demo-toggle').addEventListener('change', async (e) => {
    if (!e.target.checked) { setDemo(false); return; }
    const a = await modal({
      title: '¿Activar modo demostración?', quilla: 'pensando',
      body: 'Se omiten ubicación, horario, límite diario, espera y detección de fotos repetidas. Úsalo solo para presentar la app; los registros quedan marcados como DEMO.',
      actions: [{ id: 'yes', label: 'Activar', kind: 'primary' }, { id: 'cancel', label: 'Cancelar' }],
    });
    if (a === 'yes') setDemo(true); else e.target.checked = false;
  });

  $('#btn-edit-profile').addEventListener('click', async () => {
    const p = state.profile;
    const hasSynced = getRecs().some((r) => r.sync);
    const form = document.createElement('div');
    form.innerHTML = `
      <div class="field"><label for="ed-names">Nombres</label><input id="ed-names" type="text" maxlength="60" value="${esc(p.names)}"></div>
      <div class="field"><label for="ed-surnames">Apellidos</label><input id="ed-surnames" type="text" maxlength="60" value="${esc(p.surnames)}"></div>
      <div class="field"><label for="ed-code">Código PUCP</label><input id="ed-code" type="text" inputmode="numeric" maxlength="10" value="${esc(p.code)}" ${hasSynced ? 'disabled' : ''}></div>
      ${hasSynced ? '<p class="hint">El código no se puede cambiar porque ya enviaste registros. Si está mal, avisa al equipo del proyecto.</p>' : ''}
      <div class="field"><label for="ed-email">Correo PUCP</label><input id="ed-email" type="email" maxlength="80" value="${esc(p.email)}"></div>
      <p class="error" id="ed-error" hidden style="margin-top:12px"></p><div style="height:12px"></div>`;
    const a = await modal({
      title: 'Mis datos', node: form,
      actions: [{ id: 'save', label: 'Guardar', kind: 'primary' }, { id: 'cancel', label: 'Cancelar' }],
      beforeClose: () => {
        const v = validateProfile({ names: $('#ed-names').value, surnames: $('#ed-surnames').value, code: hasSynced ? p.code : $('#ed-code').value, email: $('#ed-email').value });
        if (v.error) { const er = $('#ed-error'); er.textContent = v.error; er.hidden = false; return false; }
        const oldCode = p.code;
        state.profile = { ...p, ...v.value };
        if (v.value.code !== oldCode) { store.set(recKeyFor(v.value.code), store.get(recKeyFor(oldCode), [])); store.del(recKeyFor(oldCode)); }
        store.set('rp:profile', state.profile);
        return true;
      },
    });
    if (a === 'save') { renderSettings(); toast('Datos actualizados.'); cloud.flush({ force: true }); }
  });

  async function deleteRecords(filter) {
    const recs = getRecs();
    const gone = recs.filter(filter);
    putRecs(recs.filter((r) => !filter(r)));
    try { await photos.del(gone.map((r) => r.id)); } catch { /* sin fotos que borrar */ }
    return gone.length;
  }

  $('#btn-clear-demo').addEventListener('click', async () => {
    const n = await deleteRecords((r) => r.demo);
    toast(n ? `Se ${n === 1 ? 'borró 1 registro' : `borraron ${n} registros`} de demostración.` : 'No hay registros de demostración.');
  });

  $('#btn-logout').addEventListener('click', async () => {
    const a = await modal({
      title: '¿Cambiar de usuario?', quilla: 'pensando',
      body: 'La app te pedirá tus datos de nuevo. Tus reciclajes quedan guardados en este celular y reaparecen si vuelves con el mismo código.',
      actions: [{ id: 'yes', label: 'Cambiar de usuario', kind: 'primary' }, { id: 'cancel', label: 'Cancelar' }],
    });
    if (a !== 'yes') return;
    store.del('rp:profile');
    state.profile = null;
    state.last = null;
    dropFlow();
    $('#reg-form').reset();
    go('welcome', { replace: true });
  });

  // La cámara se apaga si la app pasa a segundo plano y vuelve sola al regresar.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopCamera(); state.scanToken = null; state.camToken = null; return; }
    if (state.screen === 'scan') startScan();
    else if (state.screen === 'camera' && !state.flow.photo) startCapture();
  });

  // ================================================================ arranque
  const ENTER = {
    welcome: () => { ART.hydrate($('#s-welcome')); },
    scan: startScan,
    bins: renderBins,
    waste: renderWaste,
    camera: startCapture,
    done: renderDone,
    history: renderHistory,
    settings: renderSettings,
  };

  function init() {
    ART.hydrate();
    syncBanner();
    state.profile = store.get('rp:profile');
    if (state.profile && !state.profile.code) state.profile = null;
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* la app funciona igual sin modo offline */ });
    }
    startCloud();
    go(state.profile ? 'scan' : 'welcome', { replace: true });
  }

  // Expuesto solo para pruebas desde la consola del navegador.
  window.RP = {
    state, go, stats, levelInfo, limaParts, checkSchedule, scheduleText, haversine, fingerprint, hamming,
    setDemo, precheck, pickFact, validateProfile, Install, cloud, store, getRecs, photos,
  };

  init();
})();
