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
    clearConcept: 'Borrar el concepto',
    /** The star on a tile written down by hand in the Sugerencias tab. Said
     *  rather than drawn, for whoever is not looking at the shape. */
    pinned: (concept: string) => `${concept} · favorito`,
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
    noMethod: 'Sin especificar',
    discard: 'Descartar este gasto',
    // On the button itself, beside Guardar, where the whole sentence would not
    // fit. The long one stays as the button's accessible name and as the question
    // the dialog asks: "Descartar" alone, read out of context, is vague.
    discardShort: 'Descartar',
    // The dialog asks; the button is named after what it does. Same words, and
    // the question mark is not decoration — it is the difference between a title
    // that reads as "this is happening" and one that reads as "shall I".
    discardAsk: '¿Descartar este gasto?',
    discardBody: 'Se pierde lo que has escrito. En la hoja no se apunta nada.',
    discardYes: 'Sí, descartar',
    // Not "Cancelar": the header of this very screen has one of those, and it
    // abandons the entry — which is what this button refuses to do.
    discardNo: 'Seguir editando',
    conceptRow: 'Conceptos frecuentes',
    /** Two rows now, because they are two columns. They shared one field while
     *  the method travelled inside the observaciones. */
    methodRow: 'Medio de pago',
    noteRow: 'Observaciones',
    /** The free-text half of that row. The pills cover what is written down in
     *  the Sugerencias tab; this is for everything nobody thought of. */
    notePlaceholder: 'Escribe una observación',
    /** The same, for the card: the two editing screens show the pills *and* a
     *  box, because a row can hold a method the tab has never heard of. */
    methodPlaceholder: 'Con qué se paga',
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
    /**
     * The sheet with nothing left in it.
     *
     * Reachable even though the banner that opens the sheet is absent when
     * nothing is owed: skipping the last proposal empties the list while the
     * sheet is still up. An empty list under a header that says «Fijos vencidos»
     * reads as something that failed to load.
     */
    noneDue: 'No hay ningún fijo vencido',
    noneDueWhen: 'Cuando le toque al siguiente, te lo propone aquí.',
    close: 'Cerrar',
    skip: 'Saltar',
    /** On the button while the sheet is being told. A press that says nothing is
     *  a press somebody repeats. */
    skipping: 'Saltando…',
    /** And when it did not get there. The period stays owed, which is the safe
     *  half: it gets proposed again. */
    skipFailed: 'No se ha podido saltar. Inténtalo otra vez.',
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
    /** The map under the switch. A real one — streets from OpenStreetMap — which
     *  is a decision with a cost, written up on `PlaceMap` and in section 13. */
    mapLabel: 'Dónde estás, según el móvil',
    mapImproving: 'Afinando la posición…',
    mapSteady: 'La posición ya no mejora',
    mapScale: (metres: number) => `${metres} m`,
    mapCredit: '© OpenStreetMap',
    mapFailed: 'No se ha podido cargar el mapa',
    /**
     * The fold the two lines below live behind now.
     *
     * They were paragraphs at the top of the list — four lines of prose between
     * the header and the sitios themselves, which is a lot of screen for
     * something read once. What is inside them still has to be here, though:
     * they are section 13 of the privacy policy said where the feature is, and
     * that repetition is the whole point of it.
     */
    how: 'Cómo se guardan los sitios',
    // The line that has to be true and has to be visible: the places themselves
    // are not uploaded anywhere, so nobody has to wonder whether they are.
    local: 'Los sitios se guardan solo en este dispositivo. No se suben a la hoja.',
    // And the other half of the truth, since the map arrived: the images come
    // from somebody else's server, and asking for them says roughly where you
    // are. It is on this screen because this is the screen that explains the
    // feature, and hiding it in the policy alone would be hiding it.
    localMap:
      'Se ve un mapa al guardar un sitio, al abrir uno de la lista y al corregir ' +
      'su posición. Las imágenes las sirve OpenStreetMap, que recibe la zona del ' +
      'mapa — un cuadrado de cien metros o más, no el punto exacto — y solo ' +
      'mientras se está viendo. Pedirte permiso solo lo hace «Usar dónde estoy ' +
      'ahora», y por eso el botón lo dice; si ya se lo has dado, esta pantalla lee ' +
      'tu posición para decirte a qué distancia queda cada sitio. Arrastrar el mapa ' +
      'no lee nada.',
    /** The row's own name, because the row is now a button: read out loud, a list
     *  of dates and metres does not say what tapping it does. */
    open: (concept: string) => `Ver «${concept}» en el mapa`,
    /** The detail of one saved place. Its own address — `/sitios/<id>` — so the
     *  back button closes the map instead of leaving the screen. */
    detail: 'Sitio guardado',
    /** Over the map there: the fix is the one written down the day the place was
     *  saved, not where the phone is now, and the difference matters when the
     *  ring is wide. */
    mapSaved: 'Dónde se guardó este sitio',
    /** Under it. The accuracy of that fix is appended by the map itself. */
    mapSavedNote: 'Es la posición que guardó el móvil aquel día',
    /** The other saved places drawn around it — the reason two concepts at one
     *  door are two places, seen rather than explained. */
    mapOthers: (n: number) => (n === 1
      ? 'Hay otro sitio guardado cerca'
      : `Hay ${n} sitios guardados cerca`),
    /**
     * Adding one by hand, from the Sitios screen.
     *
     * The switch on the review step only saves a place while apuntando a gasto
     * there, which is the wrong moment for the two useful cases: the shop you
     * are standing in front of with nothing to apuntar, and the one you want to
     * name and file properly without the queue behind you at the till.
     */
    add: 'Añadir un sitio',
    addTitle: 'Nuevo sitio',
    /** Labelled by what it becomes rather than by what it is: this text is
     *  written into the hoja as the concepto of every gasto apuntado here. */
    addConcept: 'Concepto',
    addConceptHow: 'Es lo que se escribirá en la hoja al apuntar un gasto aquí.',
    addConceptPlaceholder: 'farmacia, super, la de la esquina…',
    addSave: 'Guardar el sitio',
    addNeedConcept: 'Ponle un concepto',
    /** No position, no place: what a place *is* is a position with a concept on
     *  it. Only reachable on a phone that has never granted the permission and
     *  has no saved place to start the map from. */
    addNeedFix: 'Falta la posición: usa dónde estás o arrastra el mapa',
    /** The map when it opens on a guess rather than on a reading. Said out loud
     *  because a map centred on somewhere plausible looks exactly like a map
     *  centred on you. */
    addFromLast: 'Empieza en el último sitio que guardaste',
    addFromHere: 'Empieza donde está el móvil',
    addAgain: 'Ya tenías ese sitio guardado ahí',
    /**
     * Editing what a saved place *is*, on its own detail: its concept and the
     * category it files gastos under.
     *
     * The concept was typed at a till, and it is what gets written into the
     * ledger every time this door is recognised — so a typo from that moment is
     * a typo apuntado for ever. Until now the only cure was deleting the place
     * and starting it again, which threw its `uses` away with it.
     */
    editSave: 'Guardar los cambios',
    editDone: 'Cambios guardados',
    editAgain: 'Ya tienes otro sitio con ese concepto en esta misma puerta',
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
    // Shown instead of the switch when the concept came from a saved place: there
    // is nothing to offer, so the row states a fact rather than asking a question.
    savedHere: 'Este sitio ya lo tenías guardado',
    savedHereWhy: 'El concepto lo ha puesto ese sitio. No hay nada que guardar.',
    denied: 'Sin permiso de ubicación. Se lo puedes dar en los ajustes del navegador.',
    unavailable: 'No se ha podido saber dónde estás',
    here: 'Aquí',
    hereRow: 'Aquí has apuntado',
    distance: (metres: number) => `A ${metres} m de aquí`,
    accuracy: (metres: number) => `±${metres} m`,
    savedOn: (date: string) => `Guardado el ${date}`,
    uses: (n: number) => (n === 0 ? 'Sin usar todavía'
      : n === 1 ? 'Usado una vez'
      : `Usado ${n} veces`),
    close: 'Cerrar',
    forget: 'Borrar este sitio',
    /** The dialog, in the app rather than the browser's — the same one the
     *  review step asks with. The old wording was `window.confirm`'s single
     *  line; this is a question and what it costs. */
    forgetAsk: '¿Borrar este sitio?',
    forgetBody:
      'Dejará de proponerte el concepto al llegar aquí. Los gastos ya apuntados ' +
      'no se tocan.',
    forgetYes: 'Sí, borrar',
    /**
     * The other half of the detail: writing a better fix over the one a place
     * was saved with.
     *
     * The reason it exists is the ±40 m indoors: a place saved through a roof is
     * outside the fifteen-metre tolerance from the first day, so it never comes
     * back, and until now the only cure was deleting it and apuntando another
     * gasto at that door.
     *
     * This button is the third thing in the app that reads the position, so it
     * says so — the rule is that only a control announcing it may prompt. The
     * privacy policy names it too.
     */
    fix: 'Corregir la posición',
    fixHow: 'Arrastra el mapa hasta la puerta, o usa dónde estás ahora.',
    /** The button inside the correction that reads the position — the only one
     *  on this screen that does. Arrastrar el mapa no lee nada. */
    fixHere: 'Usar dónde estoy ahora',
    fixAsking: 'Buscando dónde estás…',
    /** Over the map while a position is being chosen. It says what the gesture
     *  is, because a map that can be moved looks exactly like one that cannot. */
    fixDrag: 'Arrastra el mapa para poner el punto',
    /** Under it, one line per way the point on screen got there. */
    fixFromSaved: 'Es la posición que tiene guardada ahora',
    fixByHand: 'Lo has puesto tú en el mapa',
    fixMoves: (metres: number) => `El sitio se movería ${metres} m`,
    fixSame: 'El sitio se quedaría donde está',
    fixSave: 'Guardar esta posición',
    fixCancel: 'Dejarlo como estaba',
    fixDone: 'Posición corregida',
  },

  /** The in-app dialog's own words — see `components/Confirm.tsx`. The question
   *  and the destructive answer belong to whoever is asking; only the way out is
   *  the same everywhere. */
  confirm: {
    cancel: 'Cancelar',
  },

  /** The category: the bucket, as opposed to the concept, which is whatever was
   *  typed. The two used to be one field. */
  category: {
    label: 'Categoría',
    none: 'Sin categoría',
    pick: 'Elegir categoría',
    search: 'Buscar categoría…',
    close: 'Cerrar',
    empty: 'No hay categorías en la hoja todavía',
  },

  /** The categories, edited from the cog rather than from the spreadsheet — which
   *  is the point: the tab is there for a laptop and this is there for a phone. */
  categories: {
    title: 'Categorías',
    add: 'Nueva categoría',
    edit: (name: string) => `Categoría «${name}»`,
    name: 'Nombre',
    icon: 'Icono',
    words: 'Palabras que la adivinan',
    wordsHelp: 'Separadas por comas. Escribe =algo para que solo valga cuando el '
      + 'concepto sea exactamente eso.',
    save: 'Guardar categoría',
    remove: 'Borrar categoría',
    removeConfirm: (name: string) =>
      `¿Borrar «${name}»? Los gastos ya archivados conservan el nombre.`,
    noneYet: 'Todavía no hay categorías',
    needName: 'Ponle un nombre',
    failed: 'No se ha podido guardar. Necesita conexión.',
    /** The shared-icon warning. Sharing is allowed on purpose; what is not
     *  allowed is doing it by accident. */
    shared: (names: string) => `Ese icono ya lo usa ${names}`,
    sharedWhy: 'Puedes compartirlo, pero en la lista de gastos las dos se verán igual.',
    sharedRecent: 'Últimos gastos de esa categoría',
    sharedNoRows: 'Todavía no hay gastos archivados ahí',
    useAnyway: 'Usarlo igualmente',
    pickAnother: 'Elegir otro',
    /** Under each icon in the grid, so the ones already spoken for say so. */
    usedBy: (names: string) => names,
  },

  list: {
    both: 'Ambos',
    search: 'Buscar concepto…',
    clearSearch: 'Borrar la búsqueda',
    /** On the row itself, next to the concept. The strip above the tab bar says
     *  something is going up; this says which one, which is the question when
     *  the list has thirty rows in it and one of them is yours. */
    unsaved: 'sin subir',
    empty: 'Todavía no hay nada apuntado',
    noResults: 'Ningún gasto con ese concepto',
    noResultsCategory: 'Ningún gasto en esa categoría',
    /** The category filter, which is a second question from the search box: that
     *  one asks what it was called, this one asks what kind of thing it was. */
    byCategory: 'Filtrar por categoría',
    allCategories: 'Todas las categorías',
    clearCategory: 'Quitar el filtro de categoría',
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
    /**
     * The fourth number, and only while a filter is on: what everything that
     * matches adds up to, with no month in it.
     *
     * Asked for in as many words — «un total de todos los apuntes que coincidan
     * con el filtro, sin importar fechas» — because the three cells above answer
     * "how is this month going" and a filter is nearly always asking something
     * else: what does the chemist cost us, what have we spent on the car.
     */
    matchedTotal: 'Total del filtro',
    matchedCount: (n: number) => (n === 1 ? '1 apunte' : `${n} apuntes`),
    /** Both ends of it, like the bar on the Diferencia screen: a total with no
     *  dates on it reads as a total of everything, and this one is a total of
     *  what the app has loaded. */
    matchedRange: (from: string, to: string) => `del ${from} al ${to}`,
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
    /** Said out loud instead of refusing in silence. Pressing Guardar with an
     *  empty amount used to do nothing at all, which reads as a broken button. */
    needAmount: 'Pon un importe mayor que cero',
    needConcept: 'Pon un concepto',
    /** A row whose amount is below zero — money coming back rather than going
     *  out. Those exist on their sheet and this screen cannot write one, so it
     *  says so rather than emptying the field and refusing to save. */
    negative: 'Este apunte tiene un importe negativo y la app todavía no sabe '
      + 'editarlos. Cámbialo en la hoja.',
  },

  balance: {
    ahead: (name: string) => `${name} va por delante`,
    even: 'Estáis a la par',
    splitTitle: 'Repartir una transferencia',
    splitPrompt: 'Cuánto vais a meter al bote',
    splitResult: 'Quedaríais a la par',
    splitCent: 'A la par, salvo un céntimo que no se puede partir',
    splitShort: (amount: string) => `Aún quedaría una diferencia de ${amount}`,
    /** "Aportado en lo que se ve" before, which named the app's own limitation
     *  and not the thing being shown. The stretch of time is said underneath
     *  instead, with both ends of it, so the bar is a total of something. */
    contributed: 'Quién ha puesto cuánto',
    contributedRange: (from: string, to: string) => `Del ${from} al ${to}`,
    contributedEmpty: 'Todavía no hay gastos que repartir',
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
    /** With the count, from two on. One is what the strip being there already
     *  says; three is a number somebody wants to see going down. */
    savingMany: (n: number) => `Guardando ${n} gastos…`,
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
