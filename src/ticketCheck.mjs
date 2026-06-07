import { getLotteryType, validateTicket } from "./lotteryCatalog.mjs";
import { evaluateTicketAgainstDraw } from "./prizeRules.mjs";

export const SUPPORTED_TICKET_SCAN_TYPES = ["ssq", "dlt"];

export function isSupportedTicketScanType(typeId) {
  return SUPPORTED_TICKET_SCAN_TYPES.includes(typeId);
}

export function parseTicketNumbers(typeId, values = {}) {
  assertSupportedType(typeId);
  const type = getLotteryType(typeId);
  const ticket = {};

  for (const [groupName, rule] of Object.entries(type.groups)) {
    ticket[groupName] = parseNumberList(values[groupName], rule.count);
  }

  return ticket;
}

export function checkTicketByIssue({ typeId, issue, ticket, draws = [] } = {}) {
  assertSupportedType(typeId);
  const normalizedIssue = normalizeIssue(issue);
  const draw = draws.find((item) => item.type === typeId && normalizeIssue(item.issue) === normalizedIssue);
  const type = getLotteryType(typeId);

  if (!draw) {
    return {
      typeId,
      issue: normalizedIssue,
      found: false,
      summary: `未找到${type.shortName}${normalizedIssue}期开奖记录，请确认期号或等待历史数据更新。`,
      complianceNote: "查询结果仅供参考，实际开奖与实体票信息以官方公告为准。本平台不提供奖金领取、代领等服务。",
    };
  }

  const validation = validateTicket(typeId, ticket);
  if (!validation.valid) {
    throw new Error(`票面号码不符合${type.shortName}规则：${validation.errors.join("; ")}`);
  }

  const evaluation = evaluateTicketAgainstDraw(typeId, validation.normalized, draw);
  const summary = evaluation.hit
    ? `${type.shortName}${draw.issue}期模拟查询：命中${evaluation.tierName}，${evaluation.matchText}。`
    : `${type.shortName}${draw.issue}期模拟查询：未达到奖级，${evaluation.matchText}。`;

  return {
    typeId,
    issue: draw.issue,
    date: draw.date ?? "",
    found: true,
    draw,
    ticket: validation.normalized,
    evaluation,
    summary,
    complianceNote: "查询结果仅供参考，实际开奖与实体票信息以官方公告为准。本平台不提供奖金领取、代领等服务。",
  };
}

function assertSupportedType(typeId) {
  if (!isSupportedTicketScanType(typeId)) {
    throw new Error("验票辅助只支持双色球和超级大乐透。");
  }
}

function normalizeIssue(issue) {
  return String(issue ?? "").replace(/\D/g, "");
}

function parseNumberList(value, expectedCount) {
  if (Array.isArray(value)) {
    return value.map(Number).filter(Number.isInteger);
  }

  const digits = String(value ?? "").match(/\d{1,2}/g) ?? [];
  return digits.slice(0, expectedCount).map(Number);
}
