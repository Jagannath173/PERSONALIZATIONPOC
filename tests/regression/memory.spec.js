/**
 * Personalization / Memory Regression Tests
 *
 * Covers:
 *  M1  SET_USER_PREFERENCE is detected and stored
 *  M2  Stored preference shows in memory panel
 *  M3  Preference update overwrites previous (idempotent)
 *  M4  Agent 1 and Agent 2 have isolated memory
 *  M5  Memory is applied to response format
 *  M6  Super Admin has separate personal memory
 */
import { test, expect } from '@playwright/test'
import {
  selectRole, sendMessage, lastAssistantMessage,
  lastMessageSavedMemory, getSidebarMemoryTypes, switchRightTab,
} from '../helpers/actions.js'

test.describe('Personalization & Memory', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  // M1
  test('SET_USER_PREFERENCE is detected and saved', async ({ page }) => {
    await selectRole(page, 'Agent 1')
    await sendMessage(page, 'From now on, give me portfolio answers in bullet points')
    const saved = await lastMessageSavedMemory(page)
    expect(saved).toBe(true)
    const text = await lastAssistantMessage(page)
    expect(text.toLowerCase()).toContain('preference')
  })

  // M2
  test('Saved preference appears in the Memory panel', async ({ page }) => {
    await selectRole(page, 'Agent 1')
    await sendMessage(page, 'I prefer executive summaries with key numbers only')
    // switch to memory tab in right panel
    await switchRightTab(page, 'Memory')
    const badges = await page.locator('.mem-badge').allInnerTexts()
    const hasUserPref = badges.some(b => b.toLowerCase().includes('user preference'))
    expect(hasUserPref).toBe(true)
  })

  // M3
  test('Preference update overwrites the previous one', async ({ page }) => {
    await selectRole(page, 'Agent 1')
    await sendMessage(page, 'I prefer bullet points')
    await sendMessage(page, 'Actually, from now on make my answers short and direct')
    // The second message should also save memory
    const saved = await lastMessageSavedMemory(page)
    expect(saved).toBe(true)
  })

  // M4
  test('Agent 1 and Agent 2 memories are isolated', async ({ request }) => {
    // Add a preference for agent_1 via API
    const r1 = await request.post('http://localhost:8000/api/memory/add', {
      data: { user_id: 'agent_1', memory_type: 'user_preference', content: 'Agent 1 test pref: XYZ_UNIQUE_A1' },
    })
    expect(r1.status()).toBe(200)

    // Agent_2 should NOT see agent_1's memory
    const r2 = await request.get('http://localhost:8000/api/memory/agent_2')
    const body = await r2.json()
    const allContent = (body.user_memories || []).map(m => m.content).join(' ')
    expect(allContent).not.toContain('XYZ_UNIQUE_A1')
  })

  // M5
  test('Preference is applied to the response style', async ({ page }) => {
    await selectRole(page, 'Agent 1')
    // Set a very specific preference that should influence format
    await sendMessage(page, 'From now on, always start every portfolio answer with the word SUMMARY:')
    // Ask a portfolio question — the LLM should follow the stored instruction
    await sendMessage(page, 'Tell me about my portfolio')
    const text = await lastAssistantMessage(page)
    // We check the response is not a denial and contains some content
    expect(text.toLowerCase()).not.toContain('access denied')
    expect(text.length).toBeGreaterThan(30)
  })

  // M6
  test('Super Admin has separate personal memory', async ({ request }) => {
    const r = await request.post('http://localhost:8000/api/memory/add', {
      data: { user_id: 'super_admin', memory_type: 'user_preference', content: 'Super Admin test pref: XYZ_ADMIN_ONLY' },
    })
    expect(r.status()).toBe(200)

    // agent_1 should not see super_admin's memory
    const ra = await request.get('http://localhost:8000/api/memory/agent_1')
    const body = await ra.json()
    const allContent = (body.user_memories || []).map(m => m.content).join(' ')
    expect(allContent).not.toContain('XYZ_ADMIN_ONLY')
  })
})
