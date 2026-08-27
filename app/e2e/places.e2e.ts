import { expect, test, type Page } from '@playwright/test'
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
    await page.getByRole('button', { name: 'Añadir' }).click()
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
    // The line that has to be on this screen: it says where the coordinates live.
    await expect(page.getByText('solo en este dispositivo')).toBeVisible()

    page.once('dialog', dialog => void dialog.accept())
    await row.getByRole('button', { name: 'Borrar' }).click()
    await expect(page.getByText('Todavía no has guardado ningún sitio')).toBeVisible()
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
