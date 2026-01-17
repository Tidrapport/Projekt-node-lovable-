import React from 'react'
import { downloadWeldingReportPdf, openWeldingReportPdf } from './lib/weldingReportPdf'
import { WeldingReport } from './types/weldingReport'

const TOKEN_KEY = 'opero_token'
const LEGACY_TOKEN_KEY = 'access_token'

const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY)
  } catch {
    return null
  }
}

const setToken = (token: string) => {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(LEGACY_TOKEN_KEY, token)
  } catch {
    return
  }
}

const consumeTokenFromUrl = () => {
  try {
    const url = new URL(window.location.href)
    const token = url.searchParams.get('token') || url.searchParams.get('access_token')
    if (!token) return
    setToken(token)
    url.searchParams.delete('token')
    url.searchParams.delete('access_token')
    window.history.replaceState({}, '', url.toString())
  } catch {
    return
  }
}

const buildMainAppUrl = () => {
  const raw = import.meta.env.VITE_MAIN_APP_URL?.trim() || 'http://localhost:5174'
  if (!raw) return null
  try {
    return new URL(raw, window.location.origin)
  } catch {
    return null
  }
}

const normalizeStandard = (value?: string | null) => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === '9001' || raw === 'iso9001' || raw === 'iso-9001') return '9001'
  if (raw === '3834-2' || raw === '3834' || raw === 'iso3834-2' || raw === 'iso-3834-2') return '3834-2'
  return '3834-2'
}

const getStandardFromUrl = () => {
  try {
    const url = new URL(window.location.href)
    return normalizeStandard(url.searchParams.get('standard'))
  } catch {
    return '3834-2'
  }
}

const STANDARD_CONFIG = {
  '3834-2': {
    label: 'ISO 3834-2',
    full: 'ISO 3834-2:2021',
    overview: 'Översikt av kvalitetssystemet enligt ISO 3834-2',
    infoTitle: 'ISO 3834-2 Information',
    standardDescription:
      'ISO 3834-2:2021 - Kvalitetskrav för smältsvetsning av metalliska material, Del 2: Fullständiga kvalitetskrav',
    infoIntro: 'Information enligt ISO 3834-2',
    aboutTitle: 'Om ISO 3834-2',
    aboutSubtitle: 'Information om standarden',
    aboutIntro:
      'ISO 3834-2:2021 specificerar fullständiga kvalitetskrav för smältsvetsning av metalliska material. Standarden täcker kvalitetskrav för svetsprocesser i verkstäder och/eller på byggplatser.',
    requirements: [
      'Granskning av krav och teknisk granskning',
      'Underleveransarbete',
      'Svetspersonal (svetsare och svetsoperatörer)',
      'Personal för kvalitetskontroll och provning',
      'Utrustning',
      'Svetsproduktion och relaterade aktiviteter',
      'Svetsmaterial och hjälpmaterial',
      'Förvaring av grundmaterial',
      'Värmebehandling efter svetsning',
      'Kontroll och provning',
      'Avvikelser och korrigerande åtgärder',
      'Mätning, kontroll och testutrustning',
      'Identifiering och spårbarhet',
      'Kvalitetsregister',
    ],
  },
  '9001': {
    label: 'ISO 9001',
    full: 'ISO 9001:2015',
    overview: 'Översikt av kvalitetssystemet enligt ISO 9001',
    infoTitle: 'ISO 9001 Information',
    standardDescription: 'ISO 9001:2015 - Kvalitetsledningssystem - Krav',
    infoIntro: 'Information enligt ISO 9001',
    aboutTitle: 'Om ISO 9001',
    aboutSubtitle: 'Information om standarden',
    aboutIntro:
      'ISO 9001:2015 specificerar krav för ett kvalitetsledningssystem med fokus på kundnöjdhet, riskbaserat tänkande och ständiga förbättringar.',
    requirements: [
      'Organisationens kontext',
      'Ledarskap',
      'Planering',
      'Stöd',
      'Verksamhet',
      'Utvärdering av prestanda',
      'Förbättring',
    ],
  },
} as const

type AuthResponse = {
  user?: {
    full_name?: string
    email?: string
    role?: string
    company_id?: string | number | null
  }
  role?: string
  is_super_admin?: boolean
  is_admin?: boolean
  company_id?: string | number | null
  home_company_id?: string | number | null
}

const IconBase = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
)

const icons = {
  shield: (
    <IconBase>
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
    </IconBase>
  ),
  dashboard: (
    <IconBase>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </IconBase>
  ),
  document: (
    <IconBase>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6M9 17h6M9 9h2" />
    </IconBase>
  ),
  book: (
    <IconBase>
      <path d="M4 5a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2z" />
      <path d="M6 3v17" />
      <path d="M10 7h6M10 11h6" />
    </IconBase>
  ),
  flame: (
    <IconBase>
      <path d="M12 3c2.5 3 4.5 5.4 4.5 8.2A4.5 4.5 0 0 1 12 16a4.5 4.5 0 0 1-4.5-4.8C7.5 8 9.4 6 12 3z" />
      <path d="M10 17a2.5 2.5 0 0 0 4 2c1.4-1.4.9-3.5-1-5-1 1-2.3 2-3 3z" />
    </IconBase>
  ),
  alert: (
    <IconBase>
      <path d="M12 3l9 16H3l9-16z" />
      <path d="M12 9v4" />
      <circle cx="12" cy="17" r="1" />
    </IconBase>
  ),
  clipboard: (
    <IconBase>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 4a3 3 0 0 1 6 0" />
      <path d="M9 10h6M9 14h6" />
    </IconBase>
  ),
  folder: (
    <IconBase>
      <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 10h18" />
    </IconBase>
  ),
  tool: (
    <IconBase>
      <path d="M14 6a4 4 0 0 0-5 5l-5 5 2 2 5-5a4 4 0 0 0 5-5z" />
      <path d="M12 7l5-5" />
    </IconBase>
  ),
  users: (
    <IconBase>
      <path d="M16 11a3 3 0 1 0-6 0" />
      <path d="M5 18a5 5 0 0 1 14 0" />
      <path d="M6 9a3 3 0 0 1 3-3" />
    </IconBase>
  ),
  settings: (
    <IconBase>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1 1 0 0 1-1.4 1.4l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V19a1 1 0 0 1-2 0v-.1a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a1 1 0 0 1-1.4-1.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H5a1 1 0 0 1 0-2h.1a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a1 1 0 0 1 1.4-1.4l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V5a1 1 0 0 1 2 0v.1a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a1 1 0 0 1 1.4 1.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H19a1 1 0 0 1 0 2h-.1a1 1 0 0 0-.9.7z" />
    </IconBase>
  ),
  plus: (
    <IconBase>
      <path d="M12 5v14M5 12h14" />
    </IconBase>
  ),
  upload: (
    <IconBase>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 20h16" />
    </IconBase>
  ),
  building: (
    <IconBase>
      <path d="M4 21V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v18" />
      <path d="M8 6h2M8 10h2M8 14h2M12 6h2M12 10h2M12 14h2" />
      <path d="M18 10h2v11h-2z" />
    </IconBase>
  ),
  chevron: (
    <IconBase>
      <path d="M7 10l5 5 5-5" />
    </IconBase>
  ),
  close: (
    <IconBase>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </IconBase>
  ),
  arrowLeft: (
    <IconBase>
      <path d="M15 18l-6-6 6-6" />
    </IconBase>
  ),
  edit: (
    <IconBase>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
    </IconBase>
  ),
  trash: (
    <IconBase>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
    </IconBase>
  ),
  list: (
    <IconBase>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </IconBase>
  ),
  eye: (
    <IconBase>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </IconBase>
  ),
  download: (
    <IconBase>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </IconBase>
  ),
  refresh: (
    <IconBase>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </IconBase>
  ),
  clock: (
    <IconBase>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </IconBase>
  ),
  check: (
    <IconBase>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-5" />
    </IconBase>
  ),
}

const navMain = [
  { id: 'dashboard', label: 'Dashboard', icon: icons.dashboard },
  { id: 'documents', label: 'Dokument', icon: icons.document },
  { id: 'tdok', label: 'TDOK', icon: icons.book },
  { id: 'welding', label: 'Svetsrapporter', icon: icons.flame },
  { id: 'deviations', label: 'Avvikelser', icon: icons.alert },
  { id: 'inspections', label: 'Inspektioner', icon: icons.clipboard },
  { id: 'projects', label: 'Projekt', icon: icons.folder },
  { id: 'calibration', label: 'Kalibrering', icon: icons.tool },
]

const navAdmin = [
  { id: 'users', label: 'Användare', icon: icons.users },
  { id: 'settings', label: 'Inställningar', icon: icons.settings },
]

const navSuper = [{ id: 'superadmin', label: 'Super Admin', icon: icons.shield }]

const PageHeader = ({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) => (
  <div className="page-header">
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
    {actions ? <div className="page-actions">{actions}</div> : null}
  </div>
)

const StatCard = ({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: string
  icon: React.ReactNode
  tone?: 'warning' | 'success' | 'muted'
}) => (
  <div className={`stat-card ${tone ? `tone-${tone}` : ''}`}>
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
    <div className="stat-icon">{icon}</div>
  </div>
)

const EmptyState = ({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) => (
  <div className="empty-state">
    <div className="empty-icon">{icon}</div>
    <strong>{title}</strong>
    <span>{description}</span>
  </div>
)

const Modal = ({
  open,
  title,
  onClose,
  children,
  actions,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  actions?: React.ReactNode
}) => {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Stäng">
            {icons.close}
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>
  )
}

const Field = ({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) => (
  <label className="form-field">
    <span className="form-label">
      {label}
      {required ? <span className="required">*</span> : null}
    </span>
    {children}
  </label>
)

export default function App() {
  const [activePage, setActivePage] = React.useState('dashboard')
  const [superTab, setSuperTab] = React.useState<'companies' | 'users'>('companies')
  const [auth, setAuth] = React.useState<AuthResponse | null>(null)
  const [standard] = React.useState(() => getStandardFromUrl())
  const standardConfig =
    STANDARD_CONFIG[standard as keyof typeof STANDARD_CONFIG] || STANDARD_CONFIG['3834-2']
  const [companyName, setCompanyName] = React.useState('Företag')
  const [companyShort, setCompanyShort] = React.useState('Företag')
  const [activeModal, setActiveModal] = React.useState<
    null | 'document' | 'deviation' | 'inspection' | 'tool' | 'user'
  >(null)
  const [weldingReports, setWeldingReports] = React.useState<WeldingReport[]>([])
  const [weldingLoading, setWeldingLoading] = React.useState(false)
  const [weldingError, setWeldingError] = React.useState<string | null>(null)
  const [weldingSearch, setWeldingSearch] = React.useState('')
  const [attestingReportId, setAttestingReportId] = React.useState<string | null>(null)

  React.useEffect(() => {
    consumeTokenFromUrl()
    const base =
      import.meta.env.VITE_API_BASE ||
      import.meta.env.VITE_API_BASE_URL ||
      'http://localhost:3000'
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    fetch(base + '/auth/me', { credentials: 'include', headers })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((json) => setAuth(json))
      .catch(() => setAuth(null))
  }, [])

  const isSuperAdmin =
    auth?.is_super_admin ||
    auth?.role === 'super_admin' ||
    auth?.user?.role === 'super_admin'
  const isAdmin =
    isSuperAdmin ||
    auth?.is_admin ||
    auth?.role === 'admin' ||
    auth?.user?.role === 'admin'
  const displayName = auth?.user?.full_name || 'Edgar Zubkov'
  const roleLabel = isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Användare'
  const companyId = auth?.company_id ?? auth?.user?.company_id ?? auth?.home_company_id ?? null
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('') || 'Q'

  React.useEffect(() => {
    const base =
      import.meta.env.VITE_API_BASE ||
      import.meta.env.VITE_API_BASE_URL ||
      'http://localhost:3000'
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`

    if (!companyId) {
      setCompanyName('Företag')
      setCompanyShort('Företag')
      return
    }

    fetch(base + `/companies/${companyId}`, { credentials: 'include', headers })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((json) => {
        const name = String(json?.name || '').trim()
        if (!name) return
        setCompanyName(name)
        setCompanyShort(name.length > 18 ? `${name.slice(0, 18).trim()}...` : name)
      })
      .catch(() => {
        setCompanyName('Företag')
        setCompanyShort('Företag')
      })
  }, [companyId])

  const isWeldingStandard = standard === '3834-2'

  const fetchWeldingReports = React.useCallback(() => {
    if (!companyId || !isWeldingStandard) {
      setWeldingReports([])
      setWeldingError(null)
      return Promise.resolve()
    }
    setWeldingLoading(true)
    setWeldingError(null)

    const base =
      import.meta.env.VITE_API_BASE ||
      import.meta.env.VITE_API_BASE_URL ||
      'http://localhost:3000'
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`

    return fetch(base + '/welding_reports?include=profiles', { credentials: 'include', headers })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((json) => {
        const data = Array.isArray(json) ? json : []
        setWeldingReports(data)
      })
      .catch(() => {
        setWeldingError('Kunde inte hämta svetsrapporter.')
      })
      .finally(() => setWeldingLoading(false))
  }, [companyId, isWeldingStandard])

  React.useEffect(() => {
    fetchWeldingReports()
  }, [fetchWeldingReports])

  const companySwitch = (
    <div className="company-switch">
      <span className="icon">{icons.building}</span>
      <span>{companyName}</span>
    </div>
  )

  const handleBackToMain = React.useCallback(() => {
    const targetUrl = buildMainAppUrl()
    if (!targetUrl) return
    const token = getToken()
    const shouldPassToken = targetUrl.origin !== window.location.origin
    if (token && shouldPassToken && !targetUrl.searchParams.has('token')) {
      targetUrl.searchParams.set('token', token)
    }
    window.location.assign(targetUrl.toString())
  }, [])

  const backButton = buildMainAppUrl() ? (
    <button className="btn ghost" type="button" onClick={handleBackToMain}>
      <span className="icon">{icons.arrowLeft}</span>
      Till tidrapportering
    </button>
  ) : null

  const headerActions = (extra?: React.ReactNode) => (
    <>
      {extra}
      {companySwitch}
    </>
  )

  const formatReportDate = (report: WeldingReport) => {
    const raw = report.report_date || report.created_at
    if (!raw) return '-'
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) return raw
    return parsed.toLocaleDateString('sv-SE')
  }

  const handleViewWeldingPdf = React.useCallback(
    async (report: WeldingReport) => {
      try {
        await openWeldingReportPdf(report, companyName)
      } catch (error) {
        console.error(error)
        setWeldingError('Kunde inte skapa PDF.')
      }
    },
    [companyName]
  )

  const handleDownloadWeldingPdf = React.useCallback(
    async (report: WeldingReport) => {
      try {
        await downloadWeldingReportPdf(report, companyName)
      } catch (error) {
        console.error(error)
        setWeldingError('Kunde inte skapa PDF.')
      }
    },
    [companyName]
  )

  const handleAttestReport = React.useCallback(
    async (report: WeldingReport) => {
      if (attestingReportId) return
      setAttestingReportId(report.id)
      setWeldingError(null)

      const base =
        import.meta.env.VITE_API_BASE ||
        import.meta.env.VITE_API_BASE_URL ||
        'http://localhost:3000'
      const token = getToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      try {
        const res = await fetch(base + `/welding_reports/${report.id}/attest`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ attested: true }),
        })
        if (!res.ok) throw new Error('Request failed')
        const updated = await res.json()
        setWeldingReports((prev) =>
          prev.map((item) =>
            item.id === report.id
              ? { ...item, ...updated, profiles: updated.profiles ?? item.profiles }
              : item
          )
        )
      } catch (error) {
        console.error(error)
        setWeldingError('Kunde inte attestera svetsrapport.')
      } finally {
        setAttestingReportId(null)
      }
    },
    [attestingReportId]
  )

  const weldingStats = React.useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfToday)
    const weekday = (startOfWeek.getDay() + 6) % 7
    startOfWeek.setDate(startOfWeek.getDate() - weekday)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    let today = 0
    let week = 0
    let month = 0
    let pending = 0
    let approved = 0

    weldingReports.forEach((report) => {
      const raw = report.report_date || report.created_at
      const parsed = raw ? new Date(raw) : null
      if (parsed && !Number.isNaN(parsed.getTime())) {
        if (parsed >= startOfToday) today += 1
        if (parsed >= startOfWeek) week += 1
        if (parsed >= startOfMonth) month += 1
      }

      const isAttested = report.attested || !!report.attested_at
      if (isAttested) {
        approved += 1
      } else {
        pending += 1
      }
    })

    return { today, week, month, pending, approved }
  }, [weldingReports])

  const renderDashboard = () => (
    <div className="page">
      <PageHeader
        title={`Välkommen, ${displayName}`}
        subtitle={standardConfig.overview}
        actions={headerActions()}
      />
      <div className="stat-grid">
        <StatCard label="Dokument" value="0" icon={icons.document} />
        <StatCard label="Öppna avvikelser" value="0" icon={icons.alert} tone="warning" />
        <StatCard label="Planerade inspektioner" value="0" icon={icons.clipboard} />
        <StatCard label="Aktiva projekt" value="0" icon={icons.folder} tone="success" />
      </div>
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <span className="panel-icon warning">{icons.flame}</span>
            <h2>Svetsrapporter</h2>
          </div>
          <span className="panel-subtitle">Status för senaste perioden</span>
        </div>
        <div className="pill-grid">
          <div className="pill">
            <span>Idag</span>
            <strong>{weldingLoading ? '...' : String(weldingStats.today)}</strong>
          </div>
          <div className="pill">
            <span>Denna vecka</span>
            <strong>{weldingLoading ? '...' : String(weldingStats.week)}</strong>
          </div>
          <div className="pill">
            <span>Denna månad</span>
            <strong>{weldingLoading ? '...' : String(weldingStats.month)}</strong>
          </div>
          <div className="pill pill-warning">
            <span>Väntar godkännande</span>
            <strong>{weldingLoading ? '...' : String(weldingStats.pending)}</strong>
          </div>
          <div className="pill pill-success">
            <span>Godkända</span>
            <strong>{weldingLoading ? '...' : String(weldingStats.approved)}</strong>
          </div>
        </div>
      </div>
      <div className="split-grid">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-icon">{icons.list}</span>
              <h2>Snabbåtgärder</h2>
            </div>
          </div>
          <div className="quick-list">
            <button className="quick-item" type="button" onClick={() => setActiveModal('document')}>
              <span className="quick-icon">{icons.document}</span>
              <div>
                <strong>Skapa nytt dokument</strong>
                <span>WPS, WPQR, certifikat</span>
              </div>
            </button>
            <button className="quick-item" type="button" onClick={() => setActiveModal('deviation')}>
              <span className="quick-icon warning">{icons.alert}</span>
              <div>
                <strong>Rapportera avvikelse</strong>
                <span>Registrera ny kvalitetsavvikelse</span>
              </div>
            </button>
            <button className="quick-item" type="button" onClick={() => setActiveModal('inspection')}>
              <span className="quick-icon">{icons.clipboard}</span>
              <div>
                <strong>Planera inspektion</strong>
                <span>Schemalägg ny kvalitetskontroll</span>
              </div>
            </button>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
          <div className="panel-title">
            <span className="panel-icon">{icons.check}</span>
            <h2>{standardConfig.infoTitle}</h2>
          </div>
        </div>
          <div className="info-card">
            <strong>Företagsinformation</strong>
            <div className="info-row">
              <span>Företag:</span>
              <span>{companyName}</span>
            </div>
          </div>
        <div className="info-card">
          <strong>Standard</strong>
          <p>{standardConfig.standardDescription}</p>
        </div>
      </div>
      </div>
    </div>
  )

  const renderDocuments = () => (
    <div className="page">
      <PageHeader
        title="Dokument"
        subtitle="Hantera WPS, WPQR, svetsarcertifikat och andra kvalitetsdokument"
        actions={headerActions(
          <button className="btn primary" type="button" onClick={() => setActiveModal('document')}>
            <span className="icon">{icons.plus}</span>
            Nytt dokument
          </button>
        )}
      />
      <div className="toolbar">
        <div className="field">
          <span className="field-icon">{icons.list}</span>
          <input placeholder="Sök dokument..." />
        </div>
        <select>
          <option>Alla typer</option>
          <option>WPS</option>
          <option>WPQR</option>
          <option>Certifikat</option>
        </select>
      </div>
      <div className="panel">
        <EmptyState
          icon={icons.document}
          title="Inga dokument"
          description="Skapa ditt första dokument för att komma igång"
        />
      </div>
    </div>
  )

  const renderTdok = () => (
    <div className="page">
      <PageHeader
        title="TDOK-dokument"
        subtitle="Trafikverkets styrande dokument för svetsning och järnvägsunderhåll"
        actions={headerActions()}
      />
      <div className="toolbar">
        <div className="field large">
          <span className="field-icon">{icons.list}</span>
          <input placeholder="Sök på TDOK-nummer, titel eller nyckelord..." />
        </div>
        <select>
          <option>Alla kategorier</option>
          <option>Svetsning</option>
          <option>Underhåll</option>
        </select>
      </div>
      <div className="panel">
        <EmptyState
          icon={icons.document}
          title="Inga dokument hittades"
          description="Det finns inga TDOK-dokument i systemet ännu"
        />
      </div>
      <div className="panel subtle">
        <div className="panel-title">
          <span className="panel-icon">{icons.document}</span>
          <h3>Om TDOK-dokument</h3>
        </div>
        <p>
          TDOK (Trafikverkets styrande dokument) innehåller krav, instruktioner och riktlinjer
          för arbete på och underhåll av den svenska järnvägsinfrastrukturen. Dokumenten är viktiga
          för att säkerställa kvalitet och säkerhet enligt {standardConfig.label}.
        </p>
      </div>
    </div>
  )

  const renderWelding = () => {
    if (!isWeldingStandard) {
      return (
        <div className="page">
          <PageHeader
            title="Svetsrapporter"
            subtitle="Svetsrapporter är kopplade till ISO 3834-2"
            actions={headerActions()}
          />
          <div className="panel">
            <EmptyState
              icon={icons.document}
              title="Ingen svetsrapportdata"
              description="Byt till ISO 3834-2 för att se rapporterna."
            />
          </div>
        </div>
      )
    }

    const needle = weldingSearch.trim().toLowerCase()
    const filteredReports = weldingReports.filter((report) => {
      if (!needle) return true
      const haystack = [
        report.welder_name,
        report.welder_id,
        report.customer_ao_number,
        report.own_ao_number,
        report.profiles?.full_name,
        report.bessy_anm_ofelia,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })

    return (
      <div className="page">
        <PageHeader
          title="Svetsrapporter"
          subtitle="Granska och attestera svetsrapporter från tidrapporteringen"
          actions={headerActions(
            <button className="btn ghost" type="button" onClick={() => fetchWeldingReports()}>
              <span className="icon">{icons.refresh}</span>
              Uppdatera
            </button>
          )}
        />
        <div className="toolbar">
          <div className="field large">
            <span className="field-icon">{icons.list}</span>
            <input
              placeholder="Sök på rapportnummer, svetsare, metod..."
              value={weldingSearch}
              onChange={(event) => setWeldingSearch(event.target.value)}
            />
          </div>
        </div>
        {weldingError ? <div className="notice warning">{weldingError}</div> : null}
        <div className="panel">
          {weldingLoading ? (
            <div className="empty-state">
              <div className="empty-icon">{icons.clock}</div>
              <strong>Laddar svetsrapporter...</strong>
              <span>Hämtar data från tidrapporteringen</span>
            </div>
          ) : filteredReports.length === 0 ? (
            <EmptyState
              icon={icons.document}
              title="Inga svetsrapporter"
              description="Det finns inga svetsrapporter för nuvarande filter."
            />
          ) : (
            <div className="report-list">
              {filteredReports.map((report) => {
                const isAttested = report.attested || !!report.attested_at
                const entryCount = Array.isArray(report.welding_entries)
                  ? report.welding_entries.length
                  : 0
                return (
                  <div className="report-card" key={report.id}>
                    <div className="report-main">
                      <strong>
                        {report.welder_name || 'Svetsrapport'}{' '}
                        {report.welder_id ? `(${report.welder_id})` : ''}
                      </strong>
                      <div className="report-meta">
                        <span>Datum: {formatReportDate(report)}</span>
                        <span>Rapport: #{report.id}</span>
                        <span>Rader: {entryCount}</span>
                        {report.customer_ao_number ? <span>Kund Ao: {report.customer_ao_number}</span> : null}
                        {report.own_ao_number ? <span>Eget Ao: {report.own_ao_number}</span> : null}
                        <span>Skapad av: {report.profiles?.full_name || '-'}</span>
                      </div>
                    </div>
                    <div className="report-status">
                      <span className={`status-chip ${isAttested ? 'success' : 'warning'}`}>
                        {isAttested ? 'Attesterad' : 'Väntar attest'}
                      </span>
                      {isAttested ? (
                        <span className="report-note">
                          {report.attested_by_name
                            ? `Attesterad av ${report.attested_by_name}`
                            : 'Attesterad'}
                        </span>
                      ) : null}
                    </div>
                    <div className="report-actions">
                      <button className="btn ghost small" type="button" onClick={() => handleViewWeldingPdf(report)}>
                        <span className="icon">{icons.eye}</span>
                        Visa PDF
                      </button>
                      <button
                        className="btn ghost small"
                        type="button"
                        onClick={() => handleDownloadWeldingPdf(report)}
                      >
                        <span className="icon">{icons.download}</span>
                        Ladda ner PDF
                      </button>
                      {isAdmin ? (
                        <button
                          className="btn primary small"
                          type="button"
                          disabled={isAttested || attestingReportId === report.id}
                          onClick={() => handleAttestReport(report)}
                        >
                          <span className="icon">{icons.check}</span>
                          {isAttested ? 'Attesterad' : attestingReportId === report.id ? 'Attesterar...' : 'Attestera'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderDeviations = () => (
    <div className="page">
      <PageHeader
        title="Avvikelser"
        subtitle="Registrera och hantera kvalitetsavvikelser och korrigerande åtgärder"
        actions={headerActions(
          <button className="btn primary" type="button" onClick={() => setActiveModal('deviation')}>
            <span className="icon">{icons.plus}</span>
            Ny avvikelse
          </button>
        )}
      />
      <div className="toolbar">
        <div className="field">
          <span className="field-icon">{icons.list}</span>
          <input placeholder="Sök avvikelser..." />
        </div>
        <select>
          <option>Alla status</option>
          <option>Öppna</option>
          <option>Stängda</option>
        </select>
      </div>
      <div className="panel">
        <EmptyState icon={icons.alert} title="Inga avvikelser" description="Inga avvikelser registrerade" />
      </div>
    </div>
  )

  const renderInspections = () => (
    <div className="page">
      <PageHeader
        title="Inspektioner"
        subtitle="Planera och dokumentera kvalitetskontroller och inspektioner"
        actions={headerActions(
          <button className="btn primary" type="button" onClick={() => setActiveModal('inspection')}>
            <span className="icon">{icons.plus}</span>
            Ny inspektion
          </button>
        )}
      />
      <div className="toolbar">
        <div className="field">
          <span className="field-icon">{icons.list}</span>
          <input placeholder="Sök inspektioner..." />
        </div>
        <select>
          <option>Alla status</option>
          <option>Planerade</option>
          <option>Avslutade</option>
        </select>
      </div>
      <div className="panel">
        <EmptyState
          icon={icons.clipboard}
          title="Inga inspektioner"
          description="Planera din första inspektion"
        />
      </div>
    </div>
  )

  const renderProjects = () => (
    <div className="page">
      <PageHeader
        title="Projekt"
        subtitle="Hantera svetsprojekt och kunduppdrag"
        actions={headerActions(
          <button className="btn primary" type="button">
            <span className="icon">{icons.plus}</span>
            Nytt projekt
          </button>
        )}
      />
      <div className="toolbar">
        <div className="field">
          <span className="field-icon">{icons.list}</span>
          <input placeholder="Sök projekt..." />
        </div>
      </div>
      <div className="panel">
        <EmptyState icon={icons.folder} title="Inga projekt" description="Skapa ditt första projekt" />
      </div>
    </div>
  )

  const renderCalibration = () => (
    <div className="page">
      <PageHeader
        title="Verktygskalibrering"
        subtitle="Hantera kalibrering av mätverktyg"
        actions={headerActions(
          <button className="btn primary" type="button" onClick={() => setActiveModal('tool')}>
            <span className="icon">{icons.plus}</span>
            Lägg till verktyg
          </button>
        )}
      />
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <span className="panel-icon">{icons.tool}</span>
            <h2>Kalibrerade verktyg</h2>
          </div>
        </div>
        <EmptyState
          icon={icons.tool}
          title="Inga verktyg registrerade"
          description="Lägg till verktyg för att följa kalibrering"
        />
      </div>
    </div>
  )

  const renderUsers = () => (
    <div className="page">
      <PageHeader
        title="Användare"
        subtitle="Hantera användare och behörigheter"
        actions={headerActions(
          <button className="btn primary" type="button" onClick={() => setActiveModal('user')}>
            <span className="icon">{icons.plus}</span>
            Lägg till användare
          </button>
        )}
      />
      <div className="toolbar">
        <div className="field">
          <span className="field-icon">{icons.list}</span>
          <input placeholder="Sök användare..." />
        </div>
      </div>
      <div className="panel">
        <EmptyState icon={icons.users} title="Inga användare" description="Inga användare registrerade" />
      </div>
    </div>
  )

  const renderSettings = () => (
    <div className="page">
      <PageHeader
        title="Inställningar"
        subtitle="Systeminställningar och företagsinformation"
        actions={headerActions()}
      />
      <div className="split-grid">
        <div className="panel">
          <div className="panel-title">
            <span className="panel-icon">{icons.document}</span>
            <h3>Företagsinformation</h3>
          </div>
          <p className="muted">{standardConfig.infoIntro}</p>
          <div className="info-block">
            <div>
              <span>Företagsnamn</span>
              <strong>{companyName}</strong>
            </div>
            <div>
              <span>Standard</span>
              <strong>{standardConfig.full}</strong>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-title">
            <span className="panel-icon">{icons.users}</span>
            <h3>Svetsansvarig</h3>
          </div>
          <p className="muted">Kontaktuppgifter för svetsansvarig</p>
          <div className="info-block">
            <div>
              <span>Namn</span>
              <strong>{displayName}</strong>
            </div>
            <div>
              <span>Telefon</span>
              <strong>0737470621</strong>
            </div>
            <div>
              <span>E-post</span>
              <strong>{auth?.user?.email || 'edgar@railwork.se'}</strong>
            </div>
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">
          <span className="panel-icon">{icons.shield}</span>
          <h3>{standardConfig.aboutTitle}</h3>
        </div>
        <p className="muted">{standardConfig.aboutSubtitle}</p>
        <p>{standardConfig.aboutIntro}</p>
        <div className="list">
          <span>Huvudsakliga krav:</span>
          <ul>
            {standardConfig.requirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )

  const renderSuperAdmin = () => (
    <div className="page">
      <PageHeader
        title="Super Admin"
        subtitle="Hantera företag och systemanvändare"
        actions={headerActions(
          <button className="btn primary" type="button">
            <span className="icon">{icons.plus}</span>
            Lägg till företag
          </button>
        )}
      />
      <div className="tabs">
        <button
          className={`tab ${superTab === 'companies' ? 'active' : ''}`}
          onClick={() => setSuperTab('companies')}
          type="button"
        >
          <span className="icon">{icons.building}</span>
          Företag
        </button>
        <button
          className={`tab ${superTab === 'users' ? 'active' : ''}`}
          onClick={() => setSuperTab('users')}
          type="button"
        >
          <span className="icon">{icons.users}</span>
          Användare
        </button>
      </div>
      {superTab === 'companies' ? (
        <>
          <h3 className="section-title">Alla företag</h3>
          <div className="company-grid">
            {[
              { name: 'Dala Spar&Markt...', short: 'Dala Spar', date: '2025-12-19' },
              { name: 'Rail Work Entrep...', short: 'Rail Work Entreprenad', date: '2025-12-19' },
              { name: 'Rail Work i Sveri...', short: 'Rail Work', date: '2025-12-19' },
            ].map((item) => (
              <div className="company-card" key={item.name}>
                <div className="company-header">
                  <strong>{item.name}</strong>
                  <div className="company-actions">
                    <button type="button" className="icon-btn">
                      {icons.edit}
                    </button>
                    <button type="button" className="icon-btn danger">
                      {icons.trash}
                    </button>
                  </div>
                </div>
                <span>Kortnamn: {item.short}</span>
                <span>Skapad: {item.date}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="panel">
          <EmptyState icon={icons.users} title="Inga användare" description="Inga systemanvändare registrerade" />
        </div>
      )}
    </div>
  )

  const renderContent = () => {
    switch (activePage) {
      case 'documents':
        return renderDocuments()
      case 'tdok':
        return renderTdok()
      case 'welding':
        return renderWelding()
      case 'deviations':
        return renderDeviations()
      case 'inspections':
        return renderInspections()
      case 'projects':
        return renderProjects()
      case 'calibration':
        return renderCalibration()
      case 'users':
        return renderUsers()
      case 'settings':
        return renderSettings()
      case 'superadmin':
        return renderSuperAdmin()
      default:
        return renderDashboard()
    }
  }

  return (
    <div className="qms-app">
      <aside className="qms-sidebar">
        <div className="brand">
          <span className="brand-icon">{icons.shield}</span>
          <div>
            <div className="brand-title">Kvalitetssystem</div>
            <div className="brand-sub">{companyShort}</div>
          </div>
        </div>
        {backButton ? <div className="nav-group">{backButton}</div> : null}
        <div className="nav-group">
          <span className="nav-label">HUVUDMENY</span>
          <nav>
            {navMain.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                onClick={() => setActivePage(item.id)}
              >
                <span className="icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="nav-group">
          <span className="nav-label">ADMINISTRATION</span>
          <nav>
            {navAdmin.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                onClick={() => setActivePage(item.id)}
              >
                <span className="icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        {isSuperAdmin ? (
          <div className="nav-group">
            <span className="nav-label">SUPER ADMIN</span>
            <nav>
              {navSuper.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                  onClick={() => setActivePage(item.id)}
                >
                  <span className="icon">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        ) : null}
        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="avatar">{initials}</span>
            <div>
              <strong>{displayName}</strong>
              <span>{roleLabel}</span>
            </div>
          </div>
        </div>
      </aside>
      <main className="qms-main">{renderContent()}</main>
      <Modal
        open={activeModal === 'document'}
        title="Skapa nytt dokument"
        onClose={() => setActiveModal(null)}
        actions={
          <>
            <button className="btn ghost" type="button" onClick={() => setActiveModal(null)}>
              Avbryt
            </button>
            <button className="btn primary" type="button" onClick={() => setActiveModal(null)}>
              Skapa
            </button>
          </>
        }
      >
        <div className="modal-grid">
          <Field label="Dokumenttyp">
            <select className="input">
              <option>WPS (Svetsproceduranvisning)</option>
              <option>WPQR (Procedurkvalificering)</option>
              <option>Svetsarcertifikat</option>
              <option>Procedur</option>
              <option>Instruktion</option>
              <option>Övrigt</option>
            </select>
          </Field>
          <div className="form-row">
            <Field label="Dokumentnummer">
              <input className="input" placeholder="WPS-001" />
            </Field>
            <Field label="Version">
              <input className="input" placeholder="1.0" />
            </Field>
          </div>
          <Field label="Titel">
            <input className="input" placeholder="Svetsprocedur för S355..." />
          </Field>
          <Field label="Beskrivning">
            <textarea className="textarea" placeholder="Beskriv dokumentets innehåll..." />
          </Field>
          <div className="form-row">
            <Field label="Giltig från">
              <input className="input" type="date" />
            </Field>
            <Field label="Giltig till">
              <input className="input" type="date" />
            </Field>
          </div>
        </div>
      </Modal>
      <Modal
        open={activeModal === 'deviation'}
        title="Rapportera avvikelse"
        onClose={() => setActiveModal(null)}
        actions={
          <>
            <button className="btn ghost" type="button" onClick={() => setActiveModal(null)}>
              Avbryt
            </button>
            <button className="btn primary" type="button" onClick={() => setActiveModal(null)}>
              Rapportera
            </button>
          </>
        }
      >
        <div className="modal-grid">
          <Field label="Titel">
            <input className="input" placeholder="Kort beskrivning av avvikelsen" />
          </Field>
          <Field label="Beskrivning">
            <textarea className="textarea" placeholder="Detaljerad beskrivning av avvikelsen..." />
          </Field>
          <div className="form-row">
            <Field label="Allvarlighetsgrad">
              <select className="input">
                <option>Mindre</option>
                <option>Mellan</option>
                <option>Allvarlig</option>
                <option>Kritisk</option>
              </select>
            </Field>
            <Field label="Förfallodatum">
              <input className="input" type="date" />
            </Field>
          </div>
          <Field label="Plats/Område">
            <input className="input" placeholder="Var avvikelsen uppstod" />
          </Field>
        </div>
      </Modal>
      <Modal
        open={activeModal === 'inspection'}
        title="Planera inspektion"
        onClose={() => setActiveModal(null)}
        actions={
          <>
            <button className="btn ghost" type="button" onClick={() => setActiveModal(null)}>
              Avbryt
            </button>
            <button className="btn primary" type="button" onClick={() => setActiveModal(null)}>
              Planera
            </button>
          </>
        }
      >
        <div className="modal-grid">
          <Field label="Titel">
            <input className="input" placeholder="Namn på inspektionen" />
          </Field>
          <div className="form-row">
            <Field label="Typ av inspektion">
              <select className="input">
                <option>Visuell kontroll</option>
                <option>Dokumentgranskning</option>
                <option>Intern revision</option>
                <option>Kundrevision</option>
              </select>
            </Field>
            <Field label="Planerat datum">
              <input className="input" type="date" />
            </Field>
          </div>
          <Field label="Plats/Område">
            <input className="input" placeholder="Var inspektionen ska utföras" />
          </Field>
          <Field label="Beskrivning">
            <textarea className="textarea" placeholder="Beskriv vad som ska inspekteras..." />
          </Field>
        </div>
      </Modal>
      <Modal
        open={activeModal === 'tool'}
        title="Lägg till verktyg"
        onClose={() => setActiveModal(null)}
        actions={
          <>
            <button className="btn ghost" type="button" onClick={() => setActiveModal(null)}>
              Avbryt
            </button>
            <button className="btn primary" type="button" onClick={() => setActiveModal(null)}>
              Spara
            </button>
          </>
        }
      >
        <div className="modal-grid">
          <Field label="Verktygsnamn" required>
            <input className="input" placeholder="T.ex. Termometer, Måttband" />
          </Field>
          <Field label="Serienummer">
            <input className="input" placeholder="Serienummer" />
          </Field>
          <div className="form-row">
            <Field label="Kalibreringsdatum" required>
              <input className="input" type="date" />
            </Field>
            <Field label="Nästa kalibrering">
              <input className="input" type="date" />
            </Field>
          </div>
          <Field label="Kalibrerad av">
            <input className="input" placeholder="Namn eller företag" />
          </Field>
          <Field label="Certifikatnummer">
            <input className="input" placeholder="Certifikatnummer" />
          </Field>
          <Field label="Anteckningar">
            <textarea className="textarea" placeholder="Eventuella anteckningar" />
          </Field>
        </div>
      </Modal>
      <Modal
        open={activeModal === 'user'}
        title="Lägg till ny användare"
        onClose={() => setActiveModal(null)}
        actions={
          <>
            <button className="btn ghost" type="button" onClick={() => setActiveModal(null)}>
              Avbryt
            </button>
            <button className="btn primary" type="button" onClick={() => setActiveModal(null)}>
              Lägg till
            </button>
          </>
        }
      >
        <div className="modal-grid">
          <Field label="Fullständigt namn">
            <input className="input" placeholder="Anna Andersson" />
          </Field>
          <Field label="E-post">
            <input className="input" placeholder="anna@exempel.se" />
          </Field>
          <Field label="Lösenord">
            <input className="input" type="password" placeholder="Minst 6 tecken" />
          </Field>
          <Field label="Roll">
            <select className="input">
              <option>Svetsare</option>
              <option>Inspektör</option>
              <option>Svetsansvarig</option>
              <option>Administratör</option>
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
