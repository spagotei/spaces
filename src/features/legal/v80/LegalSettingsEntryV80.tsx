// Personal, platform-wide policies. Never scope these to a particular Space.
const legalLinksV923 = [
  { slug:'terms', title:'Terms of Service', detail:'Using Spaces, your account and our services.' },
  { slug:'privacy', title:'Privacy', detail:'How Spaces handles account and platform data.' },
  { slug:'community-guidelines', title:'Community Guidelines', detail:'Rules for safe and welcoming communities.' },
  { slug:'safety-and-enforcement', title:'Trust & Safety', detail:'Reports, moderation and enforcement.' },
  { slug:'partner-program', title:'Partner Program', detail:'Program benefits, applications and requirements.' },
  { slug:'beta-program', title:'Beta Terms', detail:'Terms of the invite-only testing program.' },
  { slug:'cookie-policy', title:'Cookies', detail:'Cookies and related storage technologies.' },
  { slug:'copyright-and-ip', title:'Copyright', detail:'Intellectual property and takedown requests.' },
  { slug:'contact', title:'Legal Contact', detail:'Questions and legal requests.' },
] as const

export function LegalSettingsEntryV80() {
  const openLegal = (slug: string) => window.dispatchEvent(new CustomEvent('spaces:open-legal', { detail: { slug } }))
  return <section className="v923-legal" data-spaces-v80-legal-settings aria-label="Legal & Policies">
    <header className="v923-legal-header"><span className="v923-legal-mark" aria-hidden="true">§</span><div><strong>Spaces Legal Center</strong><p>Platform-wide policies, terms, privacy and program information. Select any item to read it here.</p></div></header>
    <div className="v923-legal-grid">
      {legalLinksV923.map(({ slug,title,detail }) => <button type="button" key={slug} className="v923-legal-card" onClick={() => openLegal(slug)}>
        <strong>{title}</strong><span>{detail}</span><span className="v923-legal-open" aria-hidden="true">↗</span>
      </button>)}
    </div>
    <p className="v923-legal-footer">For the canonical published pages, visit <a href="https://yourspaces.net/tos/" target="_blank" rel="noopener noreferrer">yourspaces.net/tos/ ↗</a>.</p>
  </section>
}
