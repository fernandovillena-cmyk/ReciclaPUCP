/* Sincronización con la hoja de Google (Apps Script).
   Cada registro se guarda primero en el celular y se envía después, cuando hay internet.
   Si no hay conexión, queda en cola y se reintenta solo. El servidor ignora los duplicados por id,
   así que reenviar es seguro.  Con cloud.endpoint vacío en config.js, todo sigue en modo local. */
(function (root) {
  'use strict';

  const C = root.RP_CONFIG;
  const enabled = () => !!(C.cloud && C.cloud.endpoint);

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  // Un POST "simple" (text/plain) evita la consulta previa de CORS que Apps Script no contesta.
  async function post(body, timeoutMs) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs || 40000);
    try {
      const res = await fetch(C.cloud.endpoint, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally { clearTimeout(timer); }
  }

  /* handlers:
       getPending()      → [{ profile, rec }]  registros sin enviar, del más antiguo al más nuevo
       getPhoto(id)      → Promise<Blob|null>
       markSynced(item)  → marca el registro como enviado
       onChange()        → se llama cuando cambia el estado (para refrescar la pantalla)       */
  function create(h) {
    let flushing = false, failures = 0, nextAt = 0, timer = null;
    let lastError = '', lastOkAt = 0, statsCache = null, statsAt = 0;

    async function flush(opts) {
      if (!enabled() || flushing) return { sent: 0 };
      const force = opts && opts.force;
      if (!force && Date.now() < nextAt) return { sent: 0 };
      if (navigator.onLine === false) return { sent: 0 };
      flushing = true;
      let sent = 0;
      try {
        for (const item of h.getPending()) {
          const blob = await h.getPhoto(item.rec.id).catch(() => null);
          const photo = blob ? { mime: blob.type || 'image/jpeg', b64: await blobToBase64(blob) } : null;
          // clientNow permite a la hoja detectar relojes de celular mal puestos (columna "Desfase del reloj").
          const out = await post({ action: 'record', token: C.cloud.token, clientNow: Date.now(), profile: item.profile, rec: item.rec, photo });
          if (!out || !out.ok) throw new Error((out && out.error) || 'respuesta inválida');
          h.markSynced(item);
          sent++;
          failures = 0;
          lastError = '';
          lastOkAt = Date.now();
        }
      } catch (e) {
        failures++;
        lastError = e && e.name === 'AbortError' ? 'tiempo agotado' : String((e && e.message) || e);
        nextAt = Date.now() + Math.min(300, 15 * 2 ** Math.min(failures, 5)) * 1000;
      } finally {
        flushing = false;
        if (h.onChange) h.onChange();
      }
      return { sent };
    }

    // Total de reciclajes de la comunidad (para mostrar "entre todos ya llevamos…").
    async function stats() {
      if (!enabled()) return null;
      if (statsCache && Date.now() - statsAt < (C.cloud.statsEverySec || 300) * 1000) return statsCache;
      try {
        const url = C.cloud.endpoint + (C.cloud.endpoint.includes('?') ? '&' : '?') + 'action=stats&token=' + encodeURIComponent(C.cloud.token);
        const res = await fetch(url, { redirect: 'follow' });
        const out = await res.json();
        if (out && out.ok) { statsCache = out; statsAt = Date.now(); return out; }
      } catch (e) { /* sin conexión: se muestra lo último que se sabía */ }
      return statsCache;
    }

    function start() {
      if (!enabled() || timer) return;
      timer = setInterval(() => flush(), (C.cloud.retryEverySec || 45) * 1000);
      window.addEventListener('online', () => flush({ force: true }));
      document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });
      flush({ force: true });
    }

    return {
      enabled, flush, stats, start,
      status: () => ({ enabled: enabled(), pending: h.getPending().length, lastError, lastOkAt, flushing }),
    };
  }

  root.RP_CLOUD = { create, enabled };
})(window);
