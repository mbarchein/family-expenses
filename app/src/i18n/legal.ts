/**
 * The two pages Google's consent screen links to, in Spanish.
 *
 * They live here rather than in strings.ts for room: three hundred lines of
 * legal prose in the middle of the interface copy would ruin that file as the
 * place you go to check what a button says. The boundary CLAUDE.md draws is the
 * same one — everything the user reads is in `i18n/`, and a Spanish string
 * anywhere else is a bug.
 *
 * Written to be true rather than to look thorough. This app holds no database:
 * the expenses are rows in a spreadsheet that already belonged to the two
 * people using it, and sign-in asks for identity and nothing else. A policy
 * that recited the usual paragraphs about our servers and our retention periods
 * would be describing a different application.
 */

/**
 * The address the two pages point at, supplied by CI at build time.
 *
 * Not hardcoded, and not because it is likely to change: because it is a
 * personal email address that ends up on a public page, and a repository is a
 * poor place to keep one. It reaches the bundle exactly the way the backend URL
 * and the OAuth client id do — an Actions variable that Terraform owns, so
 * there is one place per value rather than two that can disagree.
 *
 * The fallback is deliberately loud. A privacy policy with no way to contact
 * anybody is not a privacy policy and Google will say so, and an empty gap on a
 * page nobody reads twice would be easy to miss for months.
 */
const CONTACTO = (import.meta.env.VITE_CONTACT_EMAIL as string) ||
  'PENDIENTE — falta configurar VITE_CONTACT_EMAIL'

export interface LegalSection {
  title: string
  body: string
}

export interface LegalDocument {
  title: string
  updated: string
  intro: string
  sections: LegalSection[]
}

export const LEGAL_BACK = '← Volver a la app'

export const PRIVACY: LegalDocument = {
  title: 'Política de privacidad',
  updated: 'Última actualización: agosto de 2026',
  intro:
    'Esta política explica cómo «A medias» trata tus datos personales conforme al ' +
    'Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018 (LOPDGDD). Es una ' +
    'aplicación de uso privado: la usan las dos personas de una casa para apuntar sus ' +
    'gastos compartidos, y no se ofrece al público.',
  sections: [
    {
      title: '1. Responsable del tratamiento',
      body:
        `Responsable: la persona titular de la hoja de cálculo sobre la que funciona la aplicación.\n` +
        `Contacto: ${CONTACTO}.`,
    },
    {
      title: '2. Datos que tratamos',
      body:
        '• Datos de identidad, obtenidos al entrar con Google: tu nombre, tu dirección de ' +
        'correo electrónico y el identificador que Google asigna a tu cuenta.\n' +
        '• Los gastos que apuntas: fecha, concepto, importe, medio de pago y quién pagó.',
    },
    {
      title: '3. Dónde están tus datos',
      body:
        'Esta aplicación no tiene base de datos ni servidor propio, y esto es lo más ' +
        'importante de toda la política. Los gastos se escriben en una hoja de cálculo de ' +
        'Google que ya era vuestra antes de que la aplicación existiera y que sigue siendo ' +
        'vuestra: la aplicación es una forma cómoda de escribir en ella desde el móvil. No ' +
        'guardamos una copia en ningún otro sitio.',
    },
    {
      title: '4. Finalidad',
      body:
        '• Tu correo electrónico se usa para una sola cosa: comprobar que la hoja de cálculo ' +
        'está compartida contigo, y con qué permiso. Es lo único que decide si puedes entrar ' +
        'y si puedes escribir.\n' +
        '• Tu nombre se usa para saludarte y para saber cuál de las dos columnas de importes ' +
        'es la tuya.\n' +
        '• Los gastos se usan para lo que apuntas: escribir la fila y calcular quién va por ' +
        'delante.',
    },
    {
      title: '5. Base jurídica',
      body:
        '• Tu consentimiento al entrar con Google (art. 6.1.a RGPD), que puedes retirar en ' +
        'cualquier momento revocando el acceso desde tu cuenta de Google.\n' +
        '• La ejecución de lo que nos pides al usar la aplicación (art. 6.1.b RGPD).',
    },
    {
      title: '6. Permisos que pedimos a Google',
      body:
        'Pedimos únicamente los ámbitos «openid», «email» y «profile», que son datos de ' +
        'identidad. La aplicación no pide, en ningún momento, permiso sobre tus hojas de ' +
        'cálculo, tu Drive, tu correo ni tus contactos. Quien escribe en la hoja es un script ' +
        'de Google Apps Script que pertenece a esa misma hoja, no la aplicación desde tu ' +
        'navegador.',
    },
    {
      title: '7. Conservación',
      body:
        'No conservamos nada por nuestra cuenta. Las filas viven en vuestra hoja mientras ' +
        'vosotros las mantengáis, y borrar la hoja borra los datos. En el móvil, la ' +
        'aplicación guarda los gastos que aún no ha podido subir hasta que los sube, y el ' +
        'nombre con el que entraste para no tener que preguntártelo cada vez.',
    },
    {
      title: '8. Destinatarios',
      body:
        'No vendemos ni cedemos datos a nadie. Para funcionar intervienen tres proveedores:\n' +
        '• Google, que aloja la hoja de cálculo, ejecuta el script que la escribe y gestiona ' +
        'el inicio de sesión.\n' +
        '• Vercel, que sirve la página de la aplicación.\n' +
        '• OpenStreetMap, que sirve las imágenes del mapa, y únicamente mientras hay un ' +
        'mapa a la vista — al guardar un sitio o al abrir uno guardado desde «Sitios»: en ' +
        'ese momento es tu navegador el que pide esas imágenes, y openstreetmap.org recibe ' +
        'tu dirección IP y la zona del mapa que hay que dibujar (ver el punto 13).\n' +
        'No hay analítica, ni publicidad, ni herramientas de medición de terceros.',
    },
    {
      title: '9. Transferencias internacionales',
      body:
        'Google y Vercel pueden tratar datos fuera del Espacio Económico Europeo. En ese ' +
        'caso, las transferencias se amparan en decisiones de adecuación o en las Cláusulas ' +
        'Contractuales Tipo de la Comisión Europea. La Fundación OpenStreetMap tiene su sede ' +
        'en el Reino Unido y sirve las imágenes del mapa desde una red de distribución con ' +
        'servidores en varios países; esas peticiones las hace tu navegador directamente, y ' +
        'solo mientras se está mostrando el mapa.',
    },
    {
      title: '10. Tus derechos',
      body:
        'Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, ' +
        `limitación y portabilidad escribiendo a ${CONTACTO}.\n` +
        'En la práctica, aquí varios de esos derechos los ejerces tú directamente: los datos ' +
        'son tu propia hoja de cálculo, así que acceder es abrirla, rectificar es editarla y ' +
        'suprimir es borrarla. Dejar de tener acceso a la aplicación es dejar de tener la hoja ' +
        'compartida. También puedes presentar una reclamación ante la Agencia Española de ' +
        'Protección de Datos (www.aepd.es).',
    },
    {
      title: '11. Seguridad',
      body:
        'Todo el tráfico va cifrado (HTTPS). La autorización no es una lista nuestra: es la ' +
        'propia lista de personas con las que está compartida la hoja, consultada a Google en ' +
        'cada uso. Compartir la hoja da acceso y dejar de compartirla lo quita. El testigo de ' +
        'identidad que el navegador envía caduca en menos de una hora y no se guarda en ' +
        'ningún servidor.',
    },
    {
      title: '12. Almacenamiento en el navegador',
      body:
        'La aplicación usa el almacenamiento local del navegador para cuatro cosas: la cola ' +
        'de gastos pendientes de subir, para que puedas apuntar sin cobertura; el gasto que ' +
        'estás escribiendo, para no perderlo si se cierra la app; los sitios que hayas ' +
        'guardado (ver el punto 13); y tu perfil, para no pedirte la sesión cada vez. No ' +
        'usamos cookies de seguimiento ni publicitarias. Borrar los datos del sitio en tu ' +
        'navegador lo borra todo.',
    },
    {
      title: '13. Ubicación',
      body:
        'La aplicación puede pedirte permiso para saber dónde estás, y solo cuando pulsas ' +
        '«Guardar este sitio» al apuntar un gasto. Sirve para una cosa: reconocer que ' +
        'estás en un sitio que ya guardaste y proponerte el mismo concepto. Las ' +
        'coordenadas se guardan únicamente en el almacenamiento de tu navegador, en tu ' +
        'dispositivo: no se envían a nuestro servidor, no se escriben en la hoja de ' +
        'cálculo y la otra persona de la casa no las ve. Hay un mapa a la vista en dos ' +
        'momentos: con ese interruptor encendido, y cuando abres uno de los sitios que ya ' +
        'has guardado desde la pantalla «Sitios». En ese segundo caso el mapa es el del ' +
        'sitio guardado, con la posición que quedó anotada aquel día, y no se lee la tuya ' +
        'de ahora. Las imágenes las sirve OpenStreetMap: para pedirlas, tu navegador se ' +
        'conecta a openstreetmap.org, que recibe tu dirección IP y la zona del mapa que ' +
        'hay que dibujar. Esa zona es un cuadrado de cien metros o más, no el punto ' +
        'exacto, y no se pide nada mientras no estés viendo un mapa. Son las dos únicas ' +
        'circunstancias en las que algo relativo a una posición, la tuya o la de un sitio ' +
        'guardado, sale del dispositivo. Puedes borrar cada sitio desde «Sitios», y retirar ' +
        'el permiso en los ajustes de tu navegador. Si no concedes el permiso, el resto ' +
        'de la aplicación funciona igual.',
    },
    {
      title: '14. Cambios',
      body:
        'Si esta política cambia, cambiará esta página, y la fecha de arriba lo dirá.',
    },
  ],
}

export const TERMS: LegalDocument = {
  title: 'Términos y condiciones',
  updated: 'Última actualización: agosto de 2026',
  intro:
    'Condiciones de uso de «A medias», conforme a la Ley 34/2002 (LSSI-CE).',
  sections: [
    {
      title: '1. Titular',
      body:
        `Titular: la persona titular de la hoja de cálculo sobre la que funciona la aplicación.\n` +
        `Contacto: ${CONTACTO}.`,
    },
    {
      title: '2. Qué es esto, y para quién',
      body:
        'Es una aplicación de uso privado, hecha para las dos personas de una casa que ' +
        'comparten una hoja de cálculo de gastos. No es un servicio abierto al público, no se ' +
        'cobra por ella y no se ofrece a nadie más. El acceso se concede compartiendo la hoja ' +
        'de cálculo y se retira dejando de compartirla; no hay registro, ni alta, ni cuenta ' +
        'que crear.',
    },
    {
      title: '3. Uso aceptable',
      body:
        'Usar la aplicación implica aceptar estas condiciones. Te comprometes a usarla ' +
        'lícitamente y a no perjudicar su funcionamiento ni los datos de la otra persona que ' +
        'comparte la hoja.',
    },
    {
      title: '4. Propiedad intelectual',
      body:
        'El software y el diseño pertenecen a su autor. Los datos que apuntas no: son ' +
        'vuestros, y están en vuestra hoja de cálculo.',
    },
    {
      title: '5. Responsabilidad',
      body:
        'El servicio se presta «tal cual», sin garantía de disponibilidad ni de ausencia de ' +
        'errores. En la medida en que la ley lo permita, el titular no responde de los daños ' +
        'derivados del uso de la aplicación ni de la indisponibilidad de Google o de Vercel.\n' +
        'Una advertencia concreta, porque es la que importa: la aplicación escribe en vuestra ' +
        'hoja de cálculo. Añade filas al final y nunca borra ninguna, pero conviene tener una ' +
        'copia de la hoja, como con cualquier cosa que os importe. El saldo que muestra la ' +
        'aplicación es el que calcula la fórmula de la propia hoja, no un número que la ' +
        'aplicación se invente: si los dos no coinciden, el que manda es el de la hoja.',
    },
    {
      title: '6. Terceros',
      body:
        'La aplicación funciona sobre servicios de Google (hoja de cálculo, script e inicio de ' +
        'sesión) y de Vercel (alojamiento). Sus condiciones y políticas son las suyas, y el ' +
        'titular no responde de ellas.',
    },
    {
      title: '7. Legislación y jurisdicción',
      body:
        'Estas condiciones se rigen por la legislación española. Para cualquier controversia, ' +
        'las partes se someten a los juzgados y tribunales del domicilio del titular, salvo ' +
        'que una norma imperativa disponga otra cosa.',
    },
  ],
}
