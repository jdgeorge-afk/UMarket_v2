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
function ReportRow({ report, onRemove, onDismiss, working }) {
  const [expanded, setExpanded] = useState(false)
  const listing  = report.listings
  const reporter = report.profiles
  const isDeleted = !listing

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        {listing?.images?.[0]
          ? <img src={listing.images[0]} className="w-10 h-10 rounded-lg object-cover shrink-0" alt="" />
          : <div className="w-10 h-10 rounded-lg bg-gray-200 shrink-0 flex items-center justify-center text-gray-300 text-base">🗑️</div>
        }
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">{listing?.title ?? '(listing deleted)'}</p>
          <p className="text-xs text-gray-500 truncate">
            {reporter?.name ?? '—'} · {schoolName(listing?.school_id)} · {timeAgo(report.created_at)}
          </p>
        </div>
        <span className="text-xs font-semibold text-red-500 shrink-0 max-w-[100px] truncate">{report.reason}</span>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <div><span className="text-xs text-gray-400">Reporter</span><br /><span>{reporter?.name ?? '—'}</span></div>
            <div><span className="text-xs text-gray-400">School</span><br /><span>{schoolName(listing?.school_id)}</span></div>
            <div><span className="text-xs text-gray-400">Reason</span><br /><span className="font-semibold text-red-500">{report.reason}</span></div>
            <div><span className="text-xs text-gray-400">Listing ID</span><br /><span className="font-mono text-gray-500">{listing?.id?.slice(0, 8) ?? '—'}</span></div>
          </div>
          {report.note && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Reporter note</p>
              <p className="text-sm italic text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-200">"{report.note}"</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {!isDeleted && (
              <button
                disabled={working}
                onClick={() => onRemove(report)}
                className="flex-1 bg-red-500 text-white text-sm font-bold py-2 rounded-lg hover:bg-red-600 disabled:opacity-40 transition-colors"
              >
                {working ? 'Removing…' : 'Remove Listing'}
              </button>
            )}
            <button
              disabled={working}
              onClick={() => onDismiss(report)}
              className={[
                'text-sm font-bold py-2 rounded-lg disabled:opacity-40 transition-colors border',
                isDeleted ? 'flex-1 border-gray-300 text-gray-600 hover:bg-gray-100' : 'px-4 border-gray-300 text-gray-600 hover:bg-gray-100',
              ].join(' ')}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Ad Application row ───────────────────────────────────────────────────────
function AdAppRow({ app, onApprove, onReject, onContact, working }) {
  const [expanded, setExpanded] = useState(false)
  const statusColors = {
    pending:  'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600',
  }

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-500 text-lg font-bold shrink-0">
          {app.company_name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{app.company_name}</p>
          <p className="text-xs text-gray-400 truncate">{app.contact_name} · {app.industry} · {timeAgo(app.created_at)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400 hidden sm:block">{app.ad_type?.split(' ')[0]}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[app.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {app.status}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><span className="text-gray-400 text-xs">Contact</span><br /><span className="font-medium">{app.contact_name}</span></div>
            <div><span className="text-gray-400 text-xs">Email</span><br /><a href={`mailto:${app.email}`} className="text-school-primary font-medium break-all">{app.email}</a></div>
            {app.phone && <div><span className="text-gray-400 text-xs">Phone</span><br /><span>{app.phone}</span></div>}
            {app.website && <div><span className="text-gray-400 text-xs">Website</span><br /><a href={app.website} target="_blank" rel="noopener noreferrer" className="text-school-primary break-all">{app.website}</a></div>}
            <div><span className="text-gray-400 text-xs">Industry</span><br /><span>{app.industry}</span></div>
            <div><span className="text-gray-400 text-xs">Ad Type</span><br /><span>{app.ad_type}</span></div>
            {app.budget_range && <div><span className="text-gray-400 text-xs">Budget</span><br /><span className="font-semibold text-green-700">{app.budget_range}</span></div>}
            {app.target_schools && <div><span className="text-gray-400 text-xs">Target Schools</span><br /><span>{app.target_schools}</span></div>}
          </div>
          {app.description && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">What they want to promote</p>
              <p className="text-sm text-gray-700 bg-white rounded-lg px-3 py-2 border border-gray-200">{app.description}</p>
            </div>
          )}
          {app.creative_url && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Creative asset</p>
              <a href={app.creative_url} target="_blank" rel="noopener noreferrer"
                className="text-sm text-school-primary underline break-all">{app.creative_url}</a>
            </div>
          )}
          {app.notes && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Notes</p>
              <p className="text-sm italic text-gray-500">"{app.notes}"</p>
            </div>
          )}

          {app.status === 'pending' && (
            <div className="flex gap-2 pt-1">
              <button disabled={working} onClick={() => onApprove(app)}
                className="flex-1 bg-green-500 text-white text-sm font-bold py-2 rounded-lg hover:bg-green-600 disabled:opacity-40 transition-colors">
                {working ? 'Saving…' : 'Approve'}
              </button>
              <button disabled={working} onClick={() => onContact(app)}
                className="flex-1 bg-school-primary text-white text-sm font-bold py-2 rounded-lg hover:opacity-90 disabled:opacity-40 transition-colors">
                Email Them
              </button>
              <button disabled={working} onClick={() => onReject(app)}
                className="px-4 border border-red-200 text-red-500 text-sm font-bold py-2 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors">
                Reject
              </button>
            </div>
          )}
          {app.status !== 'pending' && (
            <div className="flex gap-2 pt-1">
              <button onClick={() => onContact(app)}
                className="flex-1 bg-school-primary text-white text-sm font-bold py-2 rounded-lg hover:opacity-90 transition-colors">
                Email Them
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Admin Dashboard ──────────────────────────────────────────────────────
export default function AdminDashboard({ onBack }) {
  const { profile } = useAuth()

  const [tab, setTab] = useState('ads') // 'ads' | 'boosts' | 'reports' | 'stats'
  const [boosts, setBoosts]   = useState([])
  const [reports, setReports] = useState([])
  const [adApps, setAdApps]   = useState([])
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [activatingId, setActivatingId]     = useState(null)
  const [adWorkingId, setAdWorkingId]       = useState(null)
  const [reportWorkingId, setReportWorkingId] = useState(null)
  const [boostFilter, setBoostFilter] = useState('pending') // 'pending' | 'active' | 'rejected' | 'all'
  const [adFilter, setAdFilter]       = useState('pending') // 'pending' | 'approved' | 'rejected' | 'all'

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
    const [boostRes, reportRes, adRes, listingCount, userCount] = await Promise.all([
      supabase
        .from('boosts')
        .select('*, listings(id, title, images, school_id), profiles(id, name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('reports')
        .select('*, listings(id, title, images, school_id), profiles(id, name)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('ad_applications')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('listings').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ])
    setBoosts(boostRes.data ?? [])
    setReports(reportRes.data ?? [])
    setAdApps(adRes.data ?? [])
    setStats({
      listings:    listingCount.count ?? 0,
      users:       userCount.count ?? 0,
      schools:     SCHOOLS.filter((s) => s.live).length,
      revenue:     (boostRes.data ?? [])
        .filter((b) => b.status === 'active')
        .reduce((sum, b) => sum + Number(b.total_price), 0),
      adPending:   (adRes.data ?? []).filter((a) => a.status === 'pending').length,
      adApproved:  (adRes.data ?? []).filter((a) => a.status === 'approved').length,
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

  const approveAd = async (app) => {
    setAdWorkingId(app.id)
    await supabase.from('ad_applications').update({ status: 'approved' }).eq('id', app.id)
    setAdWorkingId(null)
    fetchAll()
  }

  const rejectAd = async (app) => {
    setAdWorkingId(app.id)
    await supabase.from('ad_applications').update({ status: 'rejected' }).eq('id', app.id)
    setAdWorkingId(null)
    fetchAll()
  }

  const contactAd = (app) => {
    const subject = encodeURIComponent(`UMarket Advertising — ${app.company_name}`)
    const body = encodeURIComponent(`Hi ${app.contact_name},\n\nThanks for your interest in advertising on UMarket!\n\n`)
    window.open(`mailto:${app.email}?subject=${subject}&body=${body}`)
  }

  const removeListingFromReport = async (report) => {
    setReportWorkingId(report.id)
    if (report.listings?.id) {
      await supabase.from('listings').delete().eq('id', report.listings.id)
    }
    await supabase.from('reports').delete().eq('id', report.id)
    setReportWorkingId(null)
    fetchAll()
  }

  const dismissReport = async (report) => {
    setReportWorkingId(report.id)
    await supabase.from('reports').delete().eq('id', report.id)
    setReportWorkingId(null)
    fetchAll()
  }

  const pendingCount   = boosts.filter((b) => b.status === 'pending').length
  const adPendingCount = adApps.filter((a) => a.status === 'pending').length
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
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5 gap-0.5">
        {[
          { id: 'ads',     label: `Ads${adPendingCount ? ` (${adPendingCount})` : ''}` },
          { id: 'boosts',  label: `Boosts${pendingCount ? ` (${pendingCount})` : ''}` },
          { id: 'reports', label: `Reports${reports.length ? ` (${reports.length})` : ''}` },
          { id: 'stats',   label: 'Stats' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'flex-1 py-2 rounded-lg text-xs font-semibold transition-all',
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

      {/* ── Ad Applications tab ───────────────────────────────────────────── */}
      {!loading && tab === 'ads' && (
        <>
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {['pending', 'approved', 'rejected', 'all'].map((f) => (
              <button
                key={f}
                onClick={() => setAdFilter(f)}
                className={[
                  'text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors',
                  adFilter === f
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300',
                ].join(' ')}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'pending' && adPendingCount > 0 && ` · ${adPendingCount}`}
              </button>
            ))}
          </div>

          {(adFilter === 'all' ? adApps : adApps.filter((a) => a.status === adFilter)).length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-semibold">No {adFilter === 'all' ? '' : adFilter} ad applications</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(adFilter === 'all' ? adApps : adApps.filter((a) => a.status === adFilter)).map((a) => (
                <AdAppRow
                  key={a.id}
                  app={a}
                  onApprove={approveAd}
                  onReject={rejectAd}
                  onContact={contactAd}
                  working={adWorkingId === a.id}
                />
              ))}
            </div>
          )}
        </>
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
              {reports.map((r) => (
                <ReportRow
                  key={r.id}
                  report={r}
                  onRemove={removeListingFromReport}
                  onDismiss={dismissReport}
                  working={reportWorkingId === r.id}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Stats tab ─────────────────────────────────────────────────────── */}
      {!loading && tab === 'stats' && stats && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Listings',     value: stats.listings,                                     icon: '🏷️' },
            { label: 'Total Users',        value: stats.users,                                        icon: '👤' },
            { label: 'Live Schools',       value: stats.schools,                                      icon: '🎓' },
            { label: 'Boost Revenue',      value: `$${stats.revenue.toFixed(2)}`,                     icon: '💰' },
            { label: 'Ad Applications',    value: adApps.length,                                      icon: '📋' },
            { label: 'Pending Ad Apps',    value: stats.adPending,                                    icon: '⏳' },
            { label: 'Approved Ad Apps',   value: stats.adApproved,                                   icon: '✅' },
            { label: 'Active Boosts',      value: boosts.filter((b) => b.status === 'active').length, icon: '🚀' },
            { label: 'Pending Boosts',     value: pendingCount,                                       icon: '⏳' },
            { label: 'Total Reports',      value: reports.length,                                     icon: '🚩' },
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
