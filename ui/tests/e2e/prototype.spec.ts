import { expect, test } from '@playwright/test'

test('prototype modules are reachable from the nav', async ({ page }) => {
  await page.goto('/?fixture=organize-v01&speed=0')
  await page.getByTestId('module-experts').click()
  await expect(page.getByTestId('experts-page')).toBeVisible()
  await page.getByTestId('module-skills').click()
  await expect(page.getByTestId('skills-page')).toBeVisible()
  await page.getByTestId('module-connectors').click()
  await expect(page.getByTestId('connectors-page')).toBeVisible()
  await page.getByTestId('module-automation').click()
  await expect(page.getByTestId('automation-page')).toBeVisible()
  await page.getByTestId('module-data').click()
  await expect(page.getByTestId('data-page')).toBeVisible()
  await page.getByTestId('module-settings').click()
  await expect(page.getByTestId('settings-page')).toBeVisible()
  await page.getByTestId('module-work').click()
  await expect(page.getByTestId('shell')).toBeVisible()
})
