#!/usr/bin/env node
// Builds the Hugging Face dataset folder from data/, so the two never drift.
// Output: huggingface/ (upload its contents to the dataset repo as they are).
//
//   node scripts/build-huggingface.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const venue = read("../data/venue.json");
const { categories, scenarios } = read("../data/scenarios.json");
const pkg = read("../package.json");
const out = new URL("../huggingface/", import.meta.url);
mkdirSync(out, { recursive: true });

const jsonl = (rows) => rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
const write = (name, text) => writeFileSync(new URL(name, out), text);

// One row per scenario, every row the same shape, so the dataset viewer can show it.
const scenarioRows = scenarios.map((s) => {
  const c = categories[s.category];
  return {
    id: s.id,
    category: s.category,
    category_name: c.name,
    category_order: c.order,
    tier: s.tier ?? c.tier,
    probe: s.probe,
    turns: s.turns,
    expects: s.expects ?? null,
    requires_prices: s.requires ?? [],
    forbids_vintage: s.forbidsVintage ?? false,
    rubric_override: s.rubric ?? null,
    rubric_2: c.rubric["2"],
    rubric_1: c.rubric["1"],
    rubric_0: c.rubric["0"],
  };
});

const categoryRows = Object.entries(categories)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([key, c]) => ({ key, order: c.order, name: c.name, tier: c.tier, rubric_2: c.rubric["2"], rubric_1: c.rubric["1"], rubric_0: c.rubric["0"] }));

const listRows = [
  ...venue.wineItems.map((item) => ({ ...item, kind: "wine by the glass" })),
  ...venue.zeroProofItems.map((item) => ({ ...item, kind: "zero proof" })),
  ...venue.otherPricedItems.map((item) => ({ ...item, kind: "other priced item" })),
].map(({ name, price, kind }) => ({ name, price_cad: price, kind }));

write("scenarios.jsonl", jsonl(scenarioRows));
write("categories.jsonl", jsonl(categoryRows));
write("list.jsonl", jsonl(listRows));
write("venue_knowledge.md", venue.knowledge);

const GITHUB = "https://github.com/woodywu-sommelier/hospitality-agent-evals";
const card = `---
license: cc-by-4.0
language:
- en
- zh
pretty_name: "Hospitality Agent Evals: The Aster Room"
size_categories:
- n<1K
task_categories:
- text-generation
- question-answering
tags:
- evaluation
- benchmark
- hospitality
- restaurants
- wine
- sommelier
- agents
configs:
- config_name: scenarios
  data_files: scenarios.jsonl
  default: true
- config_name: categories
  data_files: categories.jsonl
- config_name: list
  data_files: list.jsonl
---

# Hospitality Agent Evals: The Aster Room

Forty questions a guest asks a restaurant's AI about wine, the list to answer them from, and a 0 / 1 / 2 rubric for each.

These are the questions I test The House Somm with, the AI sommelier I built, adapted so anyone can run them against any agent. The venue, The Aster Room, is fictional. Every producer, price and policy in it was invented for this set.

**The price checker and the scorer are on GitHub:** ${GITHUB}

## Why it exists

The failures that cost a restaurant money are specific: a wrong price, a bottle that is not on the list, a region instead of a recommendation, a booking the agent cannot make, a sales pitch in reply to a statement. A sommelier notices every one at once. A generic eval notices none of them.

## Files

| File | What it is |
|---|---|
| \`scenarios.jsonl\` | 40 scenarios, 8 categories of 5: the guest's turns, the scoring tier, and the rubric |
| \`categories.jsonl\` | The 8 categories, their tier and rubric |
| \`list.jsonl\` | The priced list, the ground truth for price checks (Canadian dollars) |
| \`venue_knowledge.md\` | The knowledge text the agent under test is given as its system context |

## How to use it

Give your agent \`venue_knowledge.md\` as its context and each scenario's \`turns\` as the conversation. Score its answer to the last guest turn.

Scoring has three tiers. **code**: checked against \`list.jsonl\` by counting and by price matching (the GitHub scorer does this). **rubric**: scored by a person or a model judge you name in your report. **human**: taste, scored by a sommelier, never automated.

One rule outranks the tiers: a wrong price fails the scenario, whatever it was testing. Report the category table, not one number, and report no overall score until every scenario has one.

## Categories

${categoryRows.map((c) => `${c.order}. **${c.name}** (${c.tier})`).join("\n")}

## Limits

One fictional venue, one by-the-glass list, Canadian dollars, English and Chinese, mostly single turns. It does not test voice, real booking systems or a list of hundreds of bottles.

## License and citation

CC BY 4.0. Credit "Woody Wu, Hospitality Agent Evals". The code on GitHub is MIT.

> Wu, Woody. *Hospitality Agent Evals: The Aster Room*. 2026. ${GITHUB}

## About

Woody Wu is a sommelier, hospitality operator and AI builder in Western Canada, with dual WSET and ISG Diplomas, who writes The Floor and the Terminal and built The House Somm. For teams building AI for restaurants, hotels, bars and wine retail: https://woodywusommelier.com/consulting/ai-teams/

Version ${pkg.version}.
`;
write("README.md", card);
console.log(`huggingface/: ${scenarioRows.length} scenarios, ${categoryRows.length} categories, ${listRows.length} list items`);
