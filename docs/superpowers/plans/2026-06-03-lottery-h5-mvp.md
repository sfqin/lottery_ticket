# Lottery H5 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a compliant no-dependency H5 MVP for大乐透 and双色球 number generation, basic draw analysis, simulated ad unlock, and voluntary appreciation copy that does not grant entitlements.

**Architecture:** Use a small static web app served by Node's built-in HTTP module. Keep lottery rules, generation strategies, draw analysis, entitlement logic, compliance text, and sample data in focused ES modules with Node tests.

**Tech Stack:** Native HTML/CSS/JavaScript, Node.js ES modules, `node:test`, no external dependencies.

---

## File Structure

- `package.json`: project scripts for tests and local server.
- `server.mjs`: static file server for the H5 app.
- `src/lotteryCatalog.mjs`: lottery rules and validation.
- `src/numberGenerator.mjs`: random, balanced, and data-reference strategies.
- `src/drawAnalysis.mjs`: latest draw, hot/cold numbers, omissions, parity, size, region stats.
- `src/entitlements.mjs`: daily free quota and simulated ad unlock quota.
- `src/compliance.mjs`: compliance copy, forbidden phrases, appreciation rules.
- `src/sampleDraws.mjs`: small seed dataset for双色球 and大乐透.
- `public/index.html`: H5 markup.
- `public/styles.css`: mobile-first H5 styling.
- `public/app.js`: browser app state and UI rendering.
- `tests/*.test.mjs`: behavior tests for rules, generation, analysis, entitlements, and compliance.

## Tasks

### Task 1: Project Scripts

- [ ] Create `package.json` with `test`, `dev`, and `start` scripts.
- [ ] Run `npm test` and verify Node's test runner starts with no tests.

### Task 2: Lottery Catalog

- [ ] Write failing tests for大乐透 and双色球 rule validation.
- [ ] Implement catalog definitions and `validateTicket`.
- [ ] Run catalog tests and verify they pass.

### Task 3: Number Generation

- [ ] Write failing tests for random, balanced, and data-reference generation.
- [ ] Implement deterministic RNG injection and generation explanations.
- [ ] Run generator tests and verify they pass.

### Task 4: Draw Analysis

- [ ] Write failing tests for latest draw, hot/cold numbers, omissions, parity, size, and regions.
- [ ] Implement sample draw analysis helpers.
- [ ] Run analysis tests and verify they pass.

### Task 5: Entitlements

- [ ] Write failing tests for daily free limit, simulated ad unlock, and appreciation not granting quota.
- [ ] Implement entitlement state helpers.
- [ ] Run entitlement tests and verify they pass.

### Task 6: Compliance Text

- [ ] Write failing tests for forbidden phrase scanning and appreciation copy.
- [ ] Implement compliance constants and scan helper.
- [ ] Run compliance tests and verify they pass.

### Task 7: H5 App

- [ ] Create static H5 files wired to the tested modules.
- [ ] Show lottery selector, generation mode selector, remaining quota, generated numbers, explanation, positive message, latest draw, basic stats, simulated ad unlock, and voluntary appreciation notice.
- [ ] Ensure no purchase, lottery sale, ticketing, betting, prediction, or entitlement-granting appreciation UI exists.

### Task 8: Local Server And Verification

- [ ] Create `server.mjs`.
- [ ] Run all tests with `npm test`.
- [ ] Start `node server.mjs`.
- [ ] Verify the H5 loads locally and key text is present.
- [ ] Stop the server if needed.

### Task 9: Commit

- [ ] Run `git status --short`.
- [ ] Commit implementation on `feature/h5-mvp`.
