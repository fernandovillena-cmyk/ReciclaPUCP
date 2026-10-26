/* Ilustraciones de Recicla PUCP: Quilla (la mascota), íconos de materiales y tachos.
   Todo es SVG en texto, sin imágenes externas. Para cambiar a Quilla, edita solo la función quilla(). */
(function (root) {
  'use strict';

  const INK = '#12284f';

  // ---- Materiales (lienzo de 48 × 48) ------------------------------------------------
  const MATERIALS = {
    papel: `
      <path d="M13 5h16l8 8v28a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="#fff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M29 5v8h8" fill="#dfe8ff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M16 22h16M16 28h16M16 34h9" stroke="#3f6de0" stroke-width="2.6" stroke-linecap="round"/>`,
    carton: `
      <path d="M6 16l18-9 18 9v22l-18 9-18-9z" fill="#e6b16a" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M6 16l18 9 18-9M24 25v22" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M15 11.5l18 9v6l-5 2.5v-6l-13-6.5z" fill="#f6e7c4" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
    botella_plastico: `
      <rect x="19" y="3" width="10" height="5.5" rx="1.6" fill="#2e6fde" stroke="${INK}" stroke-width="2.2"/>
      <path d="M20.5 8.5h7v5c0 2.2 5 4.4 5 9.5v17.5a3.5 3.5 0 0 1-3.5 3.5H19a3.5 3.5 0 0 1-3.5-3.5V23c0-5.100 5-7.300 5-9.500z" fill="#bfe6ff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M15.500 28h17v8h-17z" fill="#fff" stroke="${INK}" stroke-width="2"/>
      <path d="M15.500 32h17" stroke="#2e6fde" stroke-width="2.4"/>
      <path d="M20 17c0 2-1 3-1 5" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/>`,
    envase_plastico: `
      <path d="M10 15h28" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
      <rect x="9" y="12" width="30" height="5" rx="2.4" fill="#fff" stroke="${INK}" stroke-width="2.4"/>
      <path d="M12 17h24l-3 25a2.500 2.500 0 0 1-2.500 2.200H17.500A2.500 2.500 0 0 1 15 42z" fill="#f7a8b8" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M25 12l3-8h6" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 27h20" stroke="#fff" stroke-width="2.2" stroke-opacity=".8"/>`,
    botella_vidrio: `
      <path d="M20.500 3h7v11c0 3.500 5.500 5.500 5.500 11v16a3.500 3.500 0 0 1-3.500 3.500H18.500A3.500 3.500 0 0 1 15 41V25c0-5.500 5.500-7.500 5.500-11z" fill="#62b37a" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <rect x="15" y="27" width="18" height="10" fill="#f6ebc8" stroke="${INK}" stroke-width="2"/>
      <path d="M21 8v6M19 20c-1 2-1.500 3-1.500 5" stroke="#fff" stroke-opacity=".75" stroke-width="2" stroke-linecap="round" fill="none"/>`,
    frasco_vidrio: `
      <rect x="12" y="5" width="24" height="8" rx="2.500" fill="#c9ced8" stroke="${INK}" stroke-width="2.400"/>
      <path d="M11 17a4 4 0 0 1 4-4h18a4 4 0 0 1 4 4v21a6 6 0 0 1-6 6H17a6 6 0 0 1-6-6z" fill="#cff0e0" stroke="${INK}" stroke-width="2.400"/>
      <rect x="11" y="24" width="26" height="10" fill="#f6ebc8" stroke="${INK}" stroke-width="2"/>
      <path d="M16 18v4" stroke="#fff" stroke-width="2.200" stroke-linecap="round"/>`,
    pilas: `
      <rect x="20" y="3" width="8" height="5" rx="1.500" fill="#c9ced8" stroke="${INK}" stroke-width="2.200"/>
      <rect x="13" y="8" width="22" height="37" rx="4" fill="#2b2f3a" stroke="${INK}" stroke-width="2.400"/>
      <rect x="13" y="14" width="22" height="9" fill="#f2b632" stroke="${INK}" stroke-width="2"/>
      <path d="M24 28v8M20 32h8" stroke="#fff" stroke-width="2.800" stroke-linecap="round"/>`,
    focos: `
      <path d="M24 4a13 13 0 0 0-7 24c1.500 1.200 2 2.500 2 4v1h10v-1c0-1.500.500-2.800 2-4a13 13 0 0 0-7-24z" fill="#ffe27a" stroke="${INK}" stroke-width="2.400" stroke-linejoin="round"/>
      <rect x="18.500" y="33" width="11" height="9" rx="2" fill="#c9ced8" stroke="${INK}" stroke-width="2.200"/>
      <path d="M20 38h8M22 42.500h4" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
      <path d="M20 16l4 6 4-6" fill="none" stroke="#e08a00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    quimicos: `
      <rect x="17" y="3" width="14" height="8" rx="2" fill="${INK}"/>
      <path d="M22 3V1.500h4V3" stroke="${INK}" stroke-width="2" fill="none"/>
      <rect x="14" y="11" width="20" height="33" rx="4" fill="#e5484d" stroke="${INK}" stroke-width="2.400"/>
      <path d="M24 17l7 8-7 8-7-8z" fill="#ffd23f" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M24 21v5" stroke="${INK}" stroke-width="2.400" stroke-linecap="round"/><circle cx="24" cy="29.200" r="1.300" fill="${INK}"/>`,
    otro: `
      <circle cx="24" cy="24" r="18" fill="#e8eeff" stroke="${INK}" stroke-width="2.400"/>
      <path d="M18.500 19.500a5.500 5.500 0 1 1 8.500 4.600c-1.800 1.200-3 2.200-3 4.400" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="24" cy="34" r="1.900" fill="${INK}"/>`,
  };

  function material(id, size) {
    const body = MATERIALS[id] || MATERIALS.otro;
    const s = size ? ` width="${size}" height="${size}"` : '';
    return `<svg viewBox="0 0 48 48"${s} aria-hidden="true" focusable="false">${body}</svg>`;
  }

  // ---- Tacho (lienzo de 64 × 76) con el ícono del material en el frente -------------------
  function bin(b, size) {
    const edge = b.edge || darker(b.color);
    const s = size ? ` width="${size}" height="${size * 76 / 64}"` : '';
    return `<svg viewBox="0 0 64 76" class="bin-art"${s} aria-hidden="true" focusable="false">
      <ellipse cx="32" cy="72" rx="22" ry="3.200" fill="#000" opacity=".12"/>
      <path d="M25 13v-3a3.500 3.500 0 0 1 3.500-3.500h7A3.500 3.500 0 0 1 39 10v3" fill="none" stroke="${edge}" stroke-width="4" stroke-linecap="round"/>
      <rect x="5" y="13" width="54" height="9" rx="4.500" fill="${b.color}" stroke="${edge}" stroke-width="2.200"/>
      <path d="M10 25h44l-3.600 41a4.500 4.500 0 0 1-4.500 4.100H18.100a4.500 4.500 0 0 1-4.500-4.100z" fill="${b.color}" stroke="${edge}" stroke-width="2.200" stroke-linejoin="round"/>
      <path d="M21 31v31M43 31v31" stroke="${b.ink}" stroke-opacity=".22" stroke-width="3" stroke-linecap="round"/>
      <circle cx="32" cy="47" r="12.500" fill="#fff" stroke="${edge}" stroke-width="1.800"/>
      <g transform="translate(21 36) scale(.46)">${MATERIALS[b.icon] || MATERIALS.otro}</g>
    </svg>`;
  }

  function darker(hex) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.round(v * 0.72)).toString(16).padStart(2, '0');
    return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
  }

  // ---- Quilla, la lunita reciclista (lienzo de 120 × 120) ------------------------------------
  // mood: 'hola' | 'feliz' | 'festejo' | 'pensando'
  function quilla(mood, size) {
    const m = mood || 'feliz';
    const s = size ? ` width="${size}" height="${size}"` : '';
    const skin = '#ffe9a8', rim = '#f2c75c', shade = '#f7d77e', blush = '#ff9db0';
    const arm = (d, hand) => `<path d="${d}" stroke="${rim}" stroke-width="8" stroke-linecap="round" fill="none"/>
      <path d="${d}" stroke="${skin}" stroke-width="4.400" stroke-linecap="round" fill="none"/>
      <circle cx="${hand[0]}" cy="${hand[1]}" r="6" fill="${skin}" stroke="${rim}" stroke-width="2.400"/>`;

    let arms = '';
    if (m === 'festejo') arms = arm('M24 74Q10 66 8 46', [8, 44]) + arm('M96 74Q110 66 112 46', [112, 44]);
    else if (m === 'hola') arms = arm('M24 80Q16 86 14 94', [14, 96]) + arm('M96 74Q110 66 108 50', [108, 48]);
    else arms = arm('M24 80Q14 84 12 94', [12, 96]) + arm('M96 80Q106 84 108 94', [108, 96]);

    const eyeOpen = (cx) => `<ellipse cx="${cx}" cy="64" rx="4.800" ry="6.200" fill="${INK}"/><circle cx="${cx + 1.600}" cy="61.500" r="1.800" fill="#fff"/>`;
    const eyeJoy = (cx) => `<path d="M${cx - 6} 66Q${cx} 56 ${cx + 6} 66" stroke="${INK}" stroke-width="3.600" stroke-linecap="round" fill="none"/>`;
    const eyeLook = (cx) => `<ellipse cx="${cx}" cy="63" rx="4.800" ry="6.200" fill="${INK}"/><circle cx="${cx + 2}" cy="60" r="1.800" fill="#fff"/>`;

    let eyes, mouth, extra = '';
    if (m === 'festejo') {
      eyes = eyeJoy(46) + eyeJoy(74);
      mouth = `<path d="M47 78Q60 98 73 78Z" fill="${INK}"/><path d="M53 88Q60 82 67 88Q60 94 53 88Z" fill="#ff7a90"/>`;
      extra = `<path d="M14 24l2.600 6 6 2.600-6 2.600-2.600 6-2.600-6-6-2.600 6-2.600z" fill="#ffd23f"/>
        <path d="M104 18l2 4.600 4.600 2-4.600 2-2 4.600-2-4.600-4.600-2 4.600-2z" fill="#7fe0a8"/>
        <path d="M100 100l1.600 3.600 3.600 1.600-3.600 1.600-1.600 3.600-1.600-3.600-3.600-1.600 3.600-1.600z" fill="#ffd23f"/>`;
    } else if (m === 'pensando') {
      eyes = eyeLook(46) + eyeLook(74);
      mouth = `<path d="M54 80Q60 76 66 80" stroke="${INK}" stroke-width="3.200" stroke-linecap="round" fill="none"/>`;
      extra = `<circle cx="96" cy="26" r="3" fill="#cfd9f5"/><circle cx="104" cy="16" r="4.500" fill="#cfd9f5"/>`;
    } else {
      eyes = eyeOpen(46) + eyeOpen(74);
      mouth = `<path d="M50 77Q60 88 70 77" stroke="${INK}" stroke-width="3.400" stroke-linecap="round" fill="none"/>`;
    }

    return `<svg viewBox="0 0 120 120"${s} class="quilla quilla-${m}" aria-hidden="true" focusable="false">
      <ellipse cx="60" cy="112" rx="26" ry="4" fill="#000" opacity=".14"/>
      ${arms}
      <path d="M60 28C60 20 58 15 54 11" stroke="#2f9e5f" stroke-width="3.800" fill="none" stroke-linecap="round"/>
      <path d="M54 12C45 8 38 13 38 20 46 21 51 18 54 12Z" fill="#35b36d"/>
      <path d="M56 13C63 6 72 9 73 17 66 19 60 17 56 13Z" fill="#2f9e5f"/>
      <circle cx="60" cy="70" r="42" fill="${skin}" stroke="${rim}" stroke-width="3.200"/>
      <path d="M60 28A42 42 0 0 1 60 112A31 42 0 0 0 60 28Z" fill="${shade}" opacity=".55"/>
      <circle cx="33" cy="86" r="5.200" fill="#f2d27c" opacity=".75"/><circle cx="87" cy="54" r="3.600" fill="#f2d27c" opacity=".75"/><circle cx="78" cy="98" r="2.800" fill="#f2d27c" opacity=".75"/>
      <ellipse cx="36" cy="76" rx="8" ry="5" fill="${blush}" opacity=".6"/><ellipse cx="84" cy="76" rx="8" ry="5" fill="${blush}" opacity=".6"/>
      ${eyes}${mouth}${extra}
    </svg>`;
  }

  // Reemplaza todos los <… data-quilla="festejo"> y <… data-material="papel"> del documento.
  function hydrate(rootEl) {
    (rootEl || document).querySelectorAll('[data-quilla]').forEach((el) => { el.innerHTML = quilla(el.dataset.quilla); });
    (rootEl || document).querySelectorAll('[data-material]').forEach((el) => { el.innerHTML = material(el.dataset.material); });
  }

  root.RP_ART = { material, bin, quilla, hydrate, darker };
})(window);
