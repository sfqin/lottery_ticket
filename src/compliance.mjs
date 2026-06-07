export const FORBIDDEN_PHRASES = [
  "立即购彩",
  "购买彩票",
  "代购",
  "出票",
  "下单",
  "跟投",
  "合买",
  "追号",
  "代为兑奖",
  "代领",
  "专家预测",
  "内部号",
  "杀号",
  "定胆",
  "必中",
  "包中",
  "稳赚",
  "提高中奖率",
  "提升命中率",
  "翻身致富",
  "投资回报",
];

export const REQUIRED_NOTICES = [
  "本平台仅提供号码生成与数据分析服务。",
  "本平台不销售彩票，不代购彩票，不出票。",
  "生成结果仅供娱乐参考，不构成中奖预测。",
  "彩票开奖具有随机性，请理性使用、量力而行。",
  "未满 18 周岁不得使用本服务参与任何彩票相关活动。",
];

export const APPRECIATION_NOTICE =
  "赞赏为自愿支持，不构成购买服务，不绑定任何权益，不影响号码生成结果。";

export function scanForbiddenPhrases(text) {
  const matches = FORBIDDEN_PHRASES.filter((phrase) => text.includes(phrase));
  return {
    clean: matches.length === 0,
    matches,
  };
}

export function getComplianceFooter() {
  return [...REQUIRED_NOTICES, APPRECIATION_NOTICE];
}
