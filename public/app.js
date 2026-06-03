import { APPRECIATION_NOTICE, REQUIRED_NOTICES } from "/src/compliance.mjs";
import { analyzeDraws } from "/src/drawAnalysis.mjs";
import {
  createEntitlementState,
  getRemainingGenerations,
  recordAdUnlock,
  recordAppreciation,
  useGeneration,
} from "/src/entitlements.mjs";
import { formatTicket, getLotteryType } from "/src/lotteryCatalog.mjs";
import { generateTicket } from "/src/numberGenerator.mjs";
import { SAMPLE_DRAWS } from "/src/sampleDraws.mjs";

const today = new Date().toISOString().slice(0, 10);
const state = {
  typeId: "ssq",
  strategy: "balanced",
  entitlement: loadEntitlement(),
  history: loadHistory(),
};

const elements = {
  notices: document.querySelector("#required-notices"),
  remaining: document.querySelector("#remaining-count"),
  typeButtons: [...document.querySelectorAll("[data-type]")],
  strategy: document.querySelector("#strategy-select"),
  generate: document.querySelector("#generate-button"),
  ticket: document.querySelector("#ticket-card"),
  unlock: document.querySelector("#unlock-panel"),
  adUnlock: document.querySelector("#ad-unlock-button"),
  latestIssue: document.querySelector("#latest-issue"),
  latestDraw: document.querySelector("#latest-draw"),
  analysis: document.querySelector("#analysis-summary"),
  historyCount: document.querySelector("#history-count"),
  history: document.querySelector("#history-list"),
  appreciationNotice: document.querySelector("#appreciation-notice"),
  appreciation: document.querySelector("#appreciation-button"),
};

initialize();

function initialize() {
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

  elements.generate.addEventListener("click", () => {
    const attempt = useGeneration(state.entitlement, today);
    state.entitlement = attempt.state;

    if (!attempt.allowed) {
      persist();
      render();
      return;
    }

    const result = generateTicket({
      typeId: state.typeId,
      strategy: state.strategy,
      draws: SAMPLE_DRAWS.filter((draw) => draw.type === state.typeId),
    });

    state.history.unshift({
      ...result,
      createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    });
    state.history = state.history.slice(0, 12);
    persist();
    render(result);
  });

  elements.adUnlock.addEventListener("click", () => {
    state.entitlement = recordAdUnlock(state.entitlement, today, 3);
    persist();
    render();
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
}

function render(latestGenerated = null) {
  const remaining = getRemainingGenerations(state.entitlement, today);
  elements.remaining.textContent = `今日剩余 ${remaining} 组`;
  elements.generate.disabled = remaining === 0;
  elements.unlock.hidden = remaining > 0;

  elements.typeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.type === state.typeId);
  });

  renderAnalysis();
  renderHistory();

  if (latestGenerated) {
    elements.ticket.innerHTML = renderTicket(latestGenerated);
  } else if (state.history.length) {
    elements.ticket.innerHTML = renderTicket(state.history[0]);
  } else {
    elements.ticket.innerHTML = `<p class="muted">选择彩种和模式后，点击生成号码。</p>`;
  }
}

function renderAnalysis() {
  const analysis = analyzeDraws(SAMPLE_DRAWS, state.typeId);
  const latest = analysis.latest;
  const type = getLotteryType(state.typeId);

  elements.latestIssue.textContent = latest ? `${latest.issue} 期` : "暂无数据";
  elements.latestDraw.innerHTML = latest
    ? `
      <strong>${escapeHtml(type.name)} ${escapeHtml(latest.date)}</strong>
      ${renderBalls(formatTicket(state.typeId, latest), type)}
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
  `;
}

function renderHistory() {
  elements.historyCount.textContent = `${state.history.length} 组`;
  elements.history.innerHTML = state.history.length
    ? state.history.map((item) => `<div class="history-item">${renderTicket(item, true)}</div>`).join("")
    : `<p class="muted">生成后的号码会保存在本次浏览记录中。</p>`;
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
    ${compact ? "" : `<p class="positive-message">${escapeHtml(result.message)}</p>`}
    <p class="fine-print">${escapeHtml(result.complianceNote)}</p>
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
  }[strategy];
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
