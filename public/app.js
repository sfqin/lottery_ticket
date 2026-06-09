import { APPRECIATION_NOTICE, REQUIRED_NOTICES } from "./src/compliance.mjs?v=20260609-mobile-polish";
import { analyzeDraws, getLatestDraw } from "./src/drawAnalysis.mjs?v=20260609-mobile-polish";
import { createEntitlementState } from "./src/entitlements.mjs?v=20260609-mobile-polish";
import { formatTicket, getLotteryType } from "./src/lotteryCatalog.mjs?v=20260609-mobile-polish";
import { generateTicket } from "./src/numberGenerator.mjs?v=20260609-mobile-polish";
import { getPrizeRuleSummary } from "./src/prizeRules.mjs?v=20260609-mobile-polish";
import { getRedeemableDraws } from "./src/redeemableDraws.mjs?v=20260609-mobile-polish";
import { buildTierWeightedTheory } from "./src/recommendationTheory.mjs?v=20260609-mobile-polish";
import { SAMPLE_DRAWS } from "./src/sampleDraws.mjs?v=20260609-mobile-polish";
import { parseDltCsv } from "./src/dltHistory.mjs?v=20260609-mobile-polish";
import { parseSsqCsv } from "./src/ssqHistory.mjs?v=20260609-mobile-polish";
import { createSimulationRecord, summarizeSimulationRecords } from "./src/simulationTracker.mjs?v=20260609-mobile-polish";
import { checkTicketLinesByIssue } from "./src/ticketCheck.mjs?v=20260609-mobile-polish";

const today = new Date().toISOString().slice(0, 10);
const state = {
  typeId: "ssq",
  analysisTypeId: "ssq",
  strategy: "balanced",
  generateCount: 5,
  entitlement: loadEntitlement(),
  history: loadHistory(),
  latestGeneratedBatch: null,
  copyStatus: "",
  checkTypeId: "ssq",
  checkResult: null,
  appreciationMethod: "wechat",
  checkIssue: {
    ssq: "",
    dlt: "",
  },
  checkRows: {
    ssq: [createBlankCheckRow("ssq")],
    dlt: [createBlankCheckRow("dlt")],
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
  analysisTypeButtons: [...document.querySelectorAll("[data-analysis-type]")],
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
  checkIssue: document.querySelector("#ticket-issue-select"),
  checkFields: document.querySelector("#ticket-check-fields"),
  checkAddRow: document.querySelector("#ticket-add-row-button"),
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

  elements.analysisTypeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.analysisTypeId = button.dataset.analysisType;
      renderAnalysis();
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
      state.selectedDrawIssue[state.analysisTypeId] = event.target.value;
      state.selectedDrawTouched[state.analysisTypeId] = true;
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

  elements.checkIssue.addEventListener("change", () => {
    state.checkIssue[state.checkTypeId] = elements.checkIssue.value;
    state.checkResult = null;
  });

  elements.checkFields.addEventListener("input", (event) => {
    if (!event.target.matches("[data-check-number]")) return;
    updateCheckNumber(event.target);
  });

  elements.checkFields.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-check-row]");
    if (!removeButton) return;
    removeCheckRow(removeButton.dataset.removeCheckRow);
  });

  elements.checkFields.addEventListener("keydown", (event) => {
    if (event.key !== "Backspace" || event.target.value !== "") return;
    focusPreviousCheckInput(event.target);
  });

  elements.checkAddRow.addEventListener("click", () => {
    state.checkRows[state.checkTypeId].push(createBlankCheckRow(state.checkTypeId));
    state.checkResult = null;
    renderTicketCheck();
  });

  elements.appreciationMethods.forEach((button) => {
    button.addEventListener("click", () => {
      state.appreciationMethod = button.dataset.appreciationMethod;
      renderAppreciation();
    });
  });

  elements.ticket.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-generated]");
    if (copyButton) {
      copyGeneratedBatch();
    }
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
    state.latestGeneratedBatch = generated;
    state.copyStatus = "";
    persist();
    render(generated);
  });

  elements.checkButton.addEventListener("click", () => {
    try {
      state.checkResult = checkTicketLinesByIssue({
        typeId: state.checkTypeId,
        issue: elements.checkIssue.value,
        ticketText: buildTicketTextFromRows(state.checkTypeId),
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
    elements.ticket.innerHTML = "";
  }
}

function renderAnalysis() {
  const analysis = analyzeDraws(state.draws, state.analysisTypeId);
  const type = getLotteryType(state.analysisTypeId);
  const typeDraws = state.draws.filter((draw) => draw.type === state.analysisTypeId);
  const redeemableDraws = getRedeemableDraws(typeDraws, new Date());
  const latest = getSelectedDraw(state.analysisTypeId, redeemableDraws, analysis.latest);
  const theory = buildTierWeightedTheory({ typeId: state.analysisTypeId, draws: typeDraws });
  const simulationSummary = summarizeSimulationRecords(
    state.analysisTypeId,
    state.history.map((item) => item.simulation).filter(Boolean),
  );

  elements.analysisTypeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.analysisType === state.analysisTypeId);
  });

  elements.latestIssue.textContent = latest ? `${latest.issue} 期` : "暂无数据";
  elements.latestDraw.innerHTML = latest
    ? `
      <strong>${escapeHtml(type.name)} ${escapeHtml(latest.issue)} 期 · ${escapeHtml(latest.date)}</strong>
      ${renderBalls(formatTicket(state.analysisTypeId, latest), type)}
      <p class="fine-print">${escapeHtml(state.dataNotice[state.analysisTypeId])}</p>
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
  elements.redeemableDraws.innerHTML = renderRedeemableDraws(state.analysisTypeId, redeemableDraws, latest);
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

function renderTicketCheck(options = {}) {
  const type = getLotteryType(state.checkTypeId);
  const redeemableDraws = getRedeemableDraws(
    state.draws.filter((draw) => draw.type === state.checkTypeId),
    new Date(),
  );
  const selectedIssue = getSelectedCheckIssue(state.checkTypeId, redeemableDraws);

  elements.checkTypeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.checkType === state.checkTypeId);
  });

  elements.checkIssue.innerHTML = redeemableDraws.length
    ? redeemableDraws
        .map(
          ({ draw }) =>
            `<option value="${escapeHtml(draw.issue)}"${draw.issue === selectedIssue ? " selected" : ""}>${escapeHtml(formatDrawOptionLabel(draw))}</option>`,
        )
        .join("")
    : `<option value="">暂无可兑奖期号</option>`;

  elements.checkFields.innerHTML = renderCheckRows(state.checkTypeId);

  elements.checkResult.innerHTML = state.checkResult
    ? renderCheckResult(state.checkResult)
    : "";
  elements.checkResult.classList.toggle("is-empty", !state.checkResult);
  elements.prizeRules.innerHTML = renderPrizeRules(getPrizeRuleSummary(state.checkTypeId));

  if (options.focusLastRow) {
    const inputs = elements.checkFields.querySelectorAll("[data-check-number]");
    inputs[inputs.length - getLotteryInputCount(state.checkTypeId)]?.focus();
  }
}

function renderCheckResult(result) {
  if (result.error || !result.found) {
    return `
      <b>${result.error ? "查询信息有误" : "未找到对应期号"}</b>
      <p>${escapeHtml(result.summary)}</p>
    `;
  }

  const type = getLotteryType(result.typeId);
  if (Array.isArray(result.lines)) {
    return `
      <b>${escapeHtml(type.shortName)} ${escapeHtml(result.issue)} 期 · ${escapeHtml(result.date ?? "")}</b>
      <p class="check-summary">${escapeHtml(formatCheckSummary(result))}</p>
      ${renderBalls(formatTicket(result.typeId, result.draw), type)}
      <div class="checked-lines">
        ${result.lines.map((line) => renderCheckedLine(result.typeId, line)).join("")}
      </div>
    `;
  }

  return `
    <b>${escapeHtml(type.shortName)} ${escapeHtml(result.issue)} 期</b>
    <p>${escapeHtml(result.summary)}</p>
    ${renderBalls(formatTicket(result.typeId, result.draw), type)}
  `;
}

function renderCheckedLine(typeId, line) {
  const type = getLotteryType(typeId);
  const formatted = formatTicket(typeId, line.ticket);
  const hitClass = line.evaluation.hit ? " check-line--hit" : "";
  const prizeAmount = formatPrizeAmount(line.evaluation.prizeLabel);
  return `
    <div class="check-line${hitClass}">
      <div class="check-line__meta">
        <b>第 ${line.index} 注 · ${escapeHtml(line.evaluation.tierName)}</b>
        <small class="prize-amount">${escapeHtml(prizeAmount)}</small>
        <span>${escapeHtml(formatCompactMatchText(type, line.evaluation.matches))}</span>
      </div>
      ${renderCheckedBalls(formatted, type, line.matchedNumbers)}
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
      <div class="batch-actions">
        <button class="ghost-action batch-copy" data-copy-generated type="button">复制本批号码</button>
        ${state.copyStatus ? `<span>${escapeHtml(state.copyStatus)}</span>` : ""}
      </div>
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

function renderCheckedBalls(formatted, type, matchedNumbers = {}) {
  const balls = Object.entries(type.groups)
    .flatMap(([groupName, rule]) => {
      const matchedSet = new Set(matchedNumbers[groupName] ?? []);
      return formatted[groupName].map((number) => {
        const value = Number(number);
        const matchedClass = matchedSet.has(value) ? " check-ball--matched" : "";
        return `<span class="check-ball check-ball--${rule.color}${matchedClass}">${number}</span>`;
      });
    })
    .join("");

  return `<div class="check-ball-row" aria-label="${escapeHtml(type.shortName)}票面号码">${balls}</div>`;
}

function formatPrizeAmount(prizeLabel) {
  return prizeLabel === "浮动奖金" ? "浮动" : prizeLabel;
}

async function copyGeneratedBatch() {
  const batch = state.latestGeneratedBatch;
  if (!Array.isArray(batch) || !batch.length) return;

  const text = formatGeneratedBatchForCopy(batch);

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopyText(text);
    }
    state.copyStatus = "已复制";
  } catch (error) {
    try {
      fallbackCopyText(text);
      state.copyStatus = "已复制";
    } catch {
      state.copyStatus = "复制失败，请手动选择号码";
    }
  }

  elements.ticket.innerHTML = renderGeneratedBatch(batch);
}

function formatGeneratedBatchForCopy(batch) {
  return batch.map((item, index) => formatGeneratedLineForCopy(item, index)).join("\n");
}

function formatGeneratedLineForCopy(item, index) {
  const type = getLotteryType(item.typeId);
  const formatted = formatTicket(item.typeId, item.ticket);
  const groups = Object.keys(type.groups).map((groupName) => formatted[groupName].join(","));
  return `${formatChineseOrdinal(index + 1)}注 ${groups.join("   ")}`;
}

function formatChineseOrdinal(number) {
  const numerals = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (number <= 10) return `第${numerals[number]}`;
  if (number < 20) return `第十${numerals[number - 10]}`;
  return `第${number}`;
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("copy command failed");
  }
}

function formatCheckSummary(result) {
  const totalPrize = summarizePrizeAmount(result.lines);
  return `共${result.lines.length}注，中${result.hitCount}注，共${totalPrize}`;
}

function summarizePrizeAmount(lines) {
  if (lines.some((line) => line.evaluation.prizeLabel === "浮动奖金")) {
    return "含浮动";
  }

  const total = lines.reduce((sum, line) => sum + parsePrizeYuan(line.evaluation.prizeLabel), 0);
  return `${total}元`;
}

function parsePrizeYuan(prizeLabel) {
  const match = String(prizeLabel).match(/^(\d+(?:\.\d+)?)元$/);
  return match ? Number(match[1]) : 0;
}

function formatCompactMatchText(type, matches) {
  return Object.entries(type.groups)
    .map(([groupName, rule]) => `${rule.label.slice(0, 1)}${matches[groupName] ?? 0}`)
    .join("");
}

function renderCheckRows(typeId) {
  const type = getLotteryType(typeId);
  return `
    <div class="manual-check-rows">
      ${state.checkRows[typeId].map((row, index) => renderCheckRow(type, row, index)).join("")}
    </div>
  `;
}

function renderCheckRow(type, row, rowIndex) {
  const groups = Object.entries(type.groups)
    .map(
      ([groupName, rule]) => `
        <div
          class="number-group number-group--${escapeHtml(rule.color)}"
          aria-label="${escapeHtml(rule.label)}"
          title="${escapeHtml(rule.label)}"
        >
          ${Array.from({ length: rule.count }, (_, numberIndex) =>
            renderNumberInput(row, groupName, numberIndex, rule),
          ).join("")}
        </div>
      `,
    )
    .join("");

  const removeDisabled = state.checkRows[type.id].length <= 1 ? "disabled" : "";

  return `
    <article class="manual-check-row" data-check-row="${escapeHtml(row.id)}">
      <div class="manual-check-row__title">
        <b>第 ${rowIndex + 1} 注</b>
        <button class="row-remove" data-remove-check-row="${escapeHtml(row.id)}" type="button" ${removeDisabled}>删除</button>
      </div>
      <div class="number-track">${groups}</div>
    </article>
  `;
}

function renderNumberInput(row, groupName, numberIndex, rule) {
  const value = row.groups[groupName]?.[numberIndex] ?? "";
  return `
    <input
      class="number-box number-box--${escapeHtml(rule.color)}"
      data-check-number="true"
      data-row-id="${escapeHtml(row.id)}"
      data-group="${escapeHtml(groupName)}"
      data-index="${numberIndex}"
      inputmode="numeric"
      maxlength="2"
      aria-label="${escapeHtml(rule.label)}第 ${numberIndex + 1} 个号码"
      value="${escapeHtml(value)}"
    />
  `;
}

function updateCheckNumber(input) {
  const row = findCheckRow(input.dataset.rowId);
  if (!row) return;

  const cleanValue = input.value.replace(/\D/g, "").slice(0, 2);
  input.value = cleanValue;
  row.groups[input.dataset.group][Number(input.dataset.index)] = cleanValue;
  state.checkResult = null;

  if (cleanValue.length === 2) {
    focusNextCheckInput(input);
  }
}

function focusNextCheckInput(input) {
  const inputs = [...elements.checkFields.querySelectorAll("[data-check-number]")];
  const next = inputs[inputs.indexOf(input) + 1];
  next?.focus();
}

function focusPreviousCheckInput(input) {
  const inputs = [...elements.checkFields.querySelectorAll("[data-check-number]")];
  const previous = inputs[inputs.indexOf(input) - 1];
  previous?.focus();
}

function removeCheckRow(rowId) {
  const rows = state.checkRows[state.checkTypeId];
  if (rows.length <= 1) return;
  state.checkRows[state.checkTypeId] = rows.filter((row) => row.id !== rowId);
  state.checkResult = null;
  renderTicketCheck();
}

function createBlankCheckRow(typeId) {
  const type = getLotteryType(typeId);
  return {
    id: `${typeId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    groups: Object.fromEntries(
      Object.entries(type.groups).map(([groupName, rule]) => [groupName, Array(rule.count).fill("")]),
    ),
  };
}

function findCheckRow(rowId) {
  return state.checkRows[state.checkTypeId].find((row) => row.id === rowId);
}

function buildTicketTextFromRows(typeId) {
  const type = getLotteryType(typeId);
  const groupNames = Object.keys(type.groups);
  return state.checkRows[typeId]
    .map((row) => groupNames.map((groupName) => row.groups[groupName].join(" ")).join(" + "))
    .join("\n");
}

function getSelectedCheckIssue(typeId, redeemableDraws) {
  const savedIssue = state.checkIssue[typeId];
  const selected = redeemableDraws.find(({ draw }) => draw.issue === savedIssue)?.draw.issue;
  const fallback = redeemableDraws[0]?.draw.issue ?? "";
  state.checkIssue[typeId] = selected ?? fallback;
  return state.checkIssue[typeId];
}

function getLotteryInputCount(typeId) {
  const type = getLotteryType(typeId);
  return Object.values(type.groups).reduce((total, rule) => total + rule.count, 0);
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
            ({ draw }) =>
              `<option value="${escapeHtml(draw.issue)}"${draw.issue === selectedDraw?.issue ? " selected" : ""}>${escapeHtml(formatDrawOptionLabel(draw))}</option>`,
          )
          .join("")}
      </select>
    </label>
    <p class="fine-print">默认选择最新一期；切换期号后，上方开奖号码同步展示。兑奖有效期按开奖日起 60 个自然日估算，实际以官方公告为准。</p>
  `;
}

function formatDrawOptionLabel(draw) {
  return `${draw.issue}期 ${formatShortMonthDay(draw.date)}开奖`;
}

function formatShortMonthDay(dateText) {
  const text = String(dateText ?? "");
  const match = text.match(/(\d{1,2})[-/](\d{1,2})$/);
  return match ? `${match[1]}/${match[2]}` : formatSlashDate(text);
}

function formatSlashDate(dateText) {
  return String(dateText ?? "").replaceAll("-", "/");
}

function getSelectedDraw(typeId, redeemable, fallbackDraw) {
  const savedIssue = state.selectedDrawIssue[typeId];
  const selected = state.selectedDrawTouched[typeId]
    ? redeemable.find(({ draw }) => draw.issue === savedIssue)?.draw
    : null;
  const latestRedeemable = redeemable[0]?.draw;
  return selected ?? latestRedeemable ?? fallbackDraw;
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
              <div class="prize-rule-card">
                <div class="prize-rule-card__head">
                  <b>${escapeHtml(row.name)}</b>
                  <strong>${escapeHtml(row.prize)}</strong>
                </div>
                ${row.conditions
                  .map(
                    (condition) => `
                      <div class="prize-rule-row">
                        ${renderPrizeCondition(summary.typeId, condition)}
                      </div>
                    `,
                  )
                  .join("")}
              </div>
            `,
          )
          .join("")}
      </div>
      <p class="fine-print">${escapeHtml(summary.note)}</p>
    </details>
  `;
}

function renderPrizeCondition(typeId, condition) {
  const type = getLotteryType(typeId);
  return Object.entries(type.groups)
    .map(([groupName, rule]) => {
      const count = condition[groupName] ?? 0;
      const balls = Array.from({ length: count }, () => `<span class="rule-ball ${rule.color}"></span>`).join("");
      return `
        <span class="rule-condition-group">
          <span class="rule-condition-label">${escapeHtml(rule.label)}</span>
          <span class="rule-balls">${balls || `<span class="rule-zero">0</span>`}</span>
          <b>${count}个</b>
        </span>
      `;
    })
    .join("");
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
