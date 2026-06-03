import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  APPRECIATION_NOTICE,
  REQUIRED_NOTICES,
  scanForbiddenPhrases,
} from "../src/compliance.mjs";

describe("compliance", () => {
  it("flags forbidden sale and prediction phrases", () => {
    const result = scanForbiddenPhrases("立即购彩，专家预测，包中，提高中奖率");

    assert.deepEqual(result.matches, ["立即购彩", "专家预测", "包中", "提高中奖率"]);
    assert.equal(result.clean, false);
  });

  it("allows compliant entertainment copy", () => {
    const result = scanForbiddenPhrases("生成结果仅供娱乐参考，不构成中奖预测。");

    assert.equal(result.clean, true);
    assert.deepEqual(result.matches, []);
  });

  it("states appreciation is voluntary and not an entitlement", () => {
    assert.match(APPRECIATION_NOTICE, /自愿支持/);
    assert.match(APPRECIATION_NOTICE, /不影响号码生成结果/);
    assert.match(APPRECIATION_NOTICE, /不绑定任何权益/);
  });

  it("includes required no-sale and randomness notices", () => {
    assert.ok(REQUIRED_NOTICES.some((notice) => notice.includes("不销售彩票")));
    assert.ok(REQUIRED_NOTICES.some((notice) => notice.includes("不构成中奖预测")));
    assert.ok(REQUIRED_NOTICES.some((notice) => notice.includes("未满 18 周岁")));
  });
});
