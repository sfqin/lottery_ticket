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

  it("offers a fixed double color ball and super lotto manual ticket check flow", async () => {
    const [html, app, css] = await Promise.all([
      readPublicFile("index.html"),
      readPublicFile("app.js"),
      readPublicFile("styles.css"),
    ]);

    assert.match(html, /手动验票/);
    assert.match(html, /ticket-issue-select/);
    assert.match(html, /ticket-add-row-button/);
    assert.match(html, /data-check-type="ssq"/);
    assert.match(html, /data-check-type="dlt"/);
    assert.doesNotMatch(html, /data-check-type="pl3"|data-check-type="qlc"/);
    assert.doesNotMatch(`${html}\n${app}`, /选择可兑奖期号，逐行输入|选择彩种和模式后|先选择开奖期号/);
    assert.doesNotMatch(`${html}\n${app}`, /accept="image\/\*"|capture="environment"|TESSERACT_CDN_URL|recognizeTicketPhoto/);
    assert.match(app, /renderCheckRows/);
    assert.match(app, /data-check-number/);
    assert.match(app, /focusNextCheckInput/);
    assert.match(css, /border-width: 2px/);
    assert.match(css, /check-result\.is-empty/);
  });

  it("supports multi-stake ticket checking with winning row and matched-number highlights", async () => {
    const [html, app, css] = await Promise.all([
      readPublicFile("index.html"),
      readPublicFile("app.js"),
      readPublicFile("styles.css"),
    ]);

    assert.match(html, /ticket-add-row-button/);
    assert.match(app, /buildTicketTextFromRows/);
    assert.match(app, /checkTicketLinesByIssue/);
    assert.match(app, /renderCheckedLine/);
    assert.match(app, /renderCheckedBalls/);
    assert.match(app, /formatPrizeAmount/);
    assert.match(app, /line\.evaluation\.prizeLabel/);
    assert.match(app, /class="prize-amount"/);
    assert.match(app, /formatCheckSummary/);
    assert.match(app, /formatCompactMatchText/);
    const checkResultRenderer = app.slice(
      app.indexOf("function renderCheckResult"),
      app.indexOf("function renderCheckedLine"),
    );
    assert.equal(checkResultRenderer.includes("result.complianceNote"), false);
    assert.match(css, /check-line--hit/);
    assert.match(css, /check-ball--matched/);
    assert.match(css, /check-summary/);
    assert.match(css, /color: #b7791f/);
  });

  it("keeps mobile manual check controls from triggering iOS input zoom", async () => {
    const [app, css] = await Promise.all([
      readPublicFile("app.js"),
      readPublicFile("styles.css"),
    ]);

    assert.doesNotMatch(app, /renderTicketCheck\(\{ focusLastRow: true \}\)/);
    assert.match(css, /font-size: 16px/);
    assert.match(css, /\.number-box \{[\s\S]*font-size: 16px/);
    assert.match(css, /\.draw-selector-field select \{[\s\S]*font-size: 16px/);
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
    assert.match(app, /formatDrawOptionLabel/);
    assert.match(app, /formatSlashDate/);
    assert.doesNotMatch(app, /期，\$\{escapeHtml\(draw\.date/);
    assert.match(app, /getRedeemableDraws/);
    assert.match(app, /getSelectedDraw/);
    assert.match(app, /getPrizeRuleSummary/);
    assert.match(app, /rules-drawer/);
    assert.match(app, /renderPrizeCondition/);
    assert.match(app, /60 个自然日/);
  });

  it("renders the strategy arena overview with expandable per-strategy detail", async () => {
    const [html, app, css] = await Promise.all([
      readPublicFile("index.html"),
      readPublicFile("app.js"),
      readPublicFile("styles.css"),
    ]);

    assert.match(html, /策略擂台/);
    assert.match(html, /5 策略 · 每策略 5 注/);
    assert.match(html, /data-arena-type="ssq"/);
    assert.match(html, /data-arena-type="dlt"/);
    assert.match(html, /id="arena-list"/);
    assert.doesNotMatch(html, /往期分析/);
    assert.match(app, /renderArena/);
    assert.match(app, /summarizeArena/);
    assert.match(app, /renderArenaStrategyDetail/);
    assert.match(app, /loadArenaEntries/);
    assert.doesNotMatch(app, /renderHistoryRecord/);
    assert.match(css, /generated-batch/);
    assert.match(css, /support-dock/);
    assert.match(css, /arena-overview/);
    assert.match(css, /appreciation-code--primary/);
    assert.match(css, /appreciation-methods/);
    assert.match(css, /flex-wrap: nowrap/);
  });

  it("uses a compact high-frequency layout with manual check first and five default picks", async () => {
    const [html, app, css] = await Promise.all([
      readPublicFile("index.html"),
      readPublicFile("app.js"),
      readPublicFile("styles.css"),
    ]);

    assert.match(html, /workspace-grid/);
    assert.ok(html.indexOf("手动验票") < html.indexOf("<span>选号</span>"));
    assert.match(html, /id="generate-count-select"/);
    assert.match(html, /<option value="5" selected>5 组<\/option>/);
    assert.match(app, /generateCount: 5/);
    assert.match(app, /renderGeneratedBatch/);
    assert.match(html, /data-analysis-type="ssq"/);
    assert.match(html, /data-analysis-type="dlt"/);
    assert.match(app, /analysisTypeId: "ssq"/);
    assert.match(app, /state\.analysisTypeId/);
    assert.match(app, /切换期号后，上方开奖号码同步展示/);
    assert.match(app, /热号 \/ 冷号 \/ 遗漏 \/ 分层理论/);
    assert.match(app, /flatMap/);
    assert.match(css, /grid-template-columns: minmax\(280px, 0\.95fr\) minmax\(300px, 1fr\) minmax\(300px, 0\.95fr\)/);
    assert.match(css, /draw-selector-field/);
  });

  it("defaults number generation to the latest-100-draw trend reference mode", async () => {
    const [html, app, generator] = await Promise.all([
      readPublicFile("index.html"),
      readPublicFile("app.js"),
      readRepoFile("src/numberGenerator.mjs"),
    ]);

    assert.match(html, /<option value="trend" selected>趋势参考<\/option>/);
    assert.match(app, /strategy: "trend"/);
    assert.match(app, /trend: "趋势参考"/);
    assert.match(generator, /最近 100 期/);
  });

  it("supports copying the current generated batch in a compact text format", async () => {
    const [html, app, css] = await Promise.all([
      readPublicFile("index.html"),
      readPublicFile("app.js"),
      readPublicFile("styles.css"),
    ]);

    assert.match(app, /latestGeneratedBatch/);
    assert.match(app, /copyGeneratedBatch/);
    assert.match(app, /formatGeneratedBatchForCopy/);
    assert.match(app, /formatGeneratedLineForCopy/);
    assert.match(app, /formatChineseOrdinal/);
    assert.match(app, /navigator\.clipboard/);
    assert.match(app, /"零", "一", "二"/);
    assert.match(app, /groups\.join\("   "\)/);
    assert.match(app, /data-copy-generated/);
    assert.match(css, /batch-copy/);
    assert.doesNotMatch(html, /data-copy-generated/);
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
