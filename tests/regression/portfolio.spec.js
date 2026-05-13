/**
 * Portfolio Update Regression Tests
 *
 * Covers:
 *  P1  Agent can update own portfolio via chat
 *  P2  Portfolio update is stored in Milvus (searchable)
 *  P3  Agent cannot update another agent's portfolio via API
 *  P4  Super Admin weekly report covers all agents
 *  P5  RAG context docs only contain allowed scope
 */
import { test, expect } from '@playwright/test'
import {
  selectRole, sendMessage, lastAssistantMessage,
  lastMessageIsDenied, getContextOwners,
} from '../helpers/actions.js'

const BASE = 'http://localhost:8000'

test.describe('Portfolio Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  // P1
  test('Agent 1 can update own portfolio via chat', async ({ page }) => {
    await selectRole(page, 'Agent 1')
    await sendMessage(page, 'Update my portfolio: Client Rahul now has Rs 25L in mutual funds')
    const denied = await lastMessageIsDenied(page)
    expect(denied).toBe(false)
    const text = await lastAssistantMessage(page)
    // Should confirm update
    expect(
      text.toLowerCase().includes('updated') ||
      text.toLowerCase().includes('stored') ||
      text.toLowerCase().includes('saved')
    ).toBe(true)
  })

  // P2
  test('Portfolio update is searchable via API', async ({ request }) => {
    // Insert a uniquely-identifiable document
    const insertResp = await request.post(`${BASE}/api/portfolio/document`, {
      data: {
        requesting_user_id: 'agent_1',
        portfolio_owner: 'agent_1',
        client_id: 'client_rahul',
        document_type: 'portfolio_note',
        content: 'REGRESSION_TEST_DOC: Rahul has Rs 99L in test bonds',
        document_id: 'regression_test_doc_001',
      },
    })
    expect(insertResp.status()).toBe(200)

    // Now search for it
    const searchResp = await request.get(
      `${BASE}/api/portfolio/search?requesting_user_id=agent_1&query=REGRESSION_TEST_DOC test bonds`
    )
    const body = await searchResp.json()
    const found = body.results.some(r => r.document_id === 'regression_test_doc_001')
    expect(found).toBe(true)
  })

  // P3
  test('Agent 2 cannot insert into Agent 1 portfolio via API', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/portfolio/document`, {
      data: {
        requesting_user_id: 'agent_2',
        portfolio_owner: 'agent_1',
        client_id: 'client_rahul',
        document_type: 'portfolio_note',
        content: 'Agent 2 trying to write to Agent 1 scope',
      },
    })
    expect(resp.status()).toBe(403)
  })

  // P4
  test('Super Admin weekly report includes data from both agents', async ({ page }) => {
    await selectRole(page, 'Super Admin')
    await sendMessage(page, 'Generate weekly reports for all agents')
    const text = await lastAssistantMessage(page)
    expect(text.toLowerCase()).not.toContain('access denied')
    // Report should mention both agents
    const lower = text.toLowerCase()
    const mentionsAgent1 = lower.includes('agent_1') || lower.includes('agent 1')
    const mentionsAgent2 = lower.includes('agent_2') || lower.includes('agent 2')
    expect(mentionsAgent1).toBe(true)
    expect(mentionsAgent2).toBe(true)
  })

  // P5
  test('Agent 1 RAG context only returns agent_1 documents', async ({ page }) => {
    await selectRole(page, 'Agent 1')
    await sendMessage(page, 'Show my portfolio summary')
    const owners = await getContextOwners(page)
    // Every retrieved doc must belong to agent_1
    for (const owner of owners) {
      expect(owner).toBe('agent_1')
    }
  })

  // P6 — Cross-scope search via API denied
  test('Agent 1 search API cannot retrieve agent_2 documents', async ({ request }) => {
    const resp = await request.get(
      `${BASE}/api/portfolio/search?requesting_user_id=agent_1&query=arjun meera stocks bonds`
    )
    const body = await resp.json()
    for (const doc of body.results) {
      expect(doc.portfolio_owner).toBe('agent_1')
    }
  })
})
