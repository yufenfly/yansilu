import test from "node:test";
import assert from "node:assert/strict";
import { optionalPlaywright, startPrototypeStack, waitFor } from "./prototype-copy-test-helpers.mjs";

test("prototype smart notes demo walkthrough uses readable title actions", async (t) => {
  if (process.env.RUN_BROWSER_E2E !== "1") {
    t.skip("Set RUN_BROWSER_E2E=1 to enable browser e2e in local runs.");
    return;
  }

  const playwright = await optionalPlaywright(t);
  if (!playwright) return;

  const stack = await startPrototypeStack(t, playwright);
  if (!stack) return;
  const { page, webBase } = stack;

  await page.goto(`${webBase}/prototype?demo=smart-notes-product-thinking`, { waitUntil: "networkidle" });

  await waitFor(async () => {
    const statusText = await page.locator("#statusText").textContent();
    assert.match(String(statusText || ""), /Smart Notes/);
    assert.doesNotMatch(String(statusText || ""), /\b(?:PN-SN|WP-SN|IC-SN)-/);
  }, 15000);

  await waitFor(async () => {
    const walkthroughText = await page.locator("[data-smart-notes-demo-guide]").textContent();
    assert.match(String(walkthroughText || ""), /从记录到写作/);
    assert.match(String(walkthroughText || ""), /第 1 \/ 3 步/);
    assert.match(String(walkthroughText || ""), /看看当前观点怎样形成/);
    assert.match(String(walkthroughText || ""), /打开第 1 步笔记/);
    assert.doesNotMatch(String(walkthroughText || ""), /打开“写作不是最后一步”/);
    assert.doesNotMatch(String(walkthroughText || ""), /\b(?:PN-SN|WP-SN|IC-SN)-/);
    assert.doesNotMatch(String(walkthroughText || ""), /打开写作中心/);
  }, 15000);
});
