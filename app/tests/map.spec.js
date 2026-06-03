import { test, expect } from '@playwright/test'

// The status bar sits at absolute bottom-center of the MapView container.
// Its text cycles through: 'Initialising map…' → 'Loading basemap…' →
// 'Map loaded — fetching programmes…' → 'Fetching programmes…' →
// '<N> programmes across <M> countr(y|ies)'
// We wait for the final settled state before asserting.

const STATUS_BAR = '.absolute.bottom-8 div'        // inner div inside the positioned wrapper
const FILTERS_TOGGLE = 'button:has-text("Filters")' // matches both ◀ and ▶ variants
const FILTER_SIDEBAR_WRAPPER = 'div[style*="width"]' // the transition div whose inline width changes

// Longer timeout: map tile load + GeoJSON fetch + programme fetch can take a few seconds.
const MAP_LOAD_TIMEOUT = 30_000

async function waitForMapReady(page) {
  // Wait until the status bar shows the settled programme count text.
  await expect(
    page.locator(STATUS_BAR).filter({ hasText: /\d+ programmes across \d+ countr/ }),
  ).toBeVisible({ timeout: MAP_LOAD_TIMEOUT })
}

// ---------------------------------------------------------------------------
// Test 1: map tab loads and shows programme count
// ---------------------------------------------------------------------------
test('map tab loads and shows programme count', async ({ page }) => {
  await page.goto('/')

  await waitForMapReady(page)

  const statusBar = page.locator(STATUS_BAR).filter({ hasText: /\d+ programmes across \d+ countr/ })
  await expect(statusBar).toContainText('41 programmes')
})

// ---------------------------------------------------------------------------
// Test 2: filter sidebar toggles open and closed
// ---------------------------------------------------------------------------
test('filter sidebar toggles open and closed', async ({ page }) => {
  await page.goto('/')
  await waitForMapReady(page)

  // The sidebar starts open (filtersOpen = true in App state).
  // Sidebar wrapper: the div in the Map tab with an inline width style.
  // In App.jsx it is rendered as:
  //   <div ... style={{ width: filtersOpen ? '17rem' : 0 }}>
  // We target it via its sibling relationship: it is the first flex child of the
  // map-tab container and has a border-r class.
  const sidebar = page.locator('div.border-r.overflow-hidden.transition-all').first()

  // Confirm it starts visible (width should be ~272px = 17rem).
  await expect(sidebar).toBeVisible()
  const initialBox = await sidebar.boundingBox()
  expect(initialBox?.width).toBeGreaterThan(0)

  // Click the toggle button — it currently reads '◀ Filters' (open → close).
  await page.locator(FILTERS_TOGGLE).click()

  // After closing, the sidebar animates to width: 0 and its content is hidden.
  // We wait for the width to collapse.
  // Inline style goes to "width: 0px" — border-r adds 1px to computed width so we
  // check the style attribute rather than the computed value.
  await expect(sidebar).toHaveAttribute('style', /width:\s*0/, { timeout: 5000 })

  // Toggle button now reads '▶ Filters'. Click to re-open.
  await page.locator(FILTERS_TOGGLE).click()

  // Sidebar should expand back to a non-zero width.
  await expect(async () => {
    const box = await sidebar.boundingBox()
    expect(box?.width).toBeGreaterThan(0)
  }).toPass({ timeout: 5000 })
})

// ---------------------------------------------------------------------------
// Test 3: active filter reduces programme count
// ---------------------------------------------------------------------------
test('active filter reduces programme count', async ({ page }) => {
  await page.goto('/')
  await waitForMapReady(page)

  // Confirm full count is visible before filtering.
  await expect(
    page.locator(STATUS_BAR).filter({ hasText: /41 programmes across/ }),
  ).toBeVisible()

  // The "Active" filter is a TriToggle in FilterPanel.
  // Its structure (from FilterPanel.jsx):
  //   <div class="flex items-center justify-between py-1">
  //     <span class="text-xs text-slate-300">Active</span>
  //     <div ...>  ← button group
  //       <button>All</button>
  //       <button>Yes</button>   ← sets isActive = true
  //       <button>No</button>
  //     </div>
  //   </div>
  // We locate the "Yes" button that is a sibling of the "Active" label span.
  const activeToggleRow = page.locator('div.flex.items-center.justify-between').filter({
    has: page.locator('span', { hasText: 'Active' }),
  })
  const yesButton = activeToggleRow.locator('button', { hasText: 'Yes' })
  await expect(yesButton).toBeVisible()
  await yesButton.click()

  // Wait for the status bar to update. The count should now be less than 41.
  // We poll until the pattern matches and the number is not 41.
  await expect(async () => {
    const text = await page
      .locator(STATUS_BAR)
      .filter({ hasText: /\d+ programmes across/ })
      .textContent()
    const match = text?.match(/(\d+) programmes across/)
    expect(match).not.toBeNull()
    expect(Number(match[1])).toBeLessThan(41)
  }).toPass({ timeout: MAP_LOAD_TIMEOUT })
})
