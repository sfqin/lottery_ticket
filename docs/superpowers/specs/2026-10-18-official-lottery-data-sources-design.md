# 官方彩票开奖数据源迁移与缺失数据补齐设计

## 背景

现有自动更新任务从 `data.17500.cn` 下载双色球和大乐透完整历史文本。该域名从 2026-09-29 起持续返回 HTTP 429，导致数据更新任务连续失败，Pages 部署也因上游任务失败而跳过。当前数据停留在双色球 `2026112`（2026-09-27）和大乐透 `26111`（2026-09-28）。

本次迁移彻底移除运行时对 17500 的依赖，改用彩票发行机构公开的官方接口：

- 双色球：中国福彩网 `www.cwl.gov.cn`
- 大乐透：中国体彩网 `webapi.sporttery.cn`

历史 CSV 中已有记录保留原 `source=17500`，该字段只表示记录的历史来源，不代表程序仍会访问该域名。

## 目标

1. 自动更新仅访问福彩和体彩官方接口。
2. 一次性补齐双色球 `2026113` 至 `2026118` 共 6 期，以及大乐透 `26112` 至 `26118` 共 7 期。
3. 保留现有完整历史，不因官方接口的历史覆盖范围不同而删除早期记录。
4. 在网络异常、响应格式变化、数据冲突或数据不完整时不覆盖已有 CSV。
5. 保持现有 Action 的自动提交和 Pages 部署链路。

## 数据源与字段映射

### 双色球

使用中国福彩网往期开奖 JSON 接口。每条记录映射：

- `code` -> `issue`
- `date` 去除星期后缀 -> `date`
- `red` -> 6 个红球
- `blue` -> 1 个蓝球
- `sales` -> `sales`
- `prizegrades[type=1].typenum` -> `firstPrizeCount`
- `prizegrades[type=2].typenum` -> `secondPrizeCount`
- 固定写入 `source=cwl`

### 大乐透

使用中国体彩网历史开奖 JSON 接口，`gameNo=85`。每条记录映射：

- `lotteryDrawNum` -> `issue`
- `lotteryDrawTime` -> `date`
- `lotteryDrawResult` 前 5 个号码 -> `front`
- `lotteryDrawResult` 后 2 个号码 -> `back`
- `totalSaleAmount` -> `sales`
- `poolBalanceAfterdraw` -> `pool`
- `prizeLevelList[group=101].stakeCount` -> `firstPrizeCount`
- `prizeLevelList[group=301].stakeCount` -> `secondPrizeCount`
- 固定写入 `source=sporttery`

金额字段去除逗号后转为整数。接口缺少可选金额或奖级字段时写入 `null`，号码、期号和日期缺失则视为无效响应。

## 更新流程

两个导入脚本分别执行以下流程：

1. 读取并解析已有 CSV。
2. 从官方接口第一页开始按新到旧抓取。
3. 持续翻页，直到响应中出现本地已有期号；若第一页已经相交，只请求一页。
4. 解析所有已请求页面并按期号去重。
5. 对与本地重叠的期次比较日期和开奖号码；存在冲突时失败，不写文件。
6. 将官方接口中缺失的新期次与本地历史合并。
7. 对合并后的完整数据运行现有合法性、期号唯一性校验。
8. 仅在所有步骤成功后一次性覆盖对应 CSV。

如果到达官方接口最后一页仍未找到与本地历史的交集，任务失败，避免因错误接口、错误彩种或截断响应生成不可信文件。

## 网络和错误处理

- 使用 Node.js 内置 `fetch` 请求 JSON，不再通过 `curl` 调用外部进程。
- 请求携带明确的 `User-Agent`、`Accept` 和对应官网 `Referer`。
- 每个请求设置超时。
- 对超时、HTTP 429 和 HTTP 5xx 做有限次数的指数退避重试。
- 对其他 HTTP 错误、非 JSON 响应、接口业务错误和字段结构变化立即失败。
- 不引入非官方备用源；失败时保留上一次已验证的数据，等待下一轮调度。

## 代码边界

- `src/ssqHistory.mjs`：增加中国福彩网响应解析和记录一致性逻辑。
- `src/dltHistory.mjs`：增加中国体彩网响应解析和记录一致性逻辑。
- `scripts/import-ssq-history.mjs`：改为官方 API 分页抓取、合并和原子写入。
- `scripts/import-dlt-history.mjs`：改为官方 API 分页抓取、合并和原子写入。
- 测试文件：覆盖官方响应解析、数值格式、缺失字段、重叠一致、冲突拒绝和增量合并。
- 工作流继续调用现有 `npm run import:ssq` 与 `npm run import:dlt`，无需更改触发时间。

旧的 17500 解析函数可以删除；CSV 中的历史 `source` 字段不改写。

## 测试与验收

实现遵循测试先行：先增加会因官方解析器和合并逻辑不存在而失败的测试，再实现最小代码使其通过。

验收条件：

1. `npm test` 全部通过。
2. 两个导入命令均成功，重复执行不会产生额外差异。
3. 双色球最新一期为 `2026118`，新增 6 期。
4. 大乐透最新一期为 `26118`，新增 7 期。
5. 两份 CSV 均通过完整数据校验，无重复期号。
6. 仓库中不再存在对 `data.17500.cn` 的运行时引用。
7. 推送后远程 `Update lottery data` 成功，随后 `Deploy GitHub Pages` 成功。
