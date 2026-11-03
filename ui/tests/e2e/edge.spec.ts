import { expect, test } from '@playwright/test'

test('undo failure lists every affected file', async ({ page }) => {
  await page.goto('/?fixture=edge-undo-failed&speed=0')
  await page.getByTestId('right-pane').getByRole('button', { name: '变更' }).click()
  await page.getByTestId('undo-button').click()
  await page.getByRole('button', { name: '确认撤销' }).click()
  await expect(page.getByTestId('undo-failure-list').locator('li')).toHaveCount(2)
})

test('redo on a pruned turn says it cannot redo', async ({ page }) => {
  await page.goto('/?fixture=edge-redo-pruned&speed=0')
  await page.getByTestId('right-pane').getByRole('button', { name: '变更' }).click()
  await page.getByTestId('redo-button').click()
  await expect(page.getByTestId('undo-pruned')).toContainText('无法重做')
})

test('checkpoint gap raises a banner', async ({ page }) => {
  await page.goto('/?fixture=edge-checkpoint-gap&speed=0')
  await page.getByTestId('right-pane').getByRole('button', { name: '检查点' }).click()
  await expect(page.getByTestId('checkpoint-gap-banner')).toContainText('空洞')
})

test('a denied approval stays in the timeline', async ({ page }) => {
  await page.goto('/?fixture=edge-approval-denied&speed=0')
  await expect(page.getByTestId('timeline-entry-approval')).toContainText('已拒绝')
})
