import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readPublicFile = (path) => readFile(new URL(`../public/${path}`, import.meta.url), "utf8");
const readRepoFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

describe("H5 content", () => {
  it("offers theory mode and simulation tracking with compliant wording", async () => {
    const [html, app] = await Promise.all([
      readPublicFile("index.html"),
      readPublicFile("app.js"),
    ]);

    assert.match(html, /value="theory"/);
    assert.match(html, /分层理论模型/);
    assert.match(app, /模拟命中分析/);
    assert.doesNotMatch(`${html}\n${app}`, /下注|立即购彩|提高中奖率|兑奖/);
  });

  it("hides ad unlock UI while keeping voluntary appreciation copy", async () => {
    const [html, app] = await Promise.all([
      readPublicFile("index.html"),
      readPublicFile("app.js"),
    ]);

    assert.doesNotMatch(`${html}\n${app}`, /模拟观看广告|看广告|ad-unlock|recordAdUnlock/);
    assert.doesNotMatch(`${html}\n${app}`, /今日剩余|次数已用完|quota-panel|getRemainingGenerations|useGeneration/);
    assert.match(html, /不限次数/);
    assert.match(html, /赞赏支持/);
    assert.match(html, /赞赏不增加生成次数/);
  });

  it("offers a fixed double color ball and super lotto ticket check flow", async () => {
    const [html, app] = await Promise.all([
      readPublicFile("index.html"),
      readPublicFile("app.js"),
    ]);

    assert.match(html, /拍照验票/);
    assert.match(html, /accept="image\/\*"/);
    assert.match(html, /capture="environment"/);
    assert.match(html, /data-check-type="ssq"/);
    assert.match(html, /data-check-type="dlt"/);
    assert.doesNotMatch(html, /data-check-type="pl3"|data-check-type="qlc"/);
    assert.match(app, /checkTicketByIssue/);
  });

  it("renders generated history as a compact analysis list", async () => {
    const [html, app, css] = await Promise.all([
      readPublicFile("index.html"),
      readPublicFile("app.js"),
      readPublicFile("styles.css"),
    ]);

    assert.match(html, /仅供数据分析/);
    assert.match(app, /renderHistoryRecord/);
    assert.doesNotMatch(app, /renderTicket\\(item, true\\)/);
    assert.match(css, /max-height: 360px/);
    assert.match(css, /overflow-y: auto/);
  });

  it("declares PWA install assets and scheduled data update workflow", async () => {
    const [html, app, manifest, serviceWorker, workflow] = await Promise.all([
      readPublicFile("index.html"),
      readPublicFile("app.js"),
      readPublicFile("manifest.webmanifest"),
      readPublicFile("service-worker.js"),
      readRepoFile(".github/workflows/update-lottery-data.yml"),
    ]);

    const parsedManifest = JSON.parse(manifest);

    assert.match(html, /rel="manifest"/);
    assert.match(html, /apple-mobile-web-app-capable/);
    assert.equal(parsedManifest.name, "大乐透/双色球智能选号助手");
    assert.match(app, /serviceWorker.register/);
    assert.match(serviceWorker, /CACHE_NAME/);
    assert.match(workflow, /cron:/);
    assert.match(workflow, /npm run import:ssq/);
    assert.match(workflow, /npm run import:dlt/);
  });
});
