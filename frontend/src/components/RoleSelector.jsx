export default function RoleSelector({ users, currentUser, onSelect }) {
  if (!users) return <div className="empty">Loading users…</div>

  return (
    <div>
      {Object.values(users).map((u) => (
        <div
          key={u.user_id}
          className={`role-card ${currentUser?.user_id === u.user_id ? 'active' : ''}`}
          onClick={() => onSelect(u)}
        >
          <div className={`r-avatar ${u.role}`}>
            {u.role === 'super_admin' ? '👑' : '👤'}
          </div>
          <div>
            <div className="r-name">{u.name}</div>
            <span className={`r-badge ${u.role}`}>
              {u.role === 'super_admin' ? 'Super Admin' : 'Agent'}
            </span>
            <div className="scope-chips" style={{ marginTop: 4 }}>
              {u.allowed_portfolio_scope.includes('*')
                ? <span className="scope-chip">All Agents</span>
                : u.allowed_portfolio_scope.map((s) => (
                    <span key={s} className="scope-chip">{s}</span>
                  ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
