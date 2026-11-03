import { expect, test } from '@playwright/test'

test('organize replay shows artifacts, 10 moves and undo', async ({ page }) => {
  await page.goto('/?fixture=organize-v01&speed=0')
  await expect(page.getByTestId('artifact-list').locator('li')).toHaveCount(2)
  await page.getByTestId('right-pane').getByRole('button', { name: '变更' }).click()
  await expect(page.getByTestId('change-summary')).toContainText('移动 10')
  await expect(page.getByTestId('undo-button')).toBeEnabled()
})

test('csv replay renders its artifacts', async ({ page }) => {
  await page.goto('/?fixture=csv-sales-analysis-v01&speed=0')
  await expect(page.getByTestId('artifact-list').locator('li')).toHaveCount(3)
  await expect(page.getByTestId('artifact-preview')).toBeVisible()
})

test('research replay shows a long timeline', async ({ page }) => {
  await page.goto('/?fixture=research-cited-report-v01&speed=0')
  await page.getByRole('button', { name: '全部' }).click()
  const rows = page.locator('[data-testid^="timeline-entry-"], [data-testid="tool-group"]')
  expect(await rows.count()).toBeGreaterThan(20)
})
