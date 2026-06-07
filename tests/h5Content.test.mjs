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
    assert.doesNotMatch(`${html}\n${app}`, /下注|立即购彩|提高中奖率|代为兑奖|代领/);
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
    assert.match(html, /zanshang\.png/);
    assert.match(html, /zhifubaozanshang\.png/);
    assert.match(html, /data-appreciation-method="wechat"/);
    assert.match(html, /data-appreciation-code="alipay"/);
    assert.match(html, /赞赏不增加生成次数/);
    assert.doesNotMatch(html, /记录一次模拟赞赏|appreciation-button/);
    assert.match(app, /renderAppreciation/);
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

  it("supports multi-stake ticket checking with winning row and matched-number highlights", async () => {
    const [html, app, css] = await Promise.all([
      readPublicFile("index.html"),
      readPublicFile("app.js"),
      readPublicFile("styles.css"),
    ]);

    assert.match(html, /ticket-lines-input/);
    assert.match(html, /多注号码/);
    assert.match(app, /checkTicketLinesByIssue/);
    assert.match(app, /renderCheckedLine/);
    assert.match(css, /check-line--hit/);
    assert.match(css, /ball--matched/);
  });

  it("shows redeemable draw periods and official prize rule tables", async () => {
    const [html, app] = await Promise.all([
      readPublicFile("index.html"),
      readPublicFile("app.js"),
    ]);

    assert.match(html, /可兑奖期数/);
    assert.match(html, /兑奖有效期/);
    assert.match(app, /renderRedeemableDraws/);
    assert.match(app, /redeemable-issue-select/);
    assert.match(app, /getSelectedDraw/);
    assert.match(app, /getPrizeRuleSummary/);
    assert.match(app, /rules-drawer/);
    assert.match(app, /60 个自然日/);
  });

  it("renders generated history as a compact analysis list", async () => {
    const [html, app, css] = await Promise.all([
      readPublicFile("index.html"),
      readPublicFile("app.js"),
      readPublicFile("styles.css"),
    ]);

    assert.match(html, /仅供数据分析/);
    assert.match(html, /往期分析/);
    assert.match(html, /support-dock/);
    assert.match(app, /renderHistoryRecord/);
    assert.match(app, /slice\(0, 1\)/);
    assert.match(app, /查看生成理由和复盘/);
    assert.match(app, /history-record__balls/);
    assert.match(css, /generated-batch/);
    assert.match(css, /support-dock/);
    assert.match(css, /appreciation-code--primary/);
    assert.match(css, /appreciation-methods/);
    assert.match(css, /flex-wrap: nowrap/);
  });

  it("uses a compact high-frequency layout with scan check first and five default picks", async () => {
    const [html, app, css] = await Promise.all([
      readPublicFile("index.html"),
      readPublicFile("app.js"),
      readPublicFile("styles.css"),
    ]);

    assert.match(html, /workspace-grid/);
    assert.ok(html.indexOf("拍照验票") < html.indexOf("<span>选号</span>"));
    assert.match(html, /id="generate-count-select"/);
    assert.match(html, /<option value="5" selected>5 组<\/option>/);
    assert.match(app, /generateCount: 5/);
    assert.match(app, /renderGeneratedBatch/);
    assert.match(app, /切换期号后，上方开奖号码同步展示/);
    assert.match(app, /热号 \/ 冷号 \/ 遗漏 \/ 分层理论/);
    assert.match(app, /flatMap/);
    assert.match(css, /grid-template-columns: minmax\(280px, 0\.95fr\) minmax\(300px, 1fr\) minmax\(300px, 0\.95fr\)/);
    assert.match(css, /draw-selector-field/);
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
