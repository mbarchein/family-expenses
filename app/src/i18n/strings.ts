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
  },

  add: {
    save: 'Guardar',
    saving: 'Guardando…',
    concept: 'Concepto',
    conceptPlaceholder: 'En qué se ha ido',
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
    savedUndo: 'Guardado',
    undo: 'Deshacer',
    needAmount: 'Pon un importe',
    needConcept: 'Pon un concepto',
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
