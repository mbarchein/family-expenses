import { LEGAL_BACK, type LegalDocument } from '../i18n/legal'

/**
 * A legal page, rendered from the copy in `i18n/legal.ts`.
 *
 * Deliberately outside everything else. It hangs off `main.tsx` rather than off
 * `App`, so it renders before the ledger is fetched and before the sign-in gate:
 * the reader Google sends to check these pages has no account here, and a
 * privacy policy behind a login is not a published privacy policy.
 *
 * It is also the only screen in the app meant to be read on a desktop, which is
 * why it is the only one that is a column of prose with a maximum width rather
 * than something sized to a thumb.
 */
export function LegalScreen({ doc }: { doc: LegalDocument }) {
  return (
    <main className="mx-auto h-full max-w-2xl overflow-y-auto p-6 pb-16">
      <a href="/" className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
        {LEGAL_BACK}
      </a>

      <h1 className="mt-6 text-2xl font-bold">{doc.title}</h1>
      <p className="mt-1 text-xs text-ink-2">{doc.updated}</p>
      <p className="mt-4 text-sm text-ink-2">{doc.intro}</p>

      {doc.sections.map(section => (
        <section key={section.title} className="mt-6">
          <h2 className="text-base font-semibold">{section.title}</h2>
          {/* The bodies carry their own line breaks and bullets, so they are
              printed as written rather than re-flowed into one paragraph. */}
          <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{section.body}</p>
        </section>
      ))}
    </main>
  )
}
