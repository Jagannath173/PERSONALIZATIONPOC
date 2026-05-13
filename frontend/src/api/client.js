const BASE = '/api'

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  getUsers:   () => get('/users'),
  getClients: () => get('/clients'),

  chat: (userId, message, sessionHistory) =>
    post('/chat', { user_id: userId, message, session_history: sessionHistory }),

  getMemory: (userId) => get(`/memory/${userId}`),

  addMemory: (userId, memoryType, content) =>
    post('/memory/add', { user_id: userId, memory_type: memoryType, content }),

  setClientPreference: (requestingUserId, clientId, preference) =>
    post('/memory/client-preference', {
      requesting_user_id: requestingUserId,
      client_id: clientId,
      preference,
    }),

  agentReport:     (agentId, userId)  => get(`/reports/agent/${agentId}?requesting_user_id=${userId}`),
  clientReport:    (clientId, userId) => get(`/reports/client/${clientId}?requesting_user_id=${userId}`),
  allAgentsReport: (userId)           => get(`/reports/all-agents?requesting_user_id=${userId}`),
}
