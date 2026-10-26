/* Configuración editable de Recicla PUCP.
   Todo lo que el equipo puede querer ajustar está aquí; los demás archivos la leen. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RP_CONFIG = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CONFIG = {
    appName: 'Recicla PUCP',

    // ---- Registro (se pide una sola vez) ----
    emailDomains: ['pucp.edu.pe', 'pucp.pe'],
    codeDigits: { min: 6, max: 10 }, // el código PUCP de estudiantes tiene 8 dígitos (p. ej. 20231234)

    // ---- Dónde y cuándo se puede registrar ----
    // Centro del campus (OpenStreetMap, Av. Universitaria 1801) y radio aceptado.
    // Comprueba el punto en Google Maps y ajusta el radio si hace falta.
    campus: { lat: -12.0692, lon: -77.0805, radiusM: 650 },
    maxAccuracyM: 200, // si el GPS reporta peor precisión que esto, se pide reintentar
    // Horario (hora de Lima). days: 0 = domingo … 6 = sábado. Valores de ejemplo: confírmalos.
    timeZone: 'America/Lima',
    hours: { open: 7, close: 22, days: [1, 2, 3, 4, 5, 6] },

    // ---- Reglas antitrampa ----
    dailyLimit: 10,         // registros por persona y por día
    cooldownSec: 20,        // espera mínima entre dos registros
    tachoTtlMin: 10,        // minutos que vale un QR escaneado para seguir reciclando sin volver a escanear
    // Comparación de fotos (huella de 256 bits). Misma elección de tacho y residuo con una foto casi idéntica
    // (≤ duplicateMaxBitDiff bits distintos) se rechaza. Si el residuo es otro pero la foto es parecida
    // (≤ similarBitDiff), se acepta y se marca como alerta para que el equipo la revise en la hoja.
    duplicateMaxBitDiff: 10,
    similarBitDiff: 26,
    minBrightness: 22,      // 0-255; por debajo, la foto se rechaza por oscura (cámara tapada)
    photo: { maxSide: 960, quality: 0.72 },

    // ---- Tachos con QR ----
    // Si cambias qrSalt, hay que volver a imprimir los QR.
    tachoCount: 10,
    tachoNames: {},         // opcional: { 1: 'Biblioteca', 2: 'Plaza central' }
    qrSalt: 'recicla-pucp-2026',

    // ---- Nube (Google Sheets). Con endpoint vacío la app funciona solo en modo local ----
    cloud: {
      endpoint: 'https://script.google.com/macros/s/AKfycbx_chDBUhUkfYxb4A7drd2urR-GMI9tcE3fOOQOLaDPEvr2jfQaTQR51MIdctvjDk1CCw/exec', // URL de la aplicación web de Apps Script (termina en /exec)
      token: 'cambia-este-token',   // debe ser igual al TOKEN de backend/Code.gs
      retryEverySec: 45,
      statsEverySec: 300,
    },

    // ---- Niveles (según la cantidad de reciclajes) ----
    levels: [
      { min: 0, name: 'Semilla', icon: '🌱' },
      { min: 5, name: 'Brote', icon: '🌿' },
      { min: 15, name: 'Plantón', icon: '🍀' },
      { min: 30, name: 'Árbol', icon: '🌳' },
      { min: 60, name: 'Bosque', icon: '🌲' },
    ],

    // ---- Tachos de reciclaje y de residuos peligrosos ----
    // Categorías basadas en los puntos de acopio de la PUCP. Los COLORES son una suposición:
    // confírmalos en el campus y edítalos. icon = nombre del dibujo en art.js.
    bins: [
      {
        id: 'azul', name: 'Papel y cartón', color: '#1d5fbf', ink: '#ffffff', icon: 'papel',
        wastes: [
          { id: 'papel', label: 'Papel', icon: 'papel', tip: 'Papel limpio y seco. Si tiene grasa o restos de comida, ya no se recicla.' },
          { id: 'carton', label: 'Cartón', icon: 'carton', tip: 'Desarma y aplasta las cajas para que ocupen menos. Si está manchado de grasa, no se recicla.' },
        ],
      },
      {
        id: 'blanco', name: 'Plástico', color: '#f4f6f5', ink: '#14221b', edge: '#8d9a93', icon: 'botella_plastico',
        wastes: [
          { id: 'botella_plastico', label: 'Botella', icon: 'botella_plastico', tip: 'Vacíala, enjuágala y aplástala: para reciclarse, el plástico tiene que llegar limpio.' },
          { id: 'envase_plastico', label: 'Envase o vaso', icon: 'envase_plastico', tip: 'Enjuágalo antes de botarlo. Un envase sucio puede contaminar todo lo demás.' },
        ],
      },
      {
        id: 'verde', name: 'Vidrio', color: '#2e8b57', ink: '#ffffff', icon: 'botella_vidrio',
        wastes: [
          { id: 'botella_vidrio', label: 'Botella', icon: 'botella_vidrio', tip: 'Vacía y enjuaga. Si está rota, envuélvela en papel para proteger a quien la recoge.' },
          { id: 'frasco_vidrio', label: 'Frasco', icon: 'frasco_vidrio', tip: 'Quita la tapa y enjuágalo antes de botarlo.' },
        ],
      },
      {
        id: 'rojo', name: 'Pilas y peligrosos', color: '#c62828', ink: '#ffffff', icon: 'pilas',
        wastes: [
          { id: 'pilas', label: 'Pilas', icon: 'pilas', tip: 'Nunca van al tacho común: contaminan suelo y agua. Entrégalas solo en el punto de peligrosos.' },
          { id: 'focos', label: 'Foco', icon: 'focos', tip: 'No lo rompas: los fluorescentes contienen mercurio.' },
          { id: 'quimicos', label: 'Aerosol', icon: 'quimicos', tip: 'Que esté bien cerrado y vacío. No lo perfores ni lo aplastes.' },
        ],
      },
    ],
    otherWaste: { id: 'otro', label: 'Otro', icon: 'otro', tip: 'Si dudas dónde va un residuo, revisa la señalética del tacho antes de botarlo.' },
  };

  // ---- Códigos QR de los tachos ----------------------------------------------------
  // Formato: RPUCP|T07|a1b2  (el sufijo es un control para descartar QR ajenos; no es un secreto)
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function tachoId(n) { return String(n).padStart(2, '0'); }
  function tachoLabel(n) { return 'Tacho ' + tachoId(n); }
  function tachoPlace(n) { return CONFIG.tachoNames[n] || ''; }

  function makePayload(n) {
    const base = 'RPUCP|T' + tachoId(n);
    return base + '|' + fnv1a(base + CONFIG.qrSalt).toString(16).padStart(8, '0').slice(0, 4);
  }

  // Devuelve el número de tacho si el texto es un QR válido de Recicla PUCP; si no, null.
  function parsePayload(text) {
    const t = String(text || '').trim();
    const m = /^RPUCP\|T(\d{2})\|[0-9a-f]{4}$/.exec(t);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (n < 1 || n > CONFIG.tachoCount) return null;
    return makePayload(n) === t ? n : null;
  }

  CONFIG.tachoId = tachoId;
  CONFIG.tachoLabel = tachoLabel;
  CONFIG.tachoPlace = tachoPlace;
  CONFIG.makePayload = makePayload;
  CONFIG.parsePayload = parsePayload;
  return CONFIG;
});

