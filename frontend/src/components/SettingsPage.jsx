import { useNavigate, useParams } from 'react-router-dom'
import AdminPanel from './AdminPanel'
import ContextPanel from './ContextPanel'
import MemoryPanel from './MemoryPanel'
import UploadPanel from './UploadPanel'
import GeneralSection from './settings/GeneralSection'
import PreferencesSection from './settings/PreferencesSection'

const ICONS = {
  general:     <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />,
  preferences: <path d="M9 12l2 2 4-4M5 13l4 4L19 7M3 21h18" />,
  memory:      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM12 6v6l4 2" />,
  rag:         <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20" />,
  upload:      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
  manage:      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M12.5 11a4 4 0 100-8 4 4 0 000 8z" />,
}

function Icon({ id }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[id]}
    </svg>
  )
}

const SECTIONS_BASE = [
  { id: 'general',     label: 'General' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'memory',      label: 'Memory' },
  { id: 'rag',         label: 'RAG context' },
]
const SECTIONS_ADMIN = [
  { id: 'upload', label: 'Upload documents' },
  { id: 'manage', label: 'Manage team' },
]

export default function SettingsPage({
  user,
  contextDocs,
  memoryRefreshKey,
  updateProfile,
  onLogout,
}) {
  const navigate = useNavigate()
  const { section } = useParams()

  if (!user) return null

  const sections = user.role === 'super_admin'
    ? [...SECTIONS_BASE, ...SECTIONS_ADMIN]
    : SECTIONS_BASE

  const active = sections.find(s => s.id === section) || sections[0]

  const goTo = (id) => navigate(`/settings/${id}`)
  const close = () => navigate('/')

  return (
    <div className="settings-page" role="region" aria-label="Settings">
      <header className="settings-topbar">
        <div className="settings-title">Settings</div>
        <button
          type="button"
          className="settings-close"
          onClick={close}
          aria-label="Back to chat"
          title="Back to chat"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6"  y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {sections.map(s => (
            <button
              key={s.id}
              type="button"
              className={`settings-nav-item ${active.id === s.id ? 'active' : ''}`}
              onClick={() => goTo(s.id)}
            >
              <Icon id={s.id} />
              <span>{s.label}</span>
            </button>
          ))}
        </nav>

        <section className="settings-content">
          {active.id === 'general' && (
            <GeneralSection
              user={user}
              updateProfile={updateProfile}
              onLogout={onLogout}
            />
          )}
          {active.id === 'preferences' && (
            <PreferencesSection user={user} refreshKey={memoryRefreshKey} />
          )}
          {active.id === 'memory' && (
            <>
              <h2 className="settings-h">Conversation memory</h2>
              <p className="settings-subtitle">
                Long-term context the assistant remembers about you, plus
                a snapshot of your persisted conversation history.
              </p>
              <div className="settings-card">
                <MemoryPanel currentUser={user} refreshKey={memoryRefreshKey} />
              </div>
            </>
          )}
          {active.id === 'rag' && (
            <>
              <h2 className="settings-h">Retrieved documents</h2>
              <p className="settings-subtitle">
                Documents the assistant pulled for your most recent question.
                These are filtered to your access scope — you can only see what
                belongs to you.
              </p>
              <div className="settings-card">
                <ContextPanel docs={contextDocs} />
              </div>
            </>
          )}
          {active.id === 'upload' && user.role === 'super_admin' && (
            <>
              <h2 className="settings-h">Upload documents</h2>
              <p className="settings-subtitle">
                Add new PDF / DOCX / PPTX / CSV / TXT files into an employee's
                knowledge base. Files are tagged to the assigned employee and
                isolated from everyone else.
              </p>
              <div className="settings-card">
                <UploadPanel currentUser={user} />
              </div>
            </>
          )}
          {active.id === 'manage' && user.role === 'super_admin' && (
            <>
              <h2 className="settings-h">Team management</h2>
              <p className="settings-subtitle">
                Create or remove employees and clients, and reassign clients
                between employees.
              </p>
              <div className="settings-card">
                <AdminPanel currentUser={user} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
