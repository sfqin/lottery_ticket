import { APPRECIATION_NOTICE, REQUIRED_NOTICES } from "./src/compliance.mjs";
import { analyzeDraws, getLatestDraw } from "./src/drawAnalysis.mjs";
import { createEntitlementState, recordAppreciation } from "./src/entitlements.mjs";
import { formatTicket, getLotteryType } from "./src/lotteryCatalog.mjs";
import { generateTicket } from "./src/numberGenerator.mjs";
import { buildTierWeightedTheory } from "./src/recommendationTheory.mjs";
import { SAMPLE_DRAWS } from "./src/sampleDraws.mjs";
import { parseDltCsv } from "./src/dltHistory.mjs";
import { parseSsqCsv } from "./src/ssqHistory.mjs";
import { createSimulationRecord, summarizeSimulationRecords } from "./src/simulationTracker.mjs";
import { checkTicketByIssue, parseTicketNumbers } from "./src/ticketCheck.mjs";

const today = new Date().toISOString().slice(0, 10);
const state = {
  typeId: "ssq",
  strategy: "balanced",
  entitlement: loadEntitlement(),
  history: loadHistory(),
  checkTypeId: "ssq",
  checkImageUrl: "",
  checkValues: {
    ssq: {},
    dlt: {},
  },
  checkResult: null,
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
  generate: document.querySelector("#generate-button"),
  ticket: document.querySelector("#ticket-card"),
  latestIssue: document.querySelector("#latest-issue"),
  latestDraw: document.querySelector("#latest-draw"),
  analysis: document.querySelector("#analysis-summary"),
  historyCount: document.querySelector("#history-count"),
  history: document.querySelector("#history-list"),
  checkTypeButtons: [...document.querySelectorAll("[data-check-type]")],
  checkPhoto: document.querySelector("#ticket-photo-input"),
  checkPreview: document.querySelector("#ticket-photo-preview"),
  checkIssue: document.querySelector("#ticket-issue-input"),
  checkFields: document.querySelector("#ticket-check-fields"),
  checkButton: document.querySelector("#check-ticket-button"),
  checkResult: document.querySelector("#ticket-check-result"),
  appreciationNotice: document.querySelector("#appreciation-notice"),
  appreciation: document.querySelector("#appreciation-button"),
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

  elements.generate.addEventListener("click", () => {
    const typeDraws = state.draws.filter((draw) => draw.type === state.typeId);
    const result = generateTicket({
      typeId: state.typeId,
      strategy: state.strategy,
      draws: typeDraws,
    });
    const latestDraw = getLatestDraw(state.draws, state.typeId);
    const simulation = latestDraw
      ? createSimulationRecord({ recommendation: result, draw: latestDraw })
      : null;
    const savedResult = {
      ...result,
      simulation,
      createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    };

    state.history.unshift(savedResult);
    state.history = state.history.slice(0, 12);
    persist();
    render(savedResult);
  });

  elements.checkButton.addEventListener("click", () => {
    try {
      const type = getLotteryType(state.checkTypeId);
      const values = {};
      for (const groupName of Object.keys(type.groups)) {
        values[groupName] = document.querySelector(`[data-check-group="${groupName}"]`)?.value ?? "";
      }
      state.checkValues[state.checkTypeId] = values;

      state.checkResult = checkTicketByIssue({
        typeId: state.checkTypeId,
        issue: elements.checkIssue.value,
        ticket: parseTicketNumbers(state.checkTypeId, values),
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

  elements.appreciation.addEventListener("click", () => {
    state.entitlement = recordAppreciation(state.entitlement, {
      amount: 0,
      date: today,
      note: "MVP 模拟赞赏记录",
    });
    persist();
    render();
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

  elements.typeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.type === state.typeId);
  });

  renderAnalysis();
  renderHistory();
  renderTicketCheck();

  if (latestGenerated) {
    elements.ticket.innerHTML = renderTicket(latestGenerated);
  } else if (state.history.length) {
    elements.ticket.innerHTML = renderTicket(state.history[0]);
  } else {
    elements.ticket.innerHTML = `<p class="muted">选择彩种和模式后，点击生成号码。</p>`;
  }
}

function renderAnalysis() {
  const analysis = analyzeDraws(state.draws, state.typeId);
  const latest = analysis.latest;
  const type = getLotteryType(state.typeId);
  const typeDraws = state.draws.filter((draw) => draw.type === state.typeId);
  const theory = buildTierWeightedTheory({ typeId: state.typeId, draws: typeDraws });
  const simulationSummary = summarizeSimulationRecords(
    state.typeId,
    state.history.map((item) => item.simulation).filter(Boolean),
  );

  elements.latestIssue.textContent = latest ? `${latest.issue} 期` : "暂无数据";
  elements.latestDraw.innerHTML = latest
    ? `
      <strong>${escapeHtml(type.name)} ${escapeHtml(latest.date)}</strong>
      ${renderBalls(formatTicket(state.typeId, latest), type)}
      <p class="fine-print">${escapeHtml(state.dataNotice[state.typeId])}</p>
    `
    : `<p class="muted">暂无开奖数据。</p>`;

  const firstGroup = Object.keys(type.groups)[0];
  const hot = analysis.hot[firstGroup].slice(0, 5).map((item) => pad(item.number)).join(" ");
  const cold = analysis.cold[firstGroup].slice(0, 5).map((item) => pad(item.number)).join(" ");
  const miss = analysis.omissions[firstGroup].slice(0, 5).map((item) => `${pad(item.number)}(${item.miss})`).join(" ");

  elements.analysis.innerHTML = `
    <div class="stat-grid">
      <div class="stat"><b>热号</b><span>${hot}</span></div>
      <div class="stat"><b>冷号</b><span>${cold}</span></div>
      <div class="stat"><b>遗漏</b><span>${miss}</span></div>
      <div class="stat"><b>奇偶累计</b><span>${analysis.parity[firstGroup].odd}:${analysis.parity[firstGroup].even}</span></div>
    </div>
    ${renderTheorySummary(theory)}
    ${renderSimulationSummary(simulationSummary, type)}
  `;
}

function renderHistory() {
  elements.historyCount.textContent = `${state.history.length} 组`;
  elements.history.innerHTML = state.history.length
    ? `<ol class="history-list-items">${state.history.map(renderHistoryRecord).join("")}</ol>`
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
        <strong>${escapeHtml(type.shortName)} · ${labelStrategy(item.strategy)}</strong>
        <span>${escapeHtml(item.createdAt ?? "")}</span>
      </div>
      <code>${escapeHtml(formatTicketText(item.typeId, item.ticket))}</code>
      <p>${escapeHtml(simulationText)}</p>
    </li>
  `;
}

function renderTicketCheck() {
  const type = getLotteryType(state.checkTypeId);

  elements.checkTypeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.checkType === state.checkTypeId);
  });

  elements.checkPreview.innerHTML = state.checkImageUrl
    ? `<img alt="彩票票面预览" src="${escapeHtml(state.checkImageUrl)}" />`
    : `<p class="muted">尚未选择票面照片。</p>`;

  elements.checkFields.innerHTML = Object.entries(type.groups)
    .map(
      ([groupName, rule]) => `
        <label class="field">
          <span>${escapeHtml(rule.label)}号码</span>
          <input
            data-check-group="${escapeHtml(groupName)}"
            inputmode="numeric"
            placeholder="${escapeHtml(buildNumberPlaceholder(rule.count))}"
            value="${escapeHtml(state.checkValues[state.checkTypeId][groupName] ?? "")}"
          />
        </label>
      `,
    )
    .join("");

  elements.checkResult.innerHTML = state.checkResult
    ? renderCheckResult(state.checkResult)
    : `<p class="muted">选择彩种并填写期号、号码后，可查询对应期开奖与奖级。</p>`;
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
  return `
    <b>${escapeHtml(type.shortName)} ${escapeHtml(result.issue)} 期</b>
    <p>${escapeHtml(result.summary)}</p>
    ${renderBalls(formatTicket(result.typeId, result.draw), type)}
    <p class="fine-print">${escapeHtml(result.complianceNote)}</p>
  `;
}

function renderTicket(result, compact = false) {
  const type = getLotteryType(result.typeId);
  const formatted = formatTicket(result.typeId, result.ticket);
  return `
    <strong>${escapeHtml(type.name)} · ${labelStrategy(result.strategy)}</strong>
    ${renderBalls(formatted, type)}
    ${compact ? `<p class="fine-print">${escapeHtml(result.createdAt ?? "")}</p>` : ""}
    <p>${escapeHtml(result.explanation.summary)}</p>
    <ul class="explain-list">
      ${result.explanation.items.slice(0, compact ? 2 : 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
    ${result.simulation ? renderSimulation(result.simulation, compact) : ""}
    ${compact ? "" : `<p class="positive-message">${escapeHtml(result.message)}</p>`}
    <p class="fine-print">${escapeHtml(result.complianceNote)}</p>
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

function renderBalls(formatted, type) {
  return Object.entries(type.groups)
    .map(([groupName, rule]) => {
      const balls = formatted[groupName]
        .map((number) => `<span class="ball ${rule.color}">${number}</span>`)
        .join("");
      return `<div class="ball-row" aria-label="${escapeHtml(rule.label)}">${balls}</div>`;
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

function buildNumberPlaceholder(count) {
  return Array.from({ length: count }, (_, index) => String(index + 1).padStart(2, "0")).join(" ");
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
