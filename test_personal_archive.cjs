// Receives temporary graph IDs and signed test identities through stdin.
const { chromium } = require('C:/Users/admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const fixture = JSON.parse(fs.readFileSync(0, 'utf8'));
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.route('https://telegram.org/js/telegram-web-app.js', route => route.fulfill({body: ''}));
    for (let index = 0; index < 2; index++) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(initData => {
        window.Telegram = { WebApp: {
          initData, platform: 'tdesktop', ready() {}, expand() {}, onEvent() {},
          isVersionAtLeast() { return false; }
        }};
      }, fixture.users[index]);
      const other = fixture.ids[1-index];
      const own = fixture.ids[index];
      const response = await page.goto(fixture.base);
      assert(!(await response.text()).includes(own), 'Initial page must contain no private graph data');
      await page.locator(`a.graph-main[href="/view/${own}"]`).waitFor();
      assert.equal(await page.locator(`a[href="/view/${other}"]`).count(), 0);
      await page.locator(`a.graph-main[href="/view/${own}"]`).click();
      await page.locator('#owner-test').waitFor();
      assert.equal(await page.locator('#owner-test').innerText(), `PRIVATE_${index}`);
      const forbidden = await page.request.get(fixture.base + '/graph/' + other);
      assert.equal(forbidden.status(), 404);
      const listing = await page.request.get(fixture.base + '/api/graphs');
      assert.deepEqual(Object.keys((await listing.json()).graphs), [own]);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS: production login, private archive, graph navigation, account switching, foreign access');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
