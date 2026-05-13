/**
 * Smoke tests — verify the app loads and all three roles are selectable.
 */
import { test, expect } from '@playwright/test'

test.describe('Smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with bank branding', async ({ page }) => {
    // Theme logo text should be visible (JPMC or HSBC depending on theme.config)
    const topbar = page.locator('.topbar-logo')
    await expect(topbar).toBeVisible()
    const text = await topbar.innerText()
    expect(text.length).toBeGreaterThan(0)
  })

  test('all three roles are listed', async ({ page }) => {
    await expect(page.getByText('Super Admin', { exact: true })).toBeVisible()
    await expect(page.getByText('Agent 1', { exact: true })).toBeVisible()
    await expect(page.getByText('Agent 2', { exact: true })).toBeVisible()
  })

  test('no role selected shows lock screen', async ({ page }) => {
    await expect(page.locator('.welcome-icon')).toBeVisible()
    await expect(page.locator('.chat-msgs')).not.toBeVisible()
  })

  test('selecting a role shows the chat interface', async ({ page }) => {
    await page.getByText('Agent 1', { exact: true }).first().click()
    await expect(page.locator('.input-box')).toBeVisible()
  })

  test('backend health check', async ({ request }) => {
    const resp = await request.get('http://localhost:8000/health')
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.status).toBe('ok')
  })

  test('users API returns all three users', async ({ request }) => {
    const resp = await request.get('http://localhost:8000/api/users')
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(Object.keys(body)).toContain('super_admin')
    expect(Object.keys(body)).toContain('agent_1')
    expect(Object.keys(body)).toContain('agent_2')
  })
})
