/**
 * Shared helper actions used across all test specs.
 */

/** Click a role card and wait for the topbar to update */
export async function selectRole(page, roleName) {
  await page.getByText(roleName, { exact: true }).first().click()
  await page.waitForSelector('.topbar-user', { timeout: 5000 })
}

/** Type a message and wait for the assistant reply */
export async function sendMessage(page, message) {
  const input = page.locator('.input-box')
  await input.fill(message)
  await page.keyboard.press('Enter')
  // wait for typing indicator to appear then disappear
  await page.waitForSelector('.dot', { timeout: 5000 }).catch(() => {})
  await page.waitForSelector('.dot', { state: 'detached', timeout: 60_000 })
}

/** Return the text of the last assistant bubble */
export async function lastAssistantMessage(page) {
  const bubbles = page.locator('.msg-row.assistant .msg-bubble')
  const count   = await bubbles.count()
  return bubbles.nth(count - 1).innerText()
}

/** Return true if the last message has the access-denied badge */
export async function lastMessageIsDenied(page) {
  const badges = page.locator('.msg-row.assistant .badge.denied')
  return (await badges.count()) > 0
}

/** Return true if the last message has the memory-updated badge */
export async function lastMessageSavedMemory(page) {
  const badges = page.locator('.msg-row.assistant .badge.updated')
  return (await badges.count()) > 0
}

/** Read all text from the RAG context panel */
export async function getContextOwners(page) {
  const owners = await page.locator('.ctx-owner').allInnerTexts()
  return owners
}

/** Read all memory badge labels from the sidebar */
export async function getSidebarMemoryTypes(page) {
  return page.locator('.mem-badge').allInnerTexts()
}

/** Switch right panel tab */
export async function switchRightTab(page, tab) {
  await page.locator(`.p-tab:has-text("${tab}")`).click()
}
