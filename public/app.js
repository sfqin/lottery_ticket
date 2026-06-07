import { APPRECIATION_NOTICE, REQUIRED_NOTICES } from "./src/compliance.mjs?v=20260607-bottom-polish";
import { analyzeDraws, getLatestDraw } from "./src/drawAnalysis.mjs?v=20260607-bottom-polish";
import { createEntitlementState } from "./src/entitlements.mjs?v=20260607-bottom-polish";
import { formatTicket, getLotteryType } from "./src/lotteryCatalog.mjs?v=20260607-bottom-polish";
import { generateTicket } from "./src/numberGenerator.mjs?v=20260607-bottom-polish";
import { getPrizeRuleSummary } from "./src/prizeRules.mjs?v=20260607-bottom-polish";
import { buildTierWeightedTheory } from "./src/recommendationTheory.mjs?v=20260607-bottom-polish";
import { SAMPLE_DRAWS } from "./src/sampleDraws.mjs?v=20260607-bottom-polish";
import { parseDltCsv } from "./src/dltHistory.mjs?v=20260607-bottom-polish";
import { parseSsqCsv } from "./src/ssqHistory.mjs?v=20260607-bottom-polish";
import { createSimulationRecord, summarizeSimulationRecords } from "./src/simulationTracker.mjs?v=20260607-bottom-polish";
import { checkTicketByIssue, checkTicketLinesByIssue } from "./src/ticketCheck.mjs?v=20260607-bottom-polish";

const today = new Date().toISOString().slice(0, 10);
const state = {
  typeId: "ssq",
  strategy: "balanced",
  generateCount: 5,
  entitlement: loadEntitlement(),
  history: loadHistory(),
  checkTypeId: "ssq",
  checkImageUrl: "",
  checkValues: {
    ssq: {},
    dlt: {},
  },
  checkResult: null,
  appreciationMethod: "wechat",
  checkText: {
    ssq: "",
    dlt: "",
  },
  selectedDrawIssue: {
    ssq: "",
    dlt: "",
  },
  selectedDrawTouched: {
    ssq: false,
    dlt: false,
  },
  draws: SAMPLE_DRAWS,
  dataNotice: {
    dlt: "正在加载大乐透历史开奖数据...",
    ssq: "正在加载双色球历史开奖数据...",
  },
};

const elements = {
  notices: document.querySelector("#required-notices"),
  remaining: document.querySelector("#remaining-count"),
  typeButtons: [...document.querySelectorAll("[data-type]")],
  strategy: document.querySelector("#strategy-select"),
  generateCount: document.querySelector("#generate-count-select"),
  generate: document.querySelector("#generate-button"),
  ticket: document.querySelector("#ticket-card"),
  latestIssue: document.querySelector("#latest-issue"),
  latestDraw: document.querySelector("#latest-draw"),
  analysis: document.querySelector("#analysis-summary"),
  redeemableDraws: document.querySelector("#redeemable-draw-list"),
  historyCount: document.querySelector("#history-count"),
  history: document.querySelector("#history-list"),
  checkTypeButtons: [...document.querySelectorAll("[data-check-type]")],
  checkPhoto: document.querySelector("#ticket-photo-input"),
  checkPreview: document.querySelector("#ticket-photo-preview"),
  checkIssue: document.querySelector("#ticket-issue-input"),
  checkFields: document.querySelector("#ticket-check-fields"),
  checkLines: document.querySelector("#ticket-lines-input"),
  checkButton: document.querySelector("#check-ticket-button"),
  checkResult: document.querySelector("#ticket-check-result"),
  prizeRules: document.querySelector("#prize-rules"),
  appreciationNotice: document.querySelector("#appreciation-notice"),
  appreciationMethods: [...document.querySelectorAll("[data-appreciation-method]")],
  appreciationCodes: [...document.querySelectorAll("[data-appreciation-code]")],
};

initialize();

function initialize() {
  registerServiceWorker();
  elements.notices.innerHTML = REQUIRED_NOTICES.map((notice) => `<span>${escapeHtml(notice)}</span>`).join("");
  elements.appreciationNotice.textContent = APPRECIATION_NOTICE;

  elements.typeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.typeId = button.dataset.type;
      render();
    });
  });

  elements.strategy.addEventListener("change", () => {
    state.strategy = elements.strategy.value;
  });

  elements.generateCount.addEventListener("change", () => {
    state.generateCount = Number(elements.generateCount.value) || 5;
  });

  elements.redeemableDraws.addEventListener("change", (event) => {
    if (event.target.id === "redeemable-issue-select") {
      state.selectedDrawIssue[state.typeId] = event.target.value;
      state.selectedDrawTouched[state.typeId] = true;
      renderAnalysis();
    }
  });

  elements.checkTypeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.checkTypeId = button.dataset.checkType;
      state.checkResult = null;
      renderTicketCheck();
    });
  });

  elements.checkPhoto.addEventListener("change", () => {
    const file = elements.checkPhoto.files?.[0];
    if (state.checkImageUrl) {
      URL.revokeObjectURL(state.checkImageUrl);
      state.checkImageUrl = "";
    }

    if (file) {
      state.checkImageUrl = URL.createObjectURL(file);
    }

    renderTicketCheck();
  });

  elements.checkFields.addEventListener("input", (event) => {
    const groupName = event.target.dataset.checkGroup;
    if (groupName) {
      state.checkValues[state.checkTypeId][groupName] = event.target.value;
    }
  });

  elements.checkLines.addEventListener("input", () => {
    state.checkText[state.checkTypeId] = elements.checkLines.value;
  });

  elements.appreciationMethods.forEach((button) => {
    button.addEventListener("click", () => {
      state.appreciationMethod = button.dataset.appreciationMethod;
      renderAppreciation();
    });
  });

  elements.generate.addEventListener("click", () => {
    const typeDraws = state.draws.filter((draw) => draw.type === state.typeId);
    const latestDraw = getLatestDraw(state.draws, state.typeId);
    const generated = Array.from({ length: state.generateCount }, () => {
      const result = generateTicket({
        typeId: state.typeId,
        strategy: state.strategy,
        draws: typeDraws,
      });
      const simulation = latestDraw
        ? createSimulationRecord({ recommendation: result, draw: latestDraw })
        : null;
      return {
        ...result,
        simulation,
        createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      };
    });

    state.history.unshift(...generated);
    state.history = state.history.slice(0, 12);
    persist();
    render(generated);
  });

  elements.checkButton.addEventListener("click", () => {
    try {
      state.checkText[state.checkTypeId] = elements.checkLines.value;
      state.checkResult = checkTicketLinesByIssue({
        typeId: state.checkTypeId,
        issue: elements.checkIssue.value,
        ticketText: state.checkText[state.checkTypeId],
        draws: state.draws,
      });
    } catch (error) {
      state.checkResult = {
        error: true,
        summary: error.message,
        complianceNote: "查询结果仅供参考，实际开奖与实体票信息以官方公告为准。",
      };
    }

    renderTicketCheck();
  });

  render();
  loadHistoricalDraws();
}

async function loadHistoricalDraws() {
  const loadedDraws = [];
  const fallbackDraws = [];

  try {
    const ssqDraws = await loadCsvDraws("data/ssq-history.csv", parseSsqCsv);
    loadedDraws.push(...ssqDraws);
    state.dataNotice.ssq = `已加载 ${ssqDraws.length} 期双色球历史数据。`;
  } catch (error) {
    fallbackDraws.push(...SAMPLE_DRAWS.filter((draw) => draw.type === "ssq"));
    state.dataNotice.ssq = "双色球历史数据加载失败，当前使用样例数据。";
    console.warn(error);
  }

  try {
    const dltDraws = await loadCsvDraws("data/dlt-history.csv", parseDltCsv);
    loadedDraws.push(...dltDraws);
    state.dataNotice.dlt = `已加载 ${dltDraws.length} 期大乐透历史数据。`;
  } catch (error) {
    fallbackDraws.push(...SAMPLE_DRAWS.filter((draw) => draw.type === "dlt"));
    state.dataNotice.dlt = "大乐透历史数据加载失败，当前使用样例数据。";
    console.warn(error);
  }

  state.draws = [...loadedDraws, ...fallbackDraws];
  render();
}

async function loadCsvDraws(path, parser) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${path} request failed: ${response.status}`);
  }
  return parser(await response.text());
}

function render(latestGenerated = null) {
  elements.remaining.textContent = "不限次数";
  elements.generate.disabled = false;
  elements.generateCount.value = String(state.generateCount);

  elements.typeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.type === state.typeId);
  });

  renderAnalysis();
  renderHistory();
  renderTicketCheck();
  renderAppreciation();

  if (latestGenerated) {
    elements.ticket.innerHTML = Array.isArray(latestGenerated)
      ? renderGeneratedBatch(latestGenerated)
      : renderTicket(latestGenerated);
  } else if (state.history.length) {
    elements.ticket.innerHTML = renderTicket(state.history[0]);
  } else {
    elements.ticket.innerHTML = `<p class="muted">选择彩种和模式后，点击生成号码。</p>`;
  }
}

function renderAnalysis() {
  const analysis = analyzeDraws(state.draws, state.typeId);
  const type = getLotteryType(state.typeId);
  const typeDraws = state.draws.filter((draw) => draw.type === state.typeId);
  const redeemableDraws = getRedeemableDraws(typeDraws, new Date());
  const latest = getSelectedDraw(state.typeId, redeemableDraws, analysis.latest);
  const theory = buildTierWeightedTheory({ typeId: state.typeId, draws: typeDraws });
  const simulationSummary = summarizeSimulationRecords(
    state.typeId,
    state.history.map((item) => item.simulation).filter(Boolean),
  );

  elements.latestIssue.textContent = latest ? `${latest.issue} 期` : "暂无数据";
  elements.latestDraw.innerHTML = latest
    ? `
      <strong>${escapeHtml(type.name)} ${escapeHtml(latest.issue)} 期 · ${escapeHtml(latest.date)}</strong>
      ${renderBalls(formatTicket(state.typeId, latest), type)}
      <p class="fine-print">${escapeHtml(state.dataNotice[state.typeId])}</p>
    `
    : `<p class="muted">暂无开奖数据。</p>`;

  const firstGroup = Object.keys(type.groups)[0];
  const hot = analysis.hot[firstGroup].slice(0, 5).map((item) => pad(item.number)).join(" ");
  const cold = analysis.cold[firstGroup].slice(0, 5).map((item) => pad(item.number)).join(" ");
  const miss = analysis.omissions[firstGroup].slice(0, 5).map((item) => `${pad(item.number)}(${item.miss})`).join(" ");

  elements.analysis.innerHTML = `
    <details class="compact-details">
      <summary>热号 / 冷号 / 遗漏 / 分层理论</summary>
      <div class="stat-grid">
        <div class="stat"><b>热号</b><span>${hot}</span></div>
        <div class="stat"><b>冷号</b><span>${cold}</span></div>
        <div class="stat"><b>遗漏</b><span>${miss}</span></div>
        <div class="stat"><b>奇偶累计</b><span>${analysis.parity[firstGroup].odd}:${analysis.parity[firstGroup].even}</span></div>
      </div>
      ${renderTheorySummary(theory)}
      ${renderSimulationSummary(simulationSummary, type)}
    </details>
  `;
  elements.redeemableDraws.innerHTML = renderRedeemableDraws(state.typeId, redeemableDraws, latest);
}

function renderHistory() {
  elements.historyCount.textContent = `${state.history.length} 组`;
  elements.history.innerHTML = state.history.length
    ? `<ol class="history-list-items">${state.history.slice(0, 1).map(renderHistoryRecord).join("")}</ol>`
    : `<p class="muted">生成后的号码会保存在本次浏览记录中。</p>`;
}

function renderHistoryRecord(item) {
  const type = getLotteryType(item.typeId);
  const simulation = item.simulation?.evaluation;
  const simulationText = simulation
    ? `${simulation.tierName} · ${simulation.matchText}`
    : "待复盘";

  return `
    <li class="history-record">
      <div class="history-record__meta">
        <div>
          <strong>${escapeHtml(type.shortName)} · ${labelStrategy(item.strategy)}</strong>
          <span>${escapeHtml(item.createdAt ?? "")}</span>
        </div>
        <em>${escapeHtml(simulationText)}</em>
      </div>
      <div class="history-record__balls">
        ${renderBalls(formatTicket(item.typeId, item.ticket), type)}
      </div>
      <details class="compact-details">
        <summary class="detail-summary">查看生成理由和复盘</summary>
        <p>${escapeHtml(item.explanation.summary)}</p>
        <ul class="compact-list">
          ${item.explanation.items.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}
        </ul>
        ${item.simulation ? renderSimulation(item.simulation, false) : ""}
        <p class="fine-print">${escapeHtml(formatTicketText(item.typeId, item.ticket))}</p>
      </details>
    </li>
  `;
}

function renderAppreciation() {
  elements.appreciationMethods.forEach((button) => {
    const active = button.dataset.appreciationMethod === state.appreciationMethod;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  elements.appreciationCodes.forEach((code) => {
    code.classList.toggle("is-active", code.dataset.appreciationCode === state.appreciationMethod);
  });
}

function renderTicketCheck() {
  const type = getLotteryType(state.checkTypeId);

  elements.checkTypeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.checkType === state.checkTypeId);
  });

  elements.checkPreview.innerHTML = state.checkImageUrl
    ? `<img alt="彩票票面预览" src="${escapeHtml(state.checkImageUrl)}" />`
    : `<p class="muted">尚未选择票面照片。</p>`;

  elements.checkFields.innerHTML = `<p class="fine-print">可从票面逐行录入多注号码；照片暂仅本机预览，不上传识别。</p>`;
  elements.checkLines.value = state.checkText[state.checkTypeId];
  elements.checkLines.placeholder =
    state.checkTypeId === "ssq"
      ? "每行一注，如：08 13 17 21 24 29 + 03"
      : "每行一注，如：02 08 13 21 30 + 04 11";

  elements.checkResult.innerHTML = state.checkResult
    ? renderCheckResult(state.checkResult)
    : `<p class="muted">选择彩种并填写期号、多注号码后，可查询对应期开奖与奖级。</p>`;
  elements.prizeRules.innerHTML = renderPrizeRules(getPrizeRuleSummary(state.checkTypeId));
}

function renderCheckResult(result) {
  if (result.error || !result.found) {
    return `
      <b>${result.error ? "查询信息有误" : "未找到对应期号"}</b>
      <p>${escapeHtml(result.summary)}</p>
      <p class="fine-print">${escapeHtml(result.complianceNote)}</p>
    `;
  }

  const type = getLotteryType(result.typeId);
  if (Array.isArray(result.lines)) {
    return `
      <b>${escapeHtml(type.shortName)} ${escapeHtml(result.issue)} 期 · ${escapeHtml(result.date ?? "")}</b>
      <p>${escapeHtml(result.summary)}</p>
      ${renderBalls(formatTicket(result.typeId, result.draw), type)}
      <div class="checked-lines">
        ${result.lines.map((line) => renderCheckedLine(result.typeId, line)).join("")}
      </div>
      <p class="fine-print">${escapeHtml(result.complianceNote)}</p>
    `;
  }

  return `
    <b>${escapeHtml(type.shortName)} ${escapeHtml(result.issue)} 期</b>
    <p>${escapeHtml(result.summary)}</p>
    ${renderBalls(formatTicket(result.typeId, result.draw), type)}
    <p class="fine-print">${escapeHtml(result.complianceNote)}</p>
  `;
}

function renderCheckedLine(typeId, line) {
  const type = getLotteryType(typeId);
  const formatted = formatTicket(typeId, line.ticket);
  const hitClass = line.evaluation.hit ? " check-line--hit" : "";
  return `
    <div class="check-line${hitClass}">
      <div class="check-line__meta">
        <b>第 ${line.index} 注 · ${escapeHtml(line.evaluation.tierName)}</b>
        <span>${escapeHtml(line.evaluation.matchText)}</span>
      </div>
      ${renderBalls(formatted, type, line.matchedNumbers)}
    </div>
  `;
}

function renderTicket(result, compact = false) {
  const type = getLotteryType(result.typeId);
  const formatted = formatTicket(result.typeId, result.ticket);
  return `
    <strong>${escapeHtml(type.shortName)} · ${labelStrategy(result.strategy)}</strong>
    ${renderBalls(formatted, type)}
    <p class="positive-message">${escapeHtml(result.message)}</p>
    <details class="compact-details">
      <summary>展开生成理由和模拟命中分析</summary>
      <p>${escapeHtml(result.explanation.summary)}</p>
      <ul class="explain-list">
        ${result.explanation.items.slice(0, compact ? 2 : 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
      ${result.simulation ? renderSimulation(result.simulation, compact) : ""}
      <p class="fine-print">${escapeHtml(result.complianceNote)}</p>
    </details>
  `;
}

function renderGeneratedBatch(results) {
  return `
    <div class="generated-batch">
      ${results.map((item) => `<article class="generated-item">${renderTicket(item, true)}</article>`).join("")}
    </div>
  `;
}

function renderTheorySummary(theory) {
  return `
    <div class="theory-summary">
      <b>分层理论</b>
      <p>${escapeHtml(theory.summary)}</p>
      <ul class="compact-list">
        ${theory.methodNotes.slice(0, 2).map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
      </ul>
      <p class="fine-print">${escapeHtml(theory.complianceNote)}</p>
    </div>
  `;
}

function renderSimulationSummary(summary, type) {
  const groupNames = Object.keys(type.groups);
  const primaryLabel = type.groups[groupNames[0]].label;
  const secondaryLabel = type.groups[groupNames[1]].label;
  return `
    <div class="tracking-summary">
      <b>模拟复盘</b>
      <div class="tracking-line">
        <span>记录 ${summary.total} 组</span>
        <span>命中奖级 ${summary.hitCount} 组</span>
        <span>最佳 ${escapeHtml(summary.bestTierName)}</span>
      </div>
      <p>${escapeHtml(primaryLabel)}平均匹配 ${summary.averagePrimaryMatches} 个，${escapeHtml(secondaryLabel)}平均匹配 ${summary.averageSecondaryMatches} 个。</p>
      <p class="fine-print">${escapeHtml(summary.lesson)}</p>
    </div>
  `;
}

function renderSimulation(record, compact = false) {
  const evaluation = record.evaluation;
  return `
    <div class="simulation-box">
      <b>模拟命中分析</b>
      <span>${escapeHtml(record.issue)} 期 · ${escapeHtml(evaluation.tierName)}</span>
      <p>${escapeHtml(evaluation.matchText)}</p>
      ${compact ? "" : `<p>${escapeHtml(record.lesson)}</p>`}
      ${compact ? "" : `<p class="fine-print">${escapeHtml(record.complianceNote)}</p>`}
    </div>
  `;
}

function renderBalls(formatted, type, matchedNumbers = {}) {
  const balls = Object.entries(type.groups)
    .flatMap(([groupName, rule]) => {
      const matchedSet = new Set(matchedNumbers[groupName] ?? []);
      return formatted[groupName].map((number) => {
        const value = Number(number);
        const matchedClass = matchedSet.has(value) ? " ball--matched" : "";
        return `<span class="ball ${rule.color}${matchedClass}">${number}</span>`;
      });
    })
    .join("");

  return `<div class="ball-row" aria-label="${escapeHtml(type.shortName)}号码">${balls}</div>`;
}

function renderRedeemableDraws(typeId, redeemable, selectedDraw) {
  const type = getLotteryType(typeId);

  if (!redeemable.length) {
    return `<p class="muted">暂无仍在 60 个自然日兑奖有效期内的${escapeHtml(type.shortName)}开奖记录。</p>`;
  }

  return `
    <label class="field draw-selector-field">
      <span>选择可兑奖期号</span>
      <select id="redeemable-issue-select">
        ${redeemable
          .map(
            ({ draw, deadline, daysLeft }) => `
              <option value="${escapeHtml(draw.issue)}" ${draw.issue === selectedDraw?.issue ? "selected" : ""}>
                ${escapeHtml(type.shortName)} ${escapeHtml(draw.issue)} 期 · ${escapeHtml(draw.date ?? "")} 开奖 · ${daysLeft} 天 · 截止 ${formatDate(deadline)}
              </option>
            `,
          )
          .join("")}
      </select>
    </label>
    <p class="fine-print">默认选择最新一期；切换期号后，上方开奖号码同步展示。兑奖有效期按开奖日起 60 个自然日估算，实际以官方公告为准。</p>
  `;
}

function getSelectedDraw(typeId, redeemable, fallbackDraw) {
  const savedIssue = state.selectedDrawIssue[typeId];
  const selected = state.selectedDrawTouched[typeId]
    ? redeemable.find(({ draw }) => draw.issue === savedIssue)?.draw
    : null;
  const latestRedeemable = redeemable[0]?.draw;
  return selected ?? latestRedeemable ?? fallbackDraw;
}

function getRedeemableDraws(draws, now) {
  const todayTime = startOfDay(now).getTime();
  return draws
    .map((draw) => {
      const drawDate = parseDrawDate(draw.date);
      const deadline = addDays(drawDate, 60);
      const daysLeft = Math.ceil((deadline.getTime() - todayTime) / 86400000);
      return { draw, deadline, daysLeft };
    })
    .filter((item) => item.daysLeft >= 0)
    .sort((a, b) => String(b.draw.issue).localeCompare(String(a.draw.issue)))
    .slice(0, 24);
}

function renderPrizeRules(summary) {
  const fixedCount = summary.rows.filter((row) => row.prize !== "浮动奖金").length;
  return `
    <details class="rules-drawer">
      <summary>
        <span>${escapeHtml(summary.title)}</span>
        <small>${summary.rows.length} 个奖级 · ${fixedCount} 个固定奖</small>
      </summary>
      <div class="prize-rule-table">
        ${summary.rows
          .map(
            (row) => `
              <div class="prize-rule-row">
                <b>${escapeHtml(row.name)}</b>
                <span>${escapeHtml(row.conditionText)}</span>
                <strong>${escapeHtml(row.prize)}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
      <p class="fine-print">${escapeHtml(summary.note)}</p>
    </details>
  `;
}

function loadEntitlement() {
  const raw = localStorage.getItem("lottery-entitlement");
  return raw ? JSON.parse(raw) : createEntitlementState(today);
}

function loadHistory() {
  const raw = localStorage.getItem("lottery-history");
  return raw ? JSON.parse(raw) : [];
}

function persist() {
  localStorage.setItem("lottery-entitlement", JSON.stringify(state.entitlement));
  localStorage.setItem("lottery-history", JSON.stringify(state.history));
}

function labelStrategy(strategy) {
  return {
    balanced: "均衡生成",
    random: "随机生成",
    data: "数据参考",
    theory: "分层理论模型",
  }[strategy];
}

function formatTicketText(typeId, ticket) {
  const type = getLotteryType(typeId);
  const formatted = formatTicket(typeId, ticket);
  return Object.entries(type.groups)
    .map(([groupName, rule]) => `${rule.label}:${formatted[groupName].join(" ")}`)
    .join(" / ");
}

function parseDrawDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? startOfDay(new Date()) : date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  }
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
