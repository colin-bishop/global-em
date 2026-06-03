import { test, expect } from '@playwright/test'

test.describe('Table Tab', () => {
  test('table tab shows all 41 programmes', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Table', exact: true }).click()
    await page.waitForSelector('tbody tr')
    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(41)
  })

  test('clicking a table row opens the correct programme detail', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Table', exact: true }).click()
    await page.waitForSelector('tbody tr')

    const ghlcmpRow = page.locator('tbody tr').filter({ hasText: 'GHLCMP' })
    await ghlcmpRow.click()

    const detailHeading = page.locator('h2').filter({ hasText: 'GHLCMP' })
    await expect(detailHeading).toBeVisible()

    await expect(page.locator('h2').filter({ hasText: 'West Coast Groundfish' })).toHaveCount(0)
  })

  test('table search filters rows', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Table', exact: true }).click()
    await page.waitForSelector('tbody tr')

    const searchInput = page.locator('input[type="search"], input[placeholder*="earch" i], input[placeholder*="ilter" i]').first()
    await searchInput.fill('GHLCMP')

    const visibleRows = page.locator('tbody tr')
    await expect(visibleRows).toHaveCount(1)
    await expect(visibleRows.first()).toContainText('GHLCMP')
  })

  test('table sorts by clicking column header', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Table', exact: true }).click()
    await page.waitForSelector('tbody tr')

    const firstRow = page.locator('tbody tr').first()
    const firstCellBefore = firstRow.locator('td').first()
    const nameBefore = await firstCellBefore.innerText()

    // Table defaults to programme_name asc; one click flips to desc
    const programmeHeader = page.getByRole('columnheader', { name: /Programme/i }).first()
    await programmeHeader.click()

    const firstCellAfter = page.locator('tbody tr').first().locator('td').first()
    const nameAfter = await firstCellAfter.innerText()

    expect(nameAfter).not.toBe(nameBefore)
  })
})
