/**
 * Every word the user reads, in one file.
 *
 * The project is written in English; the interface is Spanish because the two
 * people using it are. Keeping the copy here rather than inline is what stops
 * that boundary from blurring — when a Spanish string appears in a component,
 * it is a bug. See CLAUDE.md.
 */
export const T = {
  appName: 'A medias',

  /**
   * The splash screen, out loud.
   *
   * "Se queda en el splash" was unactionable four times over, because the same
   * blank screen covered reading IndexedDB, waiting for Google, waiting for the
   * spreadsheet, and waiting for nothing at all. Each of these names one of
   * those, so the next report arrives with its own diagnosis in it.
   */
  splash: {
    start: 'Abriendo…',
    cache: 'Leyendo lo guardado…',
    queue: 'Enviando lo pendiente…',
    google: 'Comprobando tu sesión de Google…',
    sheet: 'Cargando la hoja…',
    ready: 'Listo',
    /** Only from a few seconds in: a counter on a fast load is just noise. */
    waiting: (seconds: number) => `${seconds} s`,
    fault: 'Último error',
    details: 'Detalles',
    session: {
      none: 'sin token',
      valid: (minutes: number) => `válida ${minutes} min más`,
      expired: (minutes: number) => `caducada hace ${minutes} min`,
    },
    yes: 'sí',
    no: 'no',
    /** The labels of the details panel. Short, because they sit in a column on
     *  a phone next to values that are not short at all. */
    facts: {
      endpoint: 'Servidor',
      action: 'Petición',
      answer: 'Respuesta',
      body: 'Contestó',
      network: 'Red',
      session: 'Sesión',
      account: 'Cuenta',
      build: 'Versión',
      worker: 'Service worker',
      rows: 'Filas cargadas',
    },
  },

  tabs: {
    add: 'Añadir',
    list: 'Gastos',
    balance: 'Diferencia',
    places: 'Sitios',
    fixed: 'Fijos',
  },

  add: {
    save: 'Guardar',
    saving: 'Guardando…',
    concept: 'Concepto',
    conceptPlaceholder: 'Busca o escribe el concepto',
    pays: (name: string) => `Paga ${name}`,
    today: 'Hoy',
    yesterday: 'Ayer',
    otherDate: 'Otra fecha',
    next: 'Siguiente',
    back: 'Atrás',
    step: (n: number, total: number) => `Paso ${n} de ${total}`,
    reviewTitle: 'Repásalo antes de guardarlo',
    fieldAmount: 'Importe',
    fieldPayer: 'Paga',
    fieldDate: 'Fecha',
    fieldConcept: 'Concepto',
    fieldNote: 'Observaciones',
    noNote: 'Sin observaciones',
    discard: 'Descartar este gasto',
    conceptRow: 'Conceptos frecuentes',
    noteRow: 'Medio de pago y observaciones',
    /** The free-text half of that row. The pills cover what is written down in
     *  the Sugerencias tab; this is for everything nobody thought of. */
    notePlaceholder: 'Escribe una observación',
    needAmount: 'Pon un importe',
    needConcept: 'Pon un concepto',
  },

  icons: {
    menu: 'Iconos',
    title: 'Iconos de los conceptos',
    pick: (concept: string) => `Icono para «${concept}»`,
    none: 'Sin icono',
    close: 'Cerrar',
    back: 'Volver',
    // Says where the icon came from: a guess and a choice look identical on the
    // tile, and only one of them is yours.
    mine: 'elegido',
    guessed: 'propuesto',
    /** The other half of this menu: which face stands for each of the two of
     *  you on the buttons that say who paid. */
    people: 'Quién paga',
    face: (name: string) => `Cara de ${name}`,
    /** The portraits, by the name of the painting rather than of the drawing.
     *  Nobody is being told they look like any of them: they are eight pictures
     *  to choose from, and the choice stays on this phone. */
    paintings: {
      monalisa: 'La Gioconda',
      pearl: 'La joven de la perla',
      vangogh: 'Van Gogh',
      frida: 'Frida Kahlo',
      scream: 'El grito',
      knight: 'El caballero',
      menina: 'La infanta',
      cubist: 'Cubista',
    } as Record<string, string>,
  },

  fixed: {
    tab: 'Fijos',
    // The banner on the first step. Plural because one is the common case and
    // "1 fijos" is the kind of detail that makes an app feel unfinished.
    due: (n: number) => (n === 1 ? 'Hay 1 fijo vencido' : `Hay ${n} fijos vencidos`),
    title: 'Fijos vencidos',
    close: 'Cerrar',
    skip: 'Saltar',
    // Shown on a proposal whose expense looks like it is already apuntado —
    // pegged from the bank, most likely.
    already: 'Puede que ya esté apuntado este mes',
    ask: 'Te pregunta el importe',
    every: (months: number) => months === 1
      ? 'Cada mes'
      : months === 12 ? 'Cada año' : `Cada ${months} meses`,
    empty: 'Todavía no hay ningún fijo',
    emptyHow:
      'Un fijo es un gasto que se repite: el alquiler, la luz, el seguro. La app te ' +
      'lo propone el día que toca y tú confirmas, cambias el importe o lo saltas.',
    add: 'Nuevo fijo',
    inactive: 'Desactivado',
    everyLabel: 'Cada cuánto',
    dayLabel: 'Día del mes',
    amountLabel: 'Importe fijo',
    amountAsk: 'Preguntar cada vez',
    payerAny: 'Quien lo apunte',
    activeLabel: 'Activo',
    save: 'Guardar fijo',
    needConcept: 'Pon un concepto',
  },

  places: {
    // The line that has to be true and has to be visible: nothing here is
    // uploaded, so nobody has to wonder whether it is.
    local: 'Los sitios se guardan solo en este dispositivo. No se suben a la hoja.',
    empty: 'Todavía no has guardado ningún sitio',
    emptyHow:
      'Al apuntar un gasto, toca «Guardar este sitio» y la próxima vez que estés ' +
      'aquí el concepto ya estará esperando.',
    remember: 'Guardar este sitio',
    remembering: 'Buscando dónde estás…',
    // Said in the future tense on purpose: the place is written when the expense
    // is, not when the switch goes on.
    willRemember: 'Se guardará con el gasto',
    knownAlready: 'Ya tenías este sitio guardado',
    denied: 'Sin permiso de ubicación. Se lo puedes dar en los ajustes del navegador.',
    unavailable: 'No se ha podido saber dónde estás',
    here: 'Aquí',
    hereRow: 'Aquí has apuntado',
    distance: (metres: number) => `A ${metres} m de aquí`,
    accuracy: (metres: number) => `±${metres} m`,
    savedOn: (date: string) => `Guardado el ${date}`,
    uses: (n: number) => (n === 1 ? 'Usado una vez' : `Usado ${n} veces`),
    forget: 'Borrar',
    forgetConfirm: '¿Borrar este sitio? Los gastos ya apuntados no se tocan.',
  },

  list: {
    both: 'Ambos',
    search: 'Buscar concepto…',
    empty: 'Todavía no hay nada apuntado',
    noResults: 'Ningún gasto con ese concepto',
    edit: 'Editar',
    void: 'Anular',
    voided: 'Anulado',
    legacy: 'Apuntado a mano · toca para poder editarlo',
    totalsRow: 'Resumen',
    // Said out loud whenever a filter is on: the same three numbers mean
    // something completely different, and nothing else on the strip shows it.
    filtered: 'Solo lo filtrado',
    partialYear: (date: string) =>
      `El año cuenta desde el ${date}: la app carga los últimos gastos, no toda la hoja.`,
    claiming: 'Preparando…',
    dayTotal: (amount: string) => `Total del día ${amount}`,
  },

  edit: {
    title: 'Editar gasto',
    save: 'Guardar cambios',
    cancel: 'Cancelar',
    voidConfirm: '¿Anular este gasto? La fila se queda en la hoja, sin importes.',
    /** Which row of the sheet this is, which is the whole subject of the screen.
     *  It was written inline in the component, in Spanish, where nothing else is. */
    row: (row: number) => `Fila ${row}`,
    note: 'Nota',
  },

  balance: {
    ahead: (name: string) => `${name} va por delante`,
    even: 'Estáis a la par',
    splitTitle: 'Repartir una transferencia',
    splitPrompt: 'Cuánto vais a meter al bote',
    splitResult: 'Quedaríais a la par',
    splitCent: 'A la par, salvo un céntimo que no se puede partir',
    splitShort: (amount: string) => `Aún quedaría una diferencia de ${amount}`,
    contributed: 'Aportado en lo que se ve',
  },

  auth: {
    signIn: 'Entrar con Google',
    signingIn: 'Entrando…',
    forbidden: 'Esa cuenta no puede editar la hoja. Compártela con ella para darle acceso.',
    noColumn: 'Puedes mirar, pero no apuntar: tu cuenta no es ninguna de las dos de la hoja.',
    retry: 'Reintentar',
  },

  sync: {
    /** While something is on its way up. Not a count: the number was the least
     *  interesting part of it, and what somebody who has just tapped Guardar
     *  wants to know is that it is being saved. */
    saving: 'Guardando…',
    /** Next to Guardando… once the upload is actually repeating itself. It
     *  counts retries, not attempts: the first try is not a retry, and a save
     *  that announced "reintento 1" the moment it was tapped made every
     *  ordinary save look like a repair. */
    retry: (n: number) => `reintento ${n}`,
    /** Still used where a row has no row number yet, which is the same fact seen
     *  from one entry rather than from the queue. */
    pending: (n: number) => (n === 1 ? '1 gasto sin subir' : `${n} gastos sin subir`),
    offline: 'Sin conexión · se subirá solo',
    failed: 'No se ha podido subir',
  },

  errors: {
    generic: 'Algo ha salido mal',
    crashed: 'La app se ha atascado',
    reload: 'Volver a cargar',
    // True, and the thing worth knowing at that moment: an expense that was
    // saved is in the outbound queue before the screen repaints.
    queueSafe: 'Lo que ya habías guardado no se ha perdido.',
    network: 'No se ha podido conectar',
    // Shown when nothing has arrived and nothing has failed either — the case
    // that used to be an eternal splash screen.
    stuck: 'Esto está tardando demasiado. Vuelve a cargar.',
    configMissing: 'Falta configuración en la hoja. Mira la pestaña Config.',
    /**
     * What "fetch failed" actually was. The browser will not say, so these are
     * the three possibilities told apart by `api/client.ts`, written to be read
     * out loud down a phone line and to point at one thing each.
     */
    diagnosis: {
      offline: 'Sin conexión: el móvil dice que no hay red.',
      timeout: (host: string, seconds: number) =>
        `${host} no ha contestado en ${seconds} s.`,
      refused: (host: string) =>
        `${host} contesta, pero el navegador no deja leerlo (CORS). `
        + 'Suele ser el despliegue de Apps Script pidiendo login: revisa que esté '
        + 'publicado para «cualquier persona».',
      notJson: (host: string) =>
        `${host} ha contestado algo que no es JSON. Mira «Contestó» abajo: `
        + 'si es HTML, el despliegue está devolviendo una página de error o de login.',
      unreachable: (host: string) =>
        `No se llega a ${host}. Ni un bloqueador, ni una VPN, ni un DNS del móvil `
        + 'dejan salir la petición — o la dirección del bundle es la equivocada.',
      notLedger: (host: string) =>
        `${host} ha contestado JSON, pero no es la hoja: le faltan los nombres o `
        + 'los apuntes. Suele ser el despliegue contestando a otra cosa.',
      badCache: 'Lo que había guardado no era la hoja. Descartado y cargando de nuevo.',
    },
  },
} as const
