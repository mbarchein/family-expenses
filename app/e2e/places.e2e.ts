import { expect, test, type Locator, type Page } from '@playwright/test'
import { signIn, stubApi, stubGoogle } from './harness'

/**
 * Places, with the browser's own geolocation stubbed by Playwright.
 *
 * The 15 m tolerance is the whole feature and it is not testable by reading the
 * code: what matters is that a coordinate 12 m away is the same shop and one
 * 40 m away is not, end to end, through the store and the chips. Playwright can
 * move the phone, so it does.
 */

// A doorway in Granada. Fine detail matters here — a longitude degree is a
// fifth shorter than a latitude one at this latitude — so all the movement in
// these tests is north, where the arithmetic is the same everywhere.
const DOOR = { latitude: 37.1773, longitude: -3.5986 }
const METRE = 1 / 111_195
const northOf = (metres: number) => ({ ...DOOR, latitude: DOOR.latitude + metres * METRE })

const next = (page: Page) => page.getByRole('button', { name: 'Siguiente' }).click()
const key = (page: Page, digit: string) =>
  page.getByRole('button', { name: digit, exact: true }).click()

async function typeAmount(page: Page, digits: string) {
  for (const digit of digits) await key(page, digit === '.' ? ',' : digit)
}

/** The second step, where a place lends its concept back. */
async function reachDetails(page: Page) {
  await typeAmount(page, '10')
  await next(page)
}

/** The third step with a concept in, which is where the switch lives. */
async function reachReview(page: Page, concept: string) {
  await reachDetails(page)
  await page.getByRole('textbox', { name: 'Concepto' }).fill(concept)
  await next(page)
}

/** Turns the place switch on and waits for the coordinate it shows. */
async function savePlace(page: Page) {
  const toggle = page.getByRole('switch', { name: 'Guardar este sitio' })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  // The coordinate is the point of showing it: a fix is only trustworthy if you
  // can see how sure of itself the phone was.
  await expect(toggle).toContainText('37.17730, -3.59860')
  return toggle
}

/** Drags the map inside a sheet by so many pixels, in steps, the way a thumb
 *  does — one jump from press to release is a gesture some handlers never see. */
async function drag(page: Page, sheet: Locator, dx: number, dy: number) {
  const map = sheet.getByRole('img', { name: /Arrastra el mapa/ })
  const box = await map.boundingBox()
  if (!box) throw new Error('the map has no box to drag')
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let step = 1; step <= 8; step++) {
    await page.mouse.move(from.x + (dx * step) / 8, from.y + (dy * step) / 8)
  }
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await stubGoogle(page)
})

test.describe('with the location allowed', () => {
  test.use({ permissions: ['geolocation'], geolocation: DOOR })

  test('a saved place comes back as a card that fills the concept and the card', async ({ page }) => {
    const calls = await stubApi(page)
    await signIn(page)

    // A concept that is in neither list, so finding it later can only mean the
    // place produced it.
    await reachDetails(page)
    await page.getByRole('textbox', { name: 'Concepto' }).fill('ferretería')
    await page.getByRole('button', { name: 'Tarjeta BBVA' }).click()
    await next(page)
    await savePlace(page)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()

    await reachDetails(page)
    const cards = page.getByRole('group', { name: 'Aquí has apuntado' })
    const card = cards.getByRole('button').first()
    // The card prints both halves of what it is about to fill in, and how far
    // away the doorway is.
    await expect(card).toContainText('ferretería')
    await expect(card).toContainText('Tarjeta BBVA')
    await expect(card).toContainText('m de aquí')

    // One tap, both fields.
    await card.click()
    await expect(page.getByRole('textbox', { name: 'Concepto' })).toHaveValue('ferretería')
    await expect(card).toHaveAttribute('aria-pressed', 'true')
    await next(page)
    await expect(page.getByText('Tarjeta BBVA')).toBeVisible()

    // And the one thing that must never happen: no coordinate ever left the
    // device. Nothing sent to the backend contains the place.
    expect(JSON.stringify(calls)).not.toContain('37.17')
    expect(JSON.stringify(calls)).not.toContain('-3.59')
  })

  test('a concept lent by a saved place is told, not offered', async ({ page }) => {
    // The switch says "Guardar este sitio". When the concept came off one of the
    // cards, that doorway is already in the list and the switch would be offering
    // to save what is saved — so the row states the fact instead, and no position
    // is read and no tile is fetched for it.
    await stubApi(page)
    await signIn(page)

    await reachReview(page, 'ferretería')
    await savePlace(page)
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()

    // Second time round, from the card.
    await reachDetails(page)
    await page.getByRole('group', { name: 'Aquí has apuntado' }).getByRole('button').first().click()
    await next(page)

    await expect(page.getByText('Este sitio ya lo tenías guardado')).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Guardar este sitio' })).toHaveCount(0)
    await expect(page.getByRole('img', { name: /Dónde estás/ })).toHaveCount(0)

    // Saving it counts a use, which is the thing the switch used to do here and
    // the thing that orders the cards. Read off the Sitios screen rather than out
    // of the database: it is the screen that shows the number.
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()
    await page.getByRole('button', { name: 'Sitios' }).click()
    await expect(page.getByRole('listitem').filter({ hasText: 'ferretería' }))
      .toContainText('Usado 2 veces')

    // And editing the concept puts the offer back, because the claim was about
    // that concept at that doorway and it is no longer the same one.
    await page.getByRole('button', { name: 'Añadir', exact: true }).click()
    await reachDetails(page)
    await page.getByRole('group', { name: 'Aquí has apuntado' }).getByRole('button').first().click()
    await page.getByRole('textbox', { name: 'Concepto' }).fill('estanco')
    await next(page)
    await expect(page.getByRole('switch', { name: 'Guardar este sitio' })).toBeVisible()
    await expect(page.getByText('Este sitio ya lo tenías guardado')).toHaveCount(0)
  })

  test('tapping the card again clears both fields', async ({ page }) => {
    await stubApi(page)
    await signIn(page)

    await reachReview(page, 'ferretería')
    await savePlace(page)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()

    await reachDetails(page)
    const card = page.getByRole('group', { name: 'Aquí has apuntado' }).getByRole('button').first()
    await card.click()
    await expect(page.getByRole('textbox', { name: 'Concepto' })).toHaveValue('ferretería')
    await card.click()
    await expect(page.getByRole('textbox', { name: 'Concepto' })).toHaveValue('')
  })

  test('two things apuntados at one doorway are two cards, and still fit', async ({ page }) => {
    // A place is a location *and* a concept: the pharmacy and the supermarket in
    // the same square are two places. Also the height check — a row of cards
    // that grew downwards would push the keyboard and the button off a phone.
    await stubApi(page)
    await signIn(page)

    for (const concept of ['ferretería', 'estanco']) {
      await reachReview(page, concept)
      await savePlace(page)
      await page.getByRole('button', { name: 'Guardar' }).click()
      await expect(page.getByText('Paso 1 de 3')).toBeVisible()
    }

    await reachDetails(page)
    const cards = page.getByRole('group', { name: 'Aquí has apuntado' })
    await expect(cards.getByRole('button')).toHaveCount(2)

    const overflows = await page.evaluate(
      () => document.scrollingElement!.scrollHeight > window.innerHeight + 1,
    )
    expect(overflows).toBe(false)
  })

  test('the switch shows a map, and asks for tiles at tile granularity',
    async ({ page }) => {
    // This used to assert that turning the switch on fetched *nothing*, and the
    // schematic it was guarding got reported as circles that add nothing. The map
    // is real now, so the claim is narrower and this is where it is kept honest:
    // tiles go out, they go to openstreetmap.org and nowhere else, and the URLs
    // name a tile — a hundred metres or more — rather than the doorway.
    await stubApi(page)
    await signIn(page)
    await reachDetails(page)
    await page.getByRole('textbox', { name: 'Concepto' }).fill('ferretería')
    await next(page)

    // Watched from here on, so the fonts the whole app loads at startup are not
    // counted against the switch.
    const outbound: string[] = []
    page.on('request', request => {
      const url = request.url()
      if (!url.startsWith('http://localhost') && !url.includes('/macros/s/')) outbound.push(url)
    })

    await savePlace(page)
    await expect(page.getByRole('img', { name: /Dónde estás/ })).toBeVisible()
    // The accuracy as a number beside it, because a circle is not one.
    await expect(page.getByText(/±\d+ m/).first()).toBeVisible()
    // And whose streets these are, which is both the licence and the disclosure.
    await expect(page.getByRole('link', { name: '© OpenStreetMap' })).toBeVisible()

    await expect.poll(() => outbound.length).toBeGreaterThan(0)
    await page.waitForTimeout(500)

    // Nowhere but the tile server.
    expect(outbound.filter(url => !url.includes('tile.openstreetmap.org'))).toEqual([])

    // The coordinate itself is not in any of those URLs: they carry z/x/y, and
    // the mosaic is centred on the tile the fix is in rather than on the fix, so
    // the set of tiles asked for is the same for anybody standing in this square.
    expect(outbound.join(' ')).not.toContain('37.17')
    expect(outbound.join(' ')).not.toContain('3.59')
    for (const url of outbound) {
      expect(url).toMatch(/tile\.openstreetmap\.org\/\d{1,2}\/\d+\/\d+\.png$/)
    }
  })

  test('the tiles are the same ones for a doorway a few metres away',
    async ({ page, context }) => {
    // The promise in section 13 as an assertion: what leaves is the square, not
    // the point. Two positions eight metres apart — different doorways, and near
    // enough that the 15 m tolerance calls them the same place — must ask for the
    // same tiles, or the set of URLs would narrow the position down past what the
    // policy says it does. The fixture doorway is 58 m from the nearest tile edge
    // at every zoom this map uses, so eight metres cannot cross one by accident.
    //
    // Read off the `img` elements rather than off the network, which is what this
    // test got wrong first time round and CI caught: the second reading asks for
    // the very same URLs, so the browser serves them from its own cache and no
    // request goes out at all. What the app *asks for* is the claim; the test
    // above is the one that watches the wire.
    await stubApi(page)
    await signIn(page)

    const tiles = () => page.locator('img[src*="tile.openstreetmap.org"]')
      .evaluateAll(images => (images as HTMLImageElement[]).map(image => image.src).sort())

    const toggle = page.getByRole('switch', { name: 'Guardar este sitio' })
    await reachReview(page, 'ferretería')
    await toggle.click()
    await expect.poll(() => tiles().then(list => list.length)).toBeGreaterThan(0)
    const atDoor = await tiles()

    // Off and on again, which is what makes it read the position a second time.
    await context.setGeolocation(northOf(8))
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await toggle.click()
    // The new coordinate on screen, so this is not the old fix being compared
    // with itself — eight metres north is the fifth decimal.
    await expect(toggle).toContainText('37.17737')

    // Polled rather than read once: the map measures itself before it knows how
    // many tiles wide it is, so the first render after it comes back has no
    // images in it at all. Read on that frame this would compare a set against
    // nothing — green here, red on a slower machine, which is the whole genre of
    // test this suite has been bitten by before.
    await expect.poll(() => tiles()).toEqual(atDoor)
  })

  test('the switch off means nothing is saved', async ({ page }) => {
    // The whole reason it is a switch: turning it on is a decision that can be
    // taken back before the expense is written, and the place is written with
    // the expense rather than the moment the switch moves.
    await stubApi(page)
    await signIn(page)

    await reachReview(page, 'ferretería')
    const toggle = await savePlace(page)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')

    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()

    await page.getByRole('button', { name: 'Sitios' }).click()
    await expect(page.getByText('Todavía no has guardado ningún sitio')).toBeVisible()
  })

  test('a discarded expense leaves no place behind', async ({ page }) => {
    await stubApi(page)
    await signIn(page)

    await reachReview(page, 'ferretería')
    await savePlace(page)
    await page.getByRole('button', { name: 'Descartar este gasto' }).click()
    // Through the confirmation, which is in the app rather than the browser's.
    await page.getByRole('button', { name: 'Sí, descartar' }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()

    await page.getByRole('button', { name: 'Sitios' }).click()
    await expect(page.getByText('Todavía no has guardado ningún sitio')).toBeVisible()
  })

  test('forty metres away is somewhere else', async ({ page, context }) => {
    // The tolerance, end to end. Fifteen metres is the radius, so a doorway
    // forty metres up the street is a different shop and must not lend its
    // concept — that is the difference between this and a feature that suggests
    // "super" everywhere in the neighbourhood.
    await stubApi(page)
    await signIn(page)

    await reachReview(page, 'ferretería')
    await savePlace(page)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()

    await context.setGeolocation(northOf(40))
    await reachDetails(page)

    await expect(page.getByRole('button', { name: 'farmacia' })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Aquí has apuntado' })).toHaveCount(0)

    // Still saved, though — it is out of range, not forgotten.
    await page.getByRole('button', { name: 'Sitios' }).click()
    await expect(page.getByRole('listitem').filter({ hasText: 'ferretería' })).toHaveCount(1)
  })

  test('a saved place opens on the map it was saved from', async ({ page }) => {
    // Reported: the list says "±18 m, a 34 m de aquí", which is arithmetic about
    // a doorway nobody can picture. So the row opens the same map the review step
    // drew — and it has to be the *saved* fix rather than a fresh one, which is
    // what comparing the two sets of tiles proves.
    await stubApi(page)
    await signIn(page)

    const tiles = () => page.locator('img[src*="tile.openstreetmap.org"]')
      .evaluateAll(images => (images as HTMLImageElement[]).map(image => image.src).sort())

    await reachReview(page, 'ferretería')
    await savePlace(page)
    await expect.poll(() => tiles().then(list => list.length)).toBeGreaterThan(0)
    const atDoor = await tiles()
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()

    await page.getByRole('button', { name: 'Sitios' }).click()
    await page.getByRole('button', { name: 'Ver «ferretería» en el mapa' }).click()

    // Its own address, so the back button closes the map rather than the screen.
    await expect(page).toHaveURL(/\/sitios\/[0-9a-f-]+$/)
    const sheet = page.getByRole('dialog', { name: 'Sitio guardado' })
    await expect(sheet.getByRole('img', { name: 'Dónde se guardó este sitio' })).toBeVisible()
    // The fix that was written down that day, not where the phone is now: the
    // same square of the world, so the same tiles and nothing new asked for.
    await expect.poll(() => tiles()).toEqual(atDoor)

    await page.goBack()
    await expect(sheet).toHaveCount(0)
    await expect(page.getByRole('listitem').filter({ hasText: 'ferretería' })).toHaveCount(1)
  })

  test('the map of a place shows the other places saved around it', async ({ page, context }) => {
    // Why one door offers two concepts, seen instead of explained. Forty metres
    // is outside the 15 m tolerance — two different shops — and well inside the
    // 120 m the detail draws.
    await stubApi(page)
    await signIn(page)

    await reachReview(page, 'ferretería')
    await savePlace(page)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()

    await context.setGeolocation(northOf(40))
    await reachReview(page, 'floristería')
    const toggle = page.getByRole('switch', { name: 'Guardar este sitio' })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()

    await page.getByRole('button', { name: 'Sitios' }).click()
    await page.getByRole('button', { name: 'Ver «ferretería» en el mapa' }).click()

    const sheet = page.getByRole('dialog', { name: 'Sitio guardado' })
    await expect(sheet.getByText('Hay otro sitio guardado cerca')).toBeVisible()
    // Both names on the map itself — the one being looked at, over the dot, and
    // the neighbour where it stands. Scoped to the map, because the header of the
    // sheet carries the same word.
    const map = sheet.getByRole('img', { name: 'Dónde se guardó este sitio' })
    await expect(map.getByText('floristería')).toBeVisible()
    await expect(map.getByText('ferretería')).toBeVisible()
  })

  test('the point can be dragged onto the door the phone cannot find',
    async ({ page, context }) => {
    // The case standing still cannot fix: the phone says the far side of the
    // block and the person holding it can see which doorway it should be. Asked
    // for in as many words — corregir desplazando el mapa.
    await stubApi(page)
    await signIn(page)

    await reachReview(page, 'ferretería')
    await savePlace(page)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()

    // The door is forty metres north of where the fix landed. The phone is left
    // there for the last step of this test, and never asked in the middle of it.
    await context.setGeolocation(northOf(40))
    await page.getByRole('button', { name: 'Sitios' }).click()
    await page.getByRole('button', { name: 'Ver «ferretería» en el mapa' }).click()
    const sheet = page.getByRole('dialog', { name: 'Sitio guardado' })
    await sheet.getByRole('button', { name: 'Corregir la posición' }).click()

    // Dragging downwards brings what was above the centre into it, so the point
    // goes north: 42 px is about 40 m at this latitude and zoom. If the sign were
    // the other way round this would put the place eighty metres from the door
    // and the last assertion below would fail — which is the point of doing it
    // end to end rather than only in `mercator.test.ts`.
    await drag(page, sheet, 0, 42)
    await expect(sheet.getByText(/El sitio se movería (3\d|4\d) m/)).toBeVisible()
    // Placed by hand, so the accuracy is no longer the device's claim about a fix
    // that has been thrown away.
    await expect(sheet.getByText('Lo has puesto tú en el mapa')).toBeVisible()
    await expect(sheet.getByText(/±10 m/)).toBeVisible()

    await sheet.getByRole('button', { name: 'Guardar esta posición' }).click()
    await expect(sheet.getByText('Posición corregida')).toBeVisible()

    // And the point of the whole thing: the concept comes back at the door now.
    await sheet.getByRole('button', { name: 'Cerrar' }).click()
    await page.getByRole('button', { name: 'Añadir', exact: true }).click()
    await reachDetails(page)
    await expect(page.getByRole('group', { name: 'Aquí has apuntado' })
      .getByRole('button', { name: /ferretería/ })).toBeVisible()
  })

  test('dragging the map asks the device for nothing', async ({ page, context }) => {
    // The promise in section 13 and on the Sitios screen: correcting by hand
    // reads no position, so it works with the permission gone and never prompts.
    await stubApi(page)
    await signIn(page)

    await reachReview(page, 'ferretería')
    await savePlace(page)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()

    // Taken away after the place was saved, which is the only order this can
    // happen in: saving one needs the position, correcting it does not.
    await context.clearPermissions()
    await page.getByRole('button', { name: 'Sitios' }).click()
    await page.getByRole('button', { name: 'Ver «ferretería» en el mapa' }).click()
    const sheet = page.getByRole('dialog', { name: 'Sitio guardado' })

    await sheet.getByRole('button', { name: 'Corregir la posición' }).click()
    await drag(page, sheet, -30, 0)
    await expect(sheet.getByText(/El sitio se movería \d+ m/)).toBeVisible()
    await sheet.getByRole('button', { name: 'Guardar esta posición' }).click()
    await expect(sheet.getByText('Posición corregida')).toBeVisible()
  })

  test('a place can be added by hand, with a concept and a category',
    async ({ page }) => {
    // The switch on the review step only saves a place while a gasto is being
    // apuntado there, which misses the two useful moments: the shop you are
    // standing outside with nothing to apuntar, and the one you want to file
    // properly rather than with whatever the guess made of its concept.
    await stubApi(page)
    await signIn(page)
    await page.getByRole('button', { name: 'Sitios' }).click()

    await page.getByRole('button', { name: 'Añadir un sitio' }).click()
    const form = page.getByRole('dialog', { name: 'Nuevo sitio' })
    // The map opens on the phone, which is allowed here — and it says so, since a
    // map centred on somewhere plausible looks exactly like one centred on you.
    await expect(form.getByText('Empieza donde está el móvil')).toBeVisible()

    await form.getByRole('textbox', { name: 'Concepto' }).fill('farmacia')
    await form.getByRole('button', { name: 'Elegir categoría' }).click()
    await page.getByRole('dialog', { name: 'Elegir categoría' })
      .getByRole('button', { name: 'Luz' }).click()
    await form.getByRole('button', { name: 'Guardar el sitio' }).click()

    // On the list, with the category it files under and a counter that has not
    // started: nothing has been spent here yet.
    const row = page.getByRole('listitem').filter({ hasText: 'farmacia' })
    await expect(row).toContainText('Luz')
    await expect(row).toContainText('Sin usar todavía')

    // And the payoff: the doorway offers its concept *and* hands over the
    // category, instead of the second step guessing one from the word.
    // Exact: the button on this screen is called "Añadir un sitio" and a loose
    // match takes it instead of the tab.
    await page.getByRole('button', { name: 'Añadir', exact: true }).click()
    await reachDetails(page)
    await page.getByRole('group', { name: 'Aquí has apuntado' })
      .getByRole('button', { name: /farmacia/ }).click()
    await expect(page.getByRole('textbox', { name: 'Concepto' })).toHaveValue('farmacia')
    await expect(page.getByRole('button', { name: 'Elegir categoría' })).toContainText('Luz')
  })

  test('adding a place that is already there says so instead of listing it twice',
    async ({ page }) => {
    await stubApi(page)
    await signIn(page)
    await page.getByRole('button', { name: 'Sitios' }).click()

    for (const attempt of [1, 2]) {
      await page.getByRole('button', { name: 'Añadir un sitio' }).click()
      const form = page.getByRole('dialog', { name: 'Nuevo sitio' })
      await form.getByRole('textbox', { name: 'Concepto' }).fill('farmacia')
      await form.getByRole('button', { name: 'Guardar el sitio' }).click()
      if (attempt === 2) {
        // The same concept at the same doorway is the same place — the store says
        // so, and the form says it out loud rather than closing on a no-op.
        await expect(form.getByRole('alert')).toContainText('Ya tenías ese sitio')
        await form.getByRole('button', { name: 'Cerrar' }).click()
      }
    }

    await expect(page.getByRole('listitem').filter({ hasText: 'farmacia' })).toHaveCount(1)
  })

  test('a place needs a concept before it can be saved', async ({ page }) => {
    // A place is a position with a concept on it: without the word there is
    // nothing to offer at that doorway later.
    await stubApi(page)
    await signIn(page)
    await page.getByRole('button', { name: 'Sitios' }).click()
    await page.getByRole('button', { name: 'Añadir un sitio' }).click()

    const form = page.getByRole('dialog', { name: 'Nuevo sitio' })
    await form.getByRole('button', { name: 'Guardar el sitio' }).click()
    await expect(form.getByRole('alert')).toContainText('Ponle un concepto')
    await expect(form).toBeVisible()
  })

  test('a place saved with a gasto keeps the category that gasto was filed under',
    async ({ page }) => {
    // The switch saves the place with the expense, and the category it carries is
    // the one on screen, which somebody may just have corrected by hand. Better
    // than re-guessing it from the concept next time.
    await stubApi(page)
    await signIn(page)

    await reachDetails(page)
    await page.getByRole('textbox', { name: 'Concepto' }).fill('ferretería')
    await page.getByRole('button', { name: 'Elegir categoría' }).click()
    await page.getByRole('dialog', { name: 'Elegir categoría' })
      .getByRole('button', { name: 'Colegio' }).click()
    await next(page)
    await savePlace(page)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()

    await page.getByRole('button', { name: 'Sitios' }).click()
    await expect(page.getByRole('listitem').filter({ hasText: 'ferretería' }))
      .toContainText('Colegio')
  })

  test('the places screen lists what was saved and can forget it', async ({ page }) => {
    await stubApi(page)
    await signIn(page)

    await reachReview(page, 'ferretería')
    await savePlace(page)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()

    await page.getByRole('button', { name: 'Sitios' }).click()
    const row = page.getByRole('listitem').filter({ hasText: 'ferretería' })
    await expect(row).toHaveCount(1)

    // The line that has to be on this screen: it says where the coordinates
    // live. It is folded away now — it was four lines of prose above the list —
    // but folded is not gone, and this is what says so: it is one tap from the
    // list, and the same promise as section 13 of the policy.
    await expect(page.getByText('solo en este dispositivo')).toBeHidden()
    await page.getByText('Cómo se guardan los sitios').click()
    await expect(page.getByText('solo en este dispositivo')).toBeVisible()
    await expect(page.getByText(/Usar dónde estoy ahora/)).toBeVisible()

    // Borrar lives inside the place now rather than on the row: a destructive
    // button a thumb's width from a row that scrolls past it is a button to
    // press by accident. And it asks with the app's own dialog — no
    // `page.once('dialog')` here, because there is no browser dialog any more.
    await row.getByRole('button', { name: /Ver «ferretería»/ }).click()
    await page.getByRole('button', { name: 'Borrar este sitio' }).click()
    await page.getByRole('dialog', { name: '¿Borrar este sitio?' })
      .getByRole('button', { name: 'Sí, borrar' }).click()

    await expect(page.getByText('Todavía no has guardado ningún sitio')).toBeVisible()
    // The sheet went with it: what it was showing does not exist.
    await expect(page.getByRole('dialog', { name: 'Sitio guardado' })).toHaveCount(0)
  })

  test('a place saved with a bad fix can be corrected to where you are standing',
    async ({ page, context }) => {
    // The failure this answers: a place saved indoors at ±40 m is outside its own
    // fifteen-metre tolerance from the day it was written, so it never comes back
    // — and deleting it was the only cure this screen offered.
    await stubApi(page)
    await signIn(page)

    await reachReview(page, 'ferretería')
    await savePlace(page)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()

    // Forty metres up the street, which is where the door actually is: outside
    // the tolerance, so nothing would ever match it from here.
    await context.setGeolocation(northOf(40))
    await page.getByRole('button', { name: 'Sitios' }).click()
    await page.getByRole('button', { name: 'Ver «ferretería» en el mapa' }).click()
    const sheet = page.getByRole('dialog', { name: 'Sitio guardado' })

    await sheet.getByRole('button', { name: 'Corregir la posición' }).click()
    // It opens on the position the place already has — nothing read, nothing
    // moved — and only then is the device asked.
    await expect(sheet.getByText('El sitio se quedaría donde está')).toBeVisible()
    await sheet.getByRole('button', { name: 'Usar dónde estoy ahora' }).click()

    // Nothing is written yet: the map now shows where the phone is, with the old
    // position beside it and how far the move would be.
    await expect(sheet.getByRole('img', { name: 'Arrastra el mapa para poner el punto' }))
      .toBeVisible()
    await expect(sheet.getByText(/El sitio se movería 4\d m/)).toBeVisible()

    await sheet.getByRole('button', { name: 'Guardar esta posición' }).click()
    await expect(sheet.getByText('Posición corregida')).toBeVisible()
    // Back to the place's own map, on the corrected fix — the phone is standing
    // on it now, so the distance from here is nothing.
    await expect(sheet.getByRole('img', { name: 'Dónde se guardó este sitio' })).toBeVisible()
    await expect(sheet.getByText('A 0 m de aquí')).toBeVisible()

    // And the point of all of it: the concept comes back at this doorway now.
    // The sheet covers the screen, tab bar included, so it is closed first —
    // which is also the gesture a person makes here.
    await sheet.getByRole('button', { name: 'Cerrar' }).click()
    await page.getByRole('button', { name: 'Añadir', exact: true }).click()
    await reachDetails(page)
    await expect(page.getByRole('group', { name: 'Aquí has apuntado' })
      .getByRole('button', { name: /ferretería/ })).toBeVisible()
  })

  test('a correction can be looked at and turned down', async ({ page, context }) => {
    // Cancelling has to leave the place exactly as it was: this is a screen that
    // overwrites the one thing a place is.
    await stubApi(page)
    await signIn(page)

    await reachReview(page, 'ferretería')
    await savePlace(page)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()

    await context.setGeolocation(northOf(40))
    await page.getByRole('button', { name: 'Sitios' }).click()
    await page.getByRole('button', { name: 'Ver «ferretería» en el mapa' }).click()
    const sheet = page.getByRole('dialog', { name: 'Sitio guardado' })

    await sheet.getByRole('button', { name: 'Corregir la posición' }).click()
    await sheet.getByRole('button', { name: 'Usar dónde estoy ahora' }).click()
    await expect(sheet.getByText(/El sitio se movería 4\d m/)).toBeVisible()
    await sheet.getByRole('button', { name: 'Dejarlo como estaba' }).click()

    await expect(sheet.getByRole('img', { name: 'Dónde se guardó este sitio' })).toBeVisible()
    // Forty metres away, exactly as it was saved.
    await expect(sheet.getByText(/A 4\d m de aquí/)).toBeVisible()
  })
})

test.describe('with the location not allowed', () => {
  test('nothing is suggested and nothing is asked for', async ({ page }) => {
    // The permission is undecided here, which is the state every user starts in.
    // The screen must not read the position and must not raise a dialog: the
    // chips are the ones the sheet and the history gave it, in that order.
    await stubApi(page)
    await signIn(page)
    await reachDetails(page)

    const concepts = page.getByRole('group', { name: 'Conceptos frecuentes' })
    await expect(concepts.getByRole('button').first()).toHaveText('farmacia')
    await expect(page.getByRole('group', { name: 'Aquí has apuntado' })).toHaveCount(0)
  })

  test('a refusal is said out loud rather than going quiet', async ({ page }) => {
    // The refusal is stubbed rather than left to the browser: an undecided
    // prompt in a headless Chromium neither denies nor answers, and what is
    // being tested is what the screen does with a no — a switch that silently
    // sprang back would be indistinguishable from a broken one, and this app
    // cannot re-ask for a permission it has been refused.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (_ok: unknown, fail: (error: { code: number }) => void) =>
            fail({ code: 1 }),
        },
      })
    })
    await stubApi(page)
    await signIn(page)

    await reachReview(page, 'ferretería')
    const toggle = page.getByRole('switch', { name: 'Guardar este sitio' })
    await toggle.click()

    await expect(page.getByRole('alert')).toContainText('Sin permiso de ubicación')
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
  })
})
