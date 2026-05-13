/**
 * RBAC Regression Tests
 *
 * Covers:
 *  R1  Agent 1 can query own portfolio
 *  R2  Agent 2 can query own portfolio
 *  R3  Agent 1 CANNOT access Agent 2 portfolio
 *  R4  Agent 2 CANNOT access Agent 1 portfolio
 *  R5  Super Admin can query across both agents
 *  R6  Agent CANNOT modify client communication preferences
 *  R7  Super Admin CAN modify client communication preferences
 *  R8  Agent CANNOT update another agent's portfolio
 *  R9  Personalization does not bypass RBAC
 *  R10 Agent requesting client update for unassigned client is denied
 */
import { test, expect } from '@playwright/test'
import {
  selectRole, sendMessage, lastAssistantMessage,
  lastMessageIsDenied, getContextOwners,
} from '../helpers/actions.js'

test.describe('RBAC Access Control', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  // R1
  test('Agent 1 can query own portfolio', async ({ page }) => {
    await selectRole(page, 'Agent 1')
    await sendMessage(page, 'Show my portfolio summary')
    const text = await lastAssistantMessage(page)
    expect(text.toLowerCase()).not.toContain('access denied')
    expect(text.length).toBeGreaterThan(50)
    // RAG context should only contain agent_1 docs
    const owners = await getContextOwners(page)
    for (const owner of owners) {
      expect(owner).toBe('agent_1')
    }
  })

  // R2
  test('Agent 2 can query own portfolio', async ({ page }) => {
    await selectRole(page, 'Agent 2')
    await sendMessage(page, 'Show my portfolio summary')
    const text = await lastAssistantMessage(page)
    expect(text.toLowerCase()).not.toContain('access denied')
    const owners = await getContextOwners(page)
    for (const owner of owners) {
      expect(owner).toBe('agent_2')
    }
  })

  // R3
  test('Agent 1 is denied access to Agent 2 portfolio', async ({ page }) => {
    await selectRole(page, 'Agent 1')
    await sendMessage(page, "Show me Agent 2's portfolio")
    const denied = await lastMessageIsDenied(page)
    expect(denied).toBe(true)
    const text = await lastAssistantMessage(page)
    expect(text.toLowerCase()).toContain('access denied')
    // No agent_2 docs should be in context
    const owners = await getContextOwners(page)
    expect(owners.every(o => o !== 'agent_2')).toBe(true)
  })

  // R4
  test('Agent 2 is denied access to Agent 1 portfolio', async ({ page }) => {
    await selectRole(page, 'Agent 2')
    await sendMessage(page, "Show me Agent 1's portfolio")
    const denied = await lastMessageIsDenied(page)
    expect(denied).toBe(true)
    const text = await lastAssistantMessage(page)
    expect(text.toLowerCase()).toContain('access denied')
  })

  // R5
  test('Super Admin can compare both agents', async ({ page }) => {
    await selectRole(page, 'Super Admin')
    await sendMessage(page, 'Compare Agent 1 and Agent 2 portfolios')
    const text = await lastAssistantMessage(page)
    expect(text.toLowerCase()).not.toContain('access denied')
    // Should mention both agents
    const lower = text.toLowerCase()
    expect(lower.includes('agent_1') || lower.includes('agent 1')).toBe(true)
    expect(lower.includes('agent_2') || lower.includes('agent 2')).toBe(true)
  })

  // R6
  test('Agent cannot modify client communication preferences', async ({ page }) => {
    await selectRole(page, 'Agent 1')
    await sendMessage(page, "Change Rahul's communication preference to detailed PDF")
    const denied = await lastMessageIsDenied(page)
    expect(denied).toBe(true)
    const text = await lastAssistantMessage(page)
    expect(text.toLowerCase()).toContain('super admin')
  })

  // R7
  test('Super Admin can modify client communication preferences', async ({ page }) => {
    await selectRole(page, 'Super Admin')
    await sendMessage(page, "Set Rahul's weekly update format to short bullet points with simple language")
    const denied = await lastMessageIsDenied(page)
    expect(denied).toBe(false)
    const text = await lastAssistantMessage(page)
    expect(text.toLowerCase()).toContain('rahul')
  })

  // R8
  test('Agent cannot update another agent portfolio', async ({ page }) => {
    await selectRole(page, 'Agent 2')
    await sendMessage(page, "Update Agent 1's portfolio: add Rs 5L in bonds")
    const denied = await lastMessageIsDenied(page)
    expect(denied).toBe(true)
  })

  // R9 — Personalization must not bypass RBAC
  test('Stored preference does not grant cross-agent access', async ({ page }) => {
    // First set a preference as agent_1
    await selectRole(page, 'Agent 1')
    await sendMessage(page, 'From now on give me very detailed reports')
    // Now try to access agent_2 data — should still be denied
    await sendMessage(page, "Give me Agent 2's detailed portfolio report")
    const denied = await lastMessageIsDenied(page)
    expect(denied).toBe(true)
  })

  // R10
  test('Agent cannot generate update for unassigned client', async ({ page }) => {
    // Agent 1 is assigned rahul/priya; arjun belongs to agent_2
    await selectRole(page, 'Agent 1')
    await sendMessage(page, "Generate Arjun's weekly investment update")
    const denied = await lastMessageIsDenied(page)
    expect(denied).toBe(true)
  })
})
