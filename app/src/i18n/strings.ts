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

  tabs: {
    add: 'Añadir',
    list: 'Gastos',
    balance: 'Diferencia',
    places: 'Sitios',
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
    thisYear: 'Año',
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
    pending: (n: number) => (n === 1 ? '1 gasto sin subir' : `${n} gastos sin subir`),
    offline: 'Sin conexión · se subirá solo',
    failed: 'No se ha podido subir',
  },

  errors: {
    generic: 'Algo ha salido mal',
    network: 'No se ha podido conectar',
    configMissing: 'Falta configuración en la hoja. Mira la pestaña Config.',
  },
} as const
