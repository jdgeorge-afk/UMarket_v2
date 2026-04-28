import { useSchool } from '../context/SchoolContext'

// ── Nav item ──────────────────────────────────────────────────────────────────
function NavItem({ icon, label, value, activeFilter, onFilter, indent = false }) {
  const active = activeFilter === value
  return (
    <button
      onClick={() => onFilter(value)}
      className={[
        'flex items-center gap-2.5 py-2 rounded-lg text-sm w-full text-left transition-colors',
        indent ? 'pl-8 pr-3' : 'px-3',
        active
          ? 'bg-school-primary/10 text-school-primary font-semibold'
          : 'text-gray-600 hover:bg-gray-100',
      ].join(' ')}
    >
      <span className="text-base w-5 text-center shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {active && <span className="w-2 h-2 rounded-full bg-school-primary shrink-0" />}
    </button>
  )
}

// ── Section header label ──────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-3 mt-4 mb-0.5">
      {children}
    </p>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export default function Sidebar({ activeFilter, onFilter, onPostOpen, onBoostOpen }) {
  const { school } = useSchool()

  return (
    <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-3 px-2 flex flex-col gap-0.5">

      {/* ── All ────────────────────────────────────────────────────────────── */}
      <NavItem icon="" label="Home"           value="all"          activeFilter={activeFilter} onFilter={onFilter} />

      {/* ── Housing section ───────────────────────────────────────────────── */}
      <SectionLabel>Housing</SectionLabel>
      <NavItem icon="" label="All Housing"          value="housing"             activeFilter={activeFilter} onFilter={onFilter} />
      <NavItem icon="" label="Sublease by Tenant"   value="housing:sublease"    activeFilter={activeFilter} onFilter={onFilter} indent />
      <NavItem icon="" label="Looking for Roommates" value="housing:roommates"   activeFilter={activeFilter} onFilter={onFilter} indent />
      <NavItem icon="" label="Looking for Housing"   value="housing:looking_for" activeFilter={activeFilter} onFilter={onFilter} indent />

      {/* ── Looking For ───────────────────────────────────────────────────── */}
      <SectionLabel>Looking For</SectionLabel>
      <NavItem icon="" label="Looking For"     value="looking_for"  activeFilter={activeFilter} onFilter={onFilter} />

      {/* ── Marketplace section ───────────────────────────────────────────── */}
      <SectionLabel>Marketplace</SectionLabel>
      <NavItem icon="" label="All Marketplace" value="marketplace"            activeFilter={activeFilter} onFilter={onFilter} />
      <NavItem icon="" label="Textbooks"       value="marketplace:textbooks"   activeFilter={activeFilter} onFilter={onFilter} indent />
      <NavItem icon="" label="Furniture"       value="marketplace:furniture"   activeFilter={activeFilter} onFilter={onFilter} indent />
      <NavItem icon="" label="Electronics"     value="marketplace:electronics" activeFilter={activeFilter} onFilter={onFilter} indent />
      <NavItem icon="" label="Clothing"        value="marketplace:clothing"    activeFilter={activeFilter} onFilter={onFilter} indent />
      <NavItem icon="" label="Sports"          value="marketplace:sports"      activeFilter={activeFilter} onFilter={onFilter} indent />
      <NavItem icon="" label="Events"          value="marketplace:events"      activeFilter={activeFilter} onFilter={onFilter} indent />
      <NavItem icon="" label="Miscellaneous"   value="marketplace:misc"        activeFilter={activeFilter} onFilter={onFilter} indent />

      {/* ── Boost upsell ──────────────────────────────────────────────────── */}
      <div
        className="mt-auto rounded-2xl p-4 text-white"
        style={{ background: school?.gradient ?? 'var(--school-gradient)' }}
      >
        <p className="text-sm font-bold flex items-center gap-1">Boost for $3/day</p>
        <p className="text-xs text-white/75 mt-0.5 mb-3">10x more views instantly.</p>
        <button
          onClick={onBoostOpen ?? onPostOpen}
          className="w-full bg-white text-school-primary font-bold text-xs py-2 rounded-lg hover:bg-white/90 transition-colors"
        >
          Post &amp; Boost →
        </button>
      </div>
    </div>
  )
}
