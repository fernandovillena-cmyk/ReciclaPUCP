/* Textos de Recicla PUCP: datos curiosos (con fuente), mensajes de ánimo y avisos legales.
   Para agregar un dato: copia un bloque de FACTS, cambia el texto y la fuente.
   bins: en qué tachos aparece ('azul', 'blanco', 'verde', 'rojo'); vacío = sirve para cualquiera. */
(function (root) {
  'use strict';

  const BASES_2025 = { label: 'Bases de la Reciclatón PUCP 2025', url: 'https://estudios-generales-letras.pucp.edu.pe/wp-content/uploads/2025/10/2025_Bases-Reciclaton_EE.GG_.LL_.pdf' };
  const BASES_2024 = { label: 'Bases de la Reciclatón Interfacultades 2024', url: 'https://interfacultades.pucp.edu.pe/6642351f3d8771e466c46608/664b22276df1e8d2dfb5812a_2024-Interfacultades_Bases-Reciclaton_Act-05May-05.pdf' };
  const GPI = { label: 'Glass Packaging Institute', url: 'https://www.gpi.org/glass-facts' };
  const PILAS = { label: 'Noticias Ambientales (23 ago 2025)', url: 'https://noticiasambientales.com/animals/matsigenka-communities-in-peru-collect-two-tons-of-used-batteries-to-protect-the-amazon-from-contamination/' };

  const FACTS = [
    // ---- PUCP ----
    { id: 'pucp-2024', scope: 'PUCP', bins: ['azul', 'blanco'], src: BASES_2025,
      text: 'En 2024, la PUCP entregó 42 786 kg de papel, cartón y plástico para reciclaje. ¡Cada hoja y cada botella que separas suma a esa cifra!' },
    { id: 'pucp-ahorro', scope: 'PUCP', bins: ['azul'], src: BASES_2025,
      text: 'Según la PUCP, reciclar ese material en 2024 equivale a ahorrar 87 847 kWh de energía y 143 516 galones de agua, y a evitar la tala de 430 árboles.' },
    { id: 'pucp-2023', scope: 'PUCP', bins: ['azul', 'blanco'], src: BASES_2024,
      text: 'En 2023 la PUCP entregó 49 611 kg de papel, cartón y plástico para reciclaje. ¿Podemos superar esa cifra este año?' },
    { id: 'pucp-limpio', scope: 'PUCP', bins: ['azul'], src: BASES_2025,
      text: 'En la Reciclatón de la PUCP no se acepta papel manchado con comida, líquidos, pintura o aceite, ni servilletas ni papel higiénico. Reciclar empieza por separar limpio y seco.' },
    { id: 'pucp-pet', scope: 'PUCP', bins: ['blanco'], src: BASES_2025,
      text: 'La Reciclatón PUCP recibe botellas de plástico PET. Las reconoces por el número 1 dentro del triángulo de la base.' },
    { id: 'pucp-categorias', scope: 'PUCP', bins: ['rojo', 'verde'],
      src: { label: 'Infografía de residuos, Clima de Cambios PUCP', url: 'https://www.pucp.edu.pe/climadecambios/wp-content/uploads/2024/04/CdC-Infografia-residuos-3x2m-2.pdf' },
      text: 'En la PUCP los residuos se acopian por separado: papel y cartón, vidrio, plástico, generales, maleza, desmonte y peligrosos.' },
    { id: 'pucp-campus', scope: 'PUCP', bins: [],
      src: { label: 'Repositorio institucional PUCP', url: 'https://repositorio.pucp.edu.pe/bitstreams/df2bc987-2e2c-4ca5-a24f-d52d70607fa2/download' },
      text: 'El campus tiene unas 41 hectáreas y por él circulan más de 30 000 personas al día. Si todos separamos bien, el impacto es enorme.' },
    { id: 'pucp-huella', scope: 'PUCP', bins: [],
      src: { label: 'Red de Ciclo de Vida PUCP (abr 2018)', url: 'https://red.pucp.edu.pe/ciclodevida/en/?p=857' },
      text: 'En 2018 la PUCP participó en su primer estudio para medir la huella de carbono de la universidad. Medir es el primer paso para reducirla.' },

    // ---- Perú ----
    { id: 'peru-1-9', scope: 'Perú', bins: [],
      src: { label: 'MINAM · SINIA', url: 'https://sinia.minam.gob.pe/novedades/peru-solo-se-recicla-19-total-residuos-solidos-reaprovechables' },
      text: 'En 2016, solo el 1,9 % de los residuos reaprovechables del Perú se reciclaba, según el MINAM. Cada registro tuyo ayuda a cambiar esa cifra.' },
    { id: 'peru-pilas', scope: 'Perú', bins: ['rojo'], src: PILAS,
      text: 'En 2025, comunidades matsigenka del Alto Urubamba (Cusco) reunieron más de 2 toneladas de pilas usadas y las entregaron al Minam para proteger la Amazonía.' },
    { id: 'pilas-metales', scope: 'Mundo', bins: ['rojo'], src: PILAS,
      text: 'Las pilas abandonadas liberan metales pesados como mercurio, cadmio y plomo, que llegan al suelo y al agua y se acumulan en los seres vivos.' },

    // ---- Ciencia ----
    { id: 'vidrio-infinito', scope: 'Mundo', bins: ['verde'], src: GPI,
      text: 'El vidrio se puede reciclar una y otra vez, sin perder calidad ni pureza.' },
    { id: 'vidrio-95', scope: 'Mundo', bins: ['verde'], src: GPI,
      text: 'El vidrio reciclado puede reemplazar hasta el 95 % de las materias primas para fabricar vidrio nuevo.' },
    { id: 'papel-fibras', scope: 'Mundo', bins: ['azul'],
      src: { label: 'EPA (Agencia de Protección Ambiental de EE. UU.)', url: 'https://archive.epa.gov/wastes/conserve/materials/paper/web/html/papermaking.html' },
      text: 'Las fibras del papel se pueden reciclar unas 5 a 7 veces antes de quedar demasiado cortas para hacer papel nuevo (estimación de la EPA).' },

    // ---- Sobre Quilla ----
    { id: 'quilla', scope: 'Quilla', bins: [],
      src: { label: 'Mama Killa · Wikipedia', url: 'https://en.wikipedia.org/wiki/Mama_Killa' },
      text: '«Quilla» significa «luna» en quechua. Mama Quilla era la diosa de la luna para los incas. ¡De ahí viene mi nombre!' },
  ];

  const CHEERS = [
    '¡Eso es! Un residuo menos en el ambiente 🌱',
    '¡Bravazo! Tu campus lo nota 💙',
    '¡Así se hace! Pequeños gestos, gran cambio',
    '¡Gracias por separar bien! Quilla está orgullosa de ti',
    '¡Qué crack! Otro residuo en el lugar correcto',
    '¡Genial! Sigues sumando por la PUCP',
    '¡Buenazo! El planeta (y yo) te lo agradecemos',
    '¡Lo lograste! Así se cuida el campus 🌙',
  ];

  const MILESTONES = {
    1: '¡Tu primer reciclaje! 🌱 Hoy nace un buen hábito.',
    5: '¡5 reciclajes! Ya eres un brote 🌿',
    10: '¡10 reciclajes! Eres imparable 💪',
    25: '¡25 reciclajes! Un pequeño bosque se asoma 🌳',
    50: '¡50 reciclajes! Eres leyenda del campus 🏆',
    100: '¡100! Quilla se quita el sombrero 🎩',
  };

  const PRIVACY = [
    'Qué guardamos: tus nombres, apellidos, código y correo PUCP, y por cada reciclaje: el tacho, el tipo de residuo, la fecha y hora, tu ubicación aproximada y la foto.',
    'Para qué: contar los reciclajes de la comunidad, verificar los registros de quienes lleguen al premio y medir el impacto del proyecto.',
    'Quién lo ve: solo el equipo organizador del proyecto, en una hoja de cálculo y una carpeta privadas. Los demás usuarios no ven tus datos.',
    'Cuánto tiempo: hasta que termine el concurso. Después se borran las fotos. Puedes pedir que borren tus datos cuando quieras.',
    'Cuida tu privacidad: evita que salgan rostros en las fotos.',
  ];

  root.RP_CONTENT = { FACTS, CHEERS, MILESTONES, PRIVACY };
})(window);
