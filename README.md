# 大乐透 / 双色球智能选号助手

一个面向手机浏览器的 H5 彩票辅助工具，支持大乐透和双色球的号码生成、开奖数据查看、手动验票、中奖规则查询和历史数据分析。

[English README](./README.en.md)

## 功能

- **智能选号**：支持双色球和大乐透，可生成 1、3、5、10 组号码。
- **选号策略**：提供均衡生成、随机生成、数据参考和分层理论模型。
- **手动验票**：选择开奖期号后输入号码，查询是否命中奖级。
- **多注核对**：一次核对多注号码，并高亮命中的红球、蓝球、前区和后区号码。
- **开奖数据**：展示最新开奖、可兑奖期数和基础统计分析。
- **中奖规则**：内置双色球和大乐透官方奖级规则及固定奖金说明。
- **历史数据自动更新**：通过 GitHub Actions 在开奖日自动抓取并提交最新开奖数据。
- **PWA 支持**：包含 manifest 和 service worker，可添加到手机主屏幕。

## 规则范围

| 彩种 | 前区 / 红球 | 后区 / 蓝球 |
| --- | --- | --- |
| 双色球 | 红球 1-33 选 6 个 | 蓝球 1-16 选 1 个 |
| 大乐透 | 前区 1-35 选 5 个 | 后区 1-12 选 2 个 |

号码规则集中定义在 `src/lotteryCatalog.mjs`，生成、校验和验票逻辑共用同一份配置。

## 本地运行

需要 Node.js。推荐使用 Node 20 或更高版本。

```bash
npm install
npm run dev
```

默认本地地址：

```text
http://localhost:4173
```

如果要在手机上测试，请确保手机和电脑在同一个 Wi-Fi 下，然后用手机访问电脑局域网 IP，例如：

```text
http://你的电脑IP:4173
```

## 测试

```bash
npm test
```

测试覆盖号码规则、生成器、验票、奖级判断、历史数据解析、H5 内容和合规提示。

## 数据更新

历史开奖数据存放在：

- `data/ssq-history.csv`
- `data/dlt-history.csv`

可以手动更新：

```bash
npm run import:ssq
npm run import:dlt
```

也可以依赖 GitHub Actions 自动更新：

- 双色球：周二、周四、周日开奖后抓取。
- 大乐透：周一、周三、周六开奖后抓取。
- 开奖日晚间会补抓一次，降低数据源延迟带来的影响。

自动更新配置见 `.github/workflows/update-lottery-data.yml`。

## 部署

GitHub Pages 部署由 `.github/workflows/deploy-github-pages.yml` 管理。

当前部署策略：

- 仅 `main` 分支 push 会触发 Pages 部署。
- 部署前会执行 `npm test`。
- 静态站点内容来自 `public/`、`src/` 和 `data/`。

部署成功后，页面地址通常是：

```text
https://sfqin.github.io/lottery_ticket/
```

如果页面未更新，请检查 GitHub Actions 是否成功，以及浏览器或 service worker 缓存是否仍保留旧版本。

## 项目结构

```text
public/                  H5 页面、样式、前端入口、PWA 文件
src/                     号码规则、生成器、验票、开奖分析、奖级规则
data/                    双色球和大乐透历史开奖 CSV
scripts/                 历史数据导入脚本
tests/                   Node.js 测试用例
.github/workflows/       Pages 部署和开奖数据自动更新
server.mjs               本地静态服务器
```

## 合规声明

本项目仅用于娱乐参考和个人数据分析：

- 不销售彩票。
- 不代购彩票。
- 不提供中奖预测承诺。
- 不提供奖金领取、代领或兑奖服务。
- 所有开奖结果和兑奖规则以官方公告为准。

请理性使用。
