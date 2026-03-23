import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { SCHOOLS } from '../constants/schools'

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function schoolName(id) {
  return SCHOOLS.find((s) => s.id === id)?.shortName ?? id
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    pending:  'bg-yellow-100 text-yellow-700',
    active:   'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600',
  }
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  )
}

// ── Boost row ────────────────────────────────────────────────────────────────
function BoostRow({ boost, onActivate, onReject, activating }) {
  const [expanded, setExpanded] = useState(false)
  const listing = boost.listings
  const seller  = boost.profiles

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        {/* Thumbnail */}
        {listing?.images?.[0]
          ? <img src={listing.images[0]} className="w-12 h-12 rounded-lg object-cover shrink-0" alt="" />
          : <div className="w-12 h-12 rounded-lg bg-gray-200 shrink-0 flex items-center justify-center text-gray-400 text-xl"></div>
        }
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{listing?.title ?? '(deleted)'}</p>
          <p className="text-xs text-gray-400">
            {seller?.name ?? '—'} · {schoolName(listing?.school_id)} · {timeAgo(boost.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right mr-1">
            <p className="text-sm font-bold text-gray-900">${boost.total_price}</p>
            <p className="text-xs text-gray-400">{boost.days}d</p>
          </div>
          <StatusBadge status={boost.status} />
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 bg-gray-50 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3 text-sm">
            <div><span className="text-gray-400">Post ID</span><br /><span className="font-mono text-gray-700">{listing?.id?.slice(0, 8).toUpperCase()}</span></div>
            <div><span className="text-gray-400">Seller email</span><br /><span className="text-gray-700">{boost.seller_email ?? '—'}</span></div>
            <div><span className="text-gray-400">Days requested</span><br /><span className="font-semibold">{boost.days}</span></div>
            <div><span className="text-gray-400">Total</span><br /><span className="font-bold text-green-600">${boost.total_price}</span></div>
            {boost.expires_at && <div className="col-span-2"><span className="text-gray-400">Expires</span><br /><span>{new Date(boost.expires_at).toLocaleDateString()}</span></div>}
            {boost.note && <div className="col-span-2"><span className="text-gray-400">Seller note</span><br /><span className="italic text-gray-600">"{boost.note}"</span></div>}
          </div>

          {boost.status === 'pending' && (
            <div className="flex gap-2">
              <button
                disabled={activating}
                onClick={() => onActivate(boost)}
                className="flex-1 bg-green-500 text-white text-sm font-bold py-2 rounded-lg hover:bg-green-600 disabled:opacity-40 transition-colors"
              >
                {activating ? 'Activating…' : 'Activate Boost'}
              </button>
              <button
                disabled={activating}
                onClick={() => onReject(boost)}
                className="flex-1 border border-red-200 text-red-500 text-sm font-bold py-2 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Report row ───────────────────────────────────────────────────────────────
function ReportRow({ report }) {
  const listing = report.listings
  const reporter = report.profiles
  return (
    <div className="border border-gray-100 rounded-xl p-3 flex items-start gap-3">
      {listing?.images?.[0]
        ? <img src={listing.images[0]} className="w-10 h-10 rounded-lg object-cover shrink-0" alt="" />
        : <div className="w-10 h-10 rounded-lg bg-gray-200 shrink-0 flex items-center justify-center text-gray-300 text-base"></div>
      }
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900 truncate">{listing?.title ?? '(deleted)'}</p>
        <p className="text-xs text-gray-500">
          Reported by {reporter?.name ?? '—'} · {schoolName(listing?.school_id)} · {timeAgo(report.created_at)}
        </p>
        <p className="text-xs font-semibold text-red-500 mt-1">{report.reason}</p>
        {report.note && <p className="text-xs text-gray-400 italic mt-0.5">"{report.note}"</p>}
      </div>
      <span className="text-xs font-mono text-gray-300 shrink-0">{listing?.id?.slice(0, 8)}</span>
    </div>
  )
}

// ── Main Admin Dashboard ──────────────────────────────────────────────────────
export default function AdminDashboard({ onBack }) {
  const { profile } = useAuth()

  const [tab, setTab] = useState('boosts') // 'boosts' | 'reports' | 'stats'
  const [boosts, setBoosts]   = useState([])
  const [reports, setReports] = useState([])
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [activatingId, setActivatingId] = useState(null)
  const [boostFilter, setBoostFilter] = useState('pending') // 'pending' | 'active' | 'rejected' | 'all'

  // Guard
  if (!profile?.is_admin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">
        <p className="text-5xl mb-3"></p>
        <p className="font-semibold">Admin access only</p>
        <button onClick={onBack} className="mt-4 text-school-primary font-semibold">Go back</button>
      </div>
    )
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [boostRes, reportRes, listingCount, userCount] = await Promise.all([
      supabase
        .from('boosts')
        .select('*, listings(id, title, images, school_id), profiles(id, name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('reports')
        .select('*, listings(id, title, images, school_id), profiles(id, name)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('listings').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ])
    setBoosts(boostRes.data ?? [])
    setReports(reportRes.data ?? [])
    setStats({
      listings: listingCount.count ?? 0,
      users:    userCount.count ?? 0,
      schools:  SCHOOLS.filter((s) => s.live).length,
      revenue:  (boostRes.data ?? [])
        .filter((b) => b.status === 'active')
        .reduce((sum, b) => sum + Number(b.total_price), 0),
    })
    setLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { fetchAll() }, [fetchAll])

  const activateBoost = async (boost) => {
    setActivatingId(boost.id)
    const activatedAt = new Date()
    const expiresAt   = new Date(activatedAt.getTime() + boost.days * 86400000)

    // Update boost record
    await supabase.from('boosts').update({
      status:       'active',
      activated_at: activatedAt.toISOString(),
      expires_at:   expiresAt.toISOString(),
    }).eq('id', boost.id)

    // Update the listing
    await supabase.from('listings').update({
      boosted:          true,
      boost_expires_at: expiresAt.toISOString(),
    }).eq('id', boost.listing_id)

    setActivatingId(null)
    fetchAll()
  }

  const rejectBoost = async (boost) => {
    await supabase.from('boosts').update({ status: 'rejected' }).eq('id', boost.id)
    fetchAll()
  }

  const pendingCount  = boosts.filter((b) => b.status === 'pending').length
  const filteredBoosts = boostFilter === 'all' ? boosts : boosts.filter((b) => b.status === boostFilter)

  return (
    <div className="max-w-3xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-school-primary font-medium hover:opacity-75">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Admin Dashboard
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-400">All schools · Internal only</p>
        </div>
        <button
          onClick={fetchAll}
          className="text-xs text-school-primary border border-school-primary/30 px-3 py-1.5 rounded-lg hover:bg-school-primary/5"
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
        {[
          { id: 'boosts',  label: `Boosts${pendingCount ? ` (${pendingCount})` : ''}` },
          { id: 'reports', label: `Reports (${reports.length})` },
          { id: 'stats',   label: 'Stats' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
              tab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-400',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Boosts tab ────────────────────────────────────────────────────── */}
      {!loading && tab === 'boosts' && (
        <>
          {/* Status filter */}
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {['pending', 'active', 'rejected', 'all'].map((f) => (
              <button
                key={f}
                onClick={() => setBoostFilter(f)}
                className={[
                  'text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors',
                  boostFilter === f
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300',
                ].join(' ')}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'pending' && pendingCount > 0 && ` · ${pendingCount}`}
              </button>
            ))}
          </div>

          {filteredBoosts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3"></p>
              <p className="font-semibold">No {boostFilter === 'all' ? '' : boostFilter} boost requests</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBoosts.map((b) => (
                <BoostRow
                  key={b.id}
                  boost={b}
                  onActivate={activateBoost}
                  onReject={rejectBoost}
                  activating={activatingId === b.id}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Reports tab ───────────────────────────────────────────────────── */}
      {!loading && tab === 'reports' && (
        <>
          {reports.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3"></p>
              <p className="font-semibold">No reports yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => <ReportRow key={r.id} report={r} />)}
            </div>
          )}
        </>
      )}

      {/* ── Stats tab ─────────────────────────────────────────────────────── */}
      {!loading && tab === 'stats' && stats && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Listings',  value: stats.listings,                  icon: '' },
            { label: 'Total Users',     value: stats.users,                     icon: '' },
            { label: 'Live Schools',    value: stats.schools,                   icon: '' },
            { label: 'Boost Revenue',   value: `$${stats.revenue.toFixed(2)}`,  icon: '' },
            { label: 'Total Boosts',    value: boosts.length,                   icon: '' },
            { label: 'Active Boosts',   value: boosts.filter((b) => b.status === 'active').length,  icon: '' },
            { label: 'Total Reports',   value: reports.length,                  icon: '' },
            { label: 'Pending Boosts',  value: pendingCount,                    icon: '' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-2xl mb-1">{icon}</p>
              <p className="text-2xl font-extrabold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
