import { test, expect } from '@playwright/test'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Navigate to the Add/Edit tab from any page. */
async function goToAddEditTab(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add / Edit Programme' }).click()
  // Wait for the landing screen heading
  await expect(
    page.getByRole('heading', { name: /Add or edit a programme/i })
  ).toBeVisible()
}

/**
 * From the Add/Edit landing screen, expand the "Edit an existing programme"
 * panel, type a search term, wait for results, and click the first result
 * whose visible text matches `resultText`.
 */
async function searchAndSelectProgramme(page, searchTerm, resultText) {
  // Click the "Edit an existing programme" card to expand the search panel
  await page.getByRole('button', { name: /Edit an existing programme/i }).click()

  // The ProgramSearch input should now be visible
  const searchInput = page.locator('input[placeholder="Search programme name…"]')
  await expect(searchInput).toBeVisible()

  await searchInput.fill(searchTerm)

  // Wait for the debounce (300 ms) and for results list to appear.
  // Results are <button> elements containing a <div> with the programme name.
  const resultButton = page.locator('button').filter({ hasText: resultText }).first()
  await expect(resultButton).toBeVisible({ timeout: 5000 })
  await resultButton.click()
}

/**
 * Fill the minimum contact-step fields so that the "Continue" button becomes
 * enabled. In edit mode the contact fields are still required to proceed past
 * step 1.
 */
async function fillContactStep(page) {
  // "Full name" input — Label text "Full name", input rendered by Input component
  const nameInput = page.locator('input[type="text"]').first()
  await nameInput.fill('Test User')

  // "Email address" input — type="email"
  const emailInput = page.locator('input[type="email"]').first()
  await emailInput.fill('test@example.com')
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('Add/Edit tab loads', async ({ page }) => {
  await goToAddEditTab(page)

  // The landing screen heading is already asserted inside goToAddEditTab.
  // Verify both action cards are present.
  await expect(
    page.getByRole('button', { name: /Add a new programme/i })
  ).toBeVisible()

  await expect(
    page.getByRole('button', { name: /Edit an existing programme/i })
  ).toBeVisible()
})

test('editing a programme pre-populates correct data', async ({ page }) => {
  await goToAddEditTab(page)

  // Select GHLCMP for editing
  await searchAndSelectProgramme(page, 'GHLCMP', 'GHLCMP')

  // After selection the form switches to edit mode and goes to step "contact".
  // The mode indicator in the breadcrumb bar should name the programme.
  await expect(page.locator('text=Editing: GHLCMP')).toBeVisible({ timeout: 5000 })

  // Fill minimum required contact fields so Continue is enabled
  await fillContactStep(page)

  // Proceed to the "Programme basics" step
  const continueBtn = page.getByRole('button', { name: /Continue/i })
  await expect(continueBtn).toBeEnabled({ timeout: 3000 })
  await continueBtn.click()

  // On step "basics" the first text input is "Programme name"
  // It is rendered as <input type="text"> with value pre-populated from the programme
  const programmeNameInput = page.locator('input[type="text"]').first()
  await expect(programmeNameInput).toHaveValue('GHLCMP', { timeout: 5000 })

  // The CountrySelect input should show "Canada" (GHLCMP country: CAN)
  const countryInput = page.locator('input[placeholder="Type country name…"]')
  await expect(countryInput).toHaveValue(/Canada/i, { timeout: 5000 })

  // Must NOT show USA / West Coast data — this is the regression check
  await expect(countryInput).not.toHaveValue(/United States/i)
  await expect(programmeNameInput).not.toHaveValue(/West Coast/i)

  // The start date should contain 1990 (GHLCMP start_date: 1990-01-01)
  const startDateInput = page.locator('input[type="date"]').first()
  await expect(startDateInput).toHaveValue(/1990/, { timeout: 5000 })
})

test('editing West Coast Groundfish pre-populates its data', async ({ page }) => {
  await goToAddEditTab(page)

  // Select the West Coast Groundfish programme for editing
  await searchAndSelectProgramme(
    page,
    'West Coast',
    'West Coast Groundfish Electronic Monitoring Program'
  )

  // The mode indicator should name the correct programme
  await expect(
    page.locator('text=Editing: West Coast Groundfish Electronic Monitoring Program')
  ).toBeVisible({ timeout: 5000 })

  // Fill minimum required contact fields so Continue is enabled
  await fillContactStep(page)

  // Proceed to the "Programme basics" step
  const continueBtn = page.getByRole('button', { name: /Continue/i })
  await expect(continueBtn).toBeEnabled({ timeout: 3000 })
  await continueBtn.click()

  // The programme name input should be pre-populated with the West Coast programme name
  const programmeNameInput = page.locator('input[type="text"]').first()
  await expect(programmeNameInput).toHaveValue(
    /West Coast Groundfish/i,
    { timeout: 5000 }
  )

  // The CountrySelect input should show "United States" (country_iso: USA)
  const countryInput = page.locator('input[placeholder="Type country name…"]')
  await expect(countryInput).toHaveValue(/United States/i, { timeout: 5000 })

  // Must NOT show Canada — proves the correct programme was loaded
  await expect(countryInput).not.toHaveValue(/Canada/i)
  await expect(programmeNameInput).not.toHaveValue(/GHLCMP/i)
})
