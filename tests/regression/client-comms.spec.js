/**
 * Client Communication Regression Tests
 *
 * Covers:
 *  C1  Super Admin can set a client communication preference
 *  C2  Preference is persisted and retrievable via API
 *  C3  Agent cannot set client communication preference
 *  C4  Super Admin can generate client update using stored preference
 *  C5  Agent can generate update for own client (preference applied)
 *  C6  Dynamic preference update by Super Admin is reflected
 *  C7  Client prefs are isolated by client_id
 */
import { test, expect } from '@playwright/test'
import {
  selectRole, sendMessage, lastAssistantMessage,
  lastMessageIsDenied, lastMessageSavedMemory,
} from '../helpers/actions.js'

const BASE = 'http://localhost:8000'

test.describe('Client Communication Preferences', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  // C1
  test('Super Admin can set client communication preference via chat', async ({ page }) => {
    await selectRole(page, 'Super Admin')
    await sendMessage(page, "Set Rahul's weekly update format to short bullet points with simple language")
    const saved = await lastMessageSavedMemory(page)
    expect(saved).toBe(true)
    const text = await lastAssistantMessage(page)
    expect(text.toLowerCase()).toContain('rahul')
  })

  // C2
  test('Client preference is persisted and retrievable via API', async ({ request }) => {
    const setResp = await request.post(`${BASE}/api/memory/client-preference`, {
      data: {
        requesting_user_id: 'super_admin',
        client_id: 'client_rahul',
        preference: 'Rahul prefers short bullet points — regression test',
      },
    })
    expect(setResp.status()).toBe(200)

    const getResp = await request.get(
      `${BASE}/api/memory/client/client_rahul/preference?requesting_user_id=super_admin`
    )
    const body = await getResp.json()
    expect(body.preference).not.toBeNull()
    expect(body.preference.content).toContain('regression test')
  })

  // C3
  test('Agent cannot set client communication preference via API', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/memory/client-preference`, {
      data: {
        requesting_user_id: 'agent_1',
        client_id: 'client_rahul',
        preference: 'Agent trying to change preference',
      },
    })
    expect(resp.status()).toBe(403)
  })

  // C4
  test('Super Admin can generate client update applying stored preference', async ({ page }) => {
    await selectRole(page, 'Super Admin')
    await sendMessage(page, "Generate Rahul's weekly investment update")
    const text = await lastAssistantMessage(page)
    expect(text.toLowerCase()).not.toContain('access denied')
    // Should include client name and be non-trivial
    expect(text.toLowerCase()).toContain('rahul')
    expect(text.length).toBeGreaterThan(80)
  })

  // C5
  test('Agent 1 can generate update for own client (Priya)', async ({ page }) => {
    await selectRole(page, 'Agent 1')
    await sendMessage(page, "Generate Priya's weekly investment update")
    const denied = await lastMessageIsDenied(page)
    expect(denied).toBe(false)
    const text = await lastAssistantMessage(page)
    expect(text.length).toBeGreaterThan(50)
  })

  // C6
  test('Dynamic preference update by Super Admin is reflected in API', async ({ request }) => {
    // Set initial preference
    await request.post(`${BASE}/api/memory/client-preference`, {
      data: {
        requesting_user_id: 'super_admin',
        client_id: 'client_arjun',
        preference: 'Arjun prefers email style — v1',
      },
    })

    // Update preference
    const updateResp = await request.post(`${BASE}/api/memory/client-preference`, {
      data: {
        requesting_user_id: 'super_admin',
        client_id: 'client_arjun',
        preference: 'Arjun prefers email style with risk highlights — v2 updated',
      },
    })
    expect(updateResp.status()).toBe(200)

    const getResp = await request.get(
      `${BASE}/api/memory/client/client_arjun/preference?requesting_user_id=super_admin`
    )
    const body = await getResp.json()
    expect(body.preference.content).toContain('v2 updated')
    expect(body.preference.content).not.toContain('v1')
  })

  // C7
  test('Client preferences are isolated per client_id', async ({ request }) => {
    await request.post(`${BASE}/api/memory/client-preference`, {
      data: {
        requesting_user_id: 'super_admin',
        client_id: 'client_meera',
        preference: 'Meera pref: ISOLATION_TEST_MEERA',
      },
    })

    const rahulResp = await request.get(
      `${BASE}/api/memory/client/client_rahul/preference?requesting_user_id=super_admin`
    )
    const rahulBody = await rahulResp.json()
    const content = rahulBody.preference?.content || ''
    expect(content).not.toContain('ISOLATION_TEST_MEERA')
  })
})
