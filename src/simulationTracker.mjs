import { getLotteryType } from "./lotteryCatalog.mjs";
import { evaluateTicketAgainstDraw } from "./prizeRules.mjs";

export function createSimulationRecord({ recommendation, draw } = {}) {
  if (!recommendation?.typeId || !recommendation?.ticket || !draw) {
    throw new Error("Recommendation and draw are required for simulation tracking");
  }

  const evaluation = evaluateTicketAgainstDraw(recommendation.typeId, recommendation.ticket, draw);
  const type = getLotteryType(recommendation.typeId);

  return {
    typeId: recommendation.typeId,
    typeName: type.name,
    issue: draw.issue ?? "",
    date: draw.date ?? "",
    evaluation,
    lesson: buildLesson(evaluation),
    complianceNote: "本次复盘只对已公开开奖做模拟比对，不代表未来命中概率。",
  };
}

export function summarizeSimulationRecords(typeId, records = []) {
  const type = getLotteryType(typeId);
  const filtered = records.filter((record) => record?.typeId === typeId);
  const hitRecords = filtered.filter((record) => record.evaluation?.hit);
  const bestRecord = hitRecords
    .toSorted((a, b) => a.evaluation.tier - b.evaluation.tier)
    .at(0);

  const totalPrimary = filtered.reduce((sum, record) => sum + (record.evaluation?.primaryMatches ?? 0), 0);
  const totalSecondary = filtered.reduce((sum, record) => sum + (record.evaluation?.secondaryMatches ?? 0), 0);
  const total = filtered.length;

  return {
    typeId,
    typeName: type.name,
    total,
    hitCount: hitRecords.length,
    bestTier: bestRecord?.evaluation?.tier ?? 0,
    bestTierName: bestRecord?.evaluation?.tierName ?? "暂无命中",
    averagePrimaryMatches: total ? Number((totalPrimary / total).toFixed(2)) : 0,
    averageSecondaryMatches: total ? Number((totalSecondary / total).toFixed(2)) : 0,
    lesson: total
      ? "模拟记录只用于观察组合结构，不用于承诺后续表现或调整出任何中奖保证。"
      : "暂无模拟记录；生成号码后会基于当前最新开奖做一次娱乐复盘。",
  };
}

function buildLesson(evaluation) {
  if (evaluation.hit) {
    return `本次模拟命中${evaluation.tierName}，匹配结构为${evaluation.matchText}；后续仅作为娱乐统计样本。`;
  }

  return `本次模拟未达到奖级，匹配结构为${evaluation.matchText}；记录会用于观察组合分布，但不形成中奖承诺。`;
}
