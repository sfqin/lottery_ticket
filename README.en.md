# Super Lotto / Double Color Ball Smart Picker

A mobile-first H5 lottery helper for China Sports Lottery Super Lotto and Welfare Lottery Double Color Ball. It supports number generation, draw lookup, manual ticket checking, prize rule reference, and historical draw analysis.

[中文 README](./README.md)

## Features

- **Smart number generation**: Generate 1, 3, 5, or 10 tickets for Double Color Ball or Super Lotto.
- **Generation strategies**: Trend reference is the default mode, with balanced, random, historical-data reference, and tier-weighted theory modes also available.
- **Manual ticket check**: Select a draw issue, enter ticket numbers, and check whether the ticket hits a prize tier.
- **Multi-stake checking**: Check multiple ticket lines at once and highlight matched numbers.
- **Draw data**: Show the latest draw, redeemable draw window, and compact statistical analysis.
- **Prize rules**: Built-in official prize tier rules and fixed-prize labels.
- **Scheduled data updates**: GitHub Actions imports the latest draw data after scheduled draw nights.
- **PWA support**: Includes a web manifest and service worker for home-screen installation.

## Number Rules

| Lottery | Front / Red numbers | Back / Blue numbers |
| --- | --- | --- |
| Double Color Ball | 6 red numbers from 1-33 | 1 blue number from 1-16 |
| Super Lotto | 5 front numbers from 1-35 | 2 back numbers from 1-12 |

The shared rule source lives in `src/lotteryCatalog.mjs`. Generation, validation, and ticket checking all use the same configuration.

## Generation Strategies

- **Trend reference**: Default mode. It combines the full draw history with the latest 100 draws, using hot/cold numbers, omissions, parity, region distribution, and long-term frequency as entertainment reference signals.
- **Balanced**: Picks from valid random candidates with a more even structure.
- **Random**: Generates legal numbers only from the official lottery ranges.
- **Historical-data reference**: Uses historical number frequency without treating history as future proof.
- **Tier-weighted theory**: Combines official prize tier structure, historical data, and low-weight random noise.

## Local Development

Node.js is required. Node 20 or newer is recommended.

```bash
npm install
npm run dev
```

The local server runs at:

```text
http://localhost:4173
```

To test on a phone, keep the phone and computer on the same Wi-Fi network, then open the computer's LAN address from the phone:

```text
http://YOUR_COMPUTER_IP:4173
```

## Tests

```bash
npm test
```

The test suite covers lottery rules, number generation, ticket checking, prize evaluation, history import, H5 content, and compliance copy.

## Data Updates

Historical draw data is stored in:

- `data/ssq-history.csv`
- `data/dlt-history.csv`

Manual import commands:

```bash
npm run import:ssq
npm run import:dlt
```

GitHub Actions also updates the data automatically:

- Double Color Ball: after Tuesday, Thursday, and Sunday draw nights.
- Super Lotto: after Monday, Wednesday, and Saturday draw nights.
- A later retry job runs on draw nights to handle delayed data sources.

See `.github/workflows/update-lottery-data.yml` for the schedule.

## Deployment

GitHub Pages deployment is managed by `.github/workflows/deploy-github-pages.yml`.

Current deployment behavior:

- Only pushes to `main` trigger Pages deployment.
- `npm test` runs before deployment.
- The deployed static site is built from `public/`, `src/`, and `data/`.

The production page is usually available at:

```text
https://sfqin.github.io/lottery_ticket/
```

If the page does not update, check the GitHub Actions result and clear browser or service worker cache.

## Project Structure

```text
public/                  H5 page, styles, frontend entry, and PWA files
src/                     Lottery rules, generator, ticket checker, draw analysis, prize rules
data/                    Double Color Ball and Super Lotto history CSV files
scripts/                 Historical data import scripts
tests/                   Node.js test suite
.github/workflows/       Pages deployment and scheduled data update workflows
server.mjs               Local static server
```

## Compliance Notice

This project is for entertainment reference and personal data analysis only:

- It does not sell lottery tickets.
- It does not purchase tickets on behalf of users.
- It does not promise winning predictions.
- It does not provide prize claim, proxy claim, or redemption services.
- Official draw results and redemption rules always take priority.

Use responsibly.
