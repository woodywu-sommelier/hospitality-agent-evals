// Scoring, 0 / 1 / 2 per scenario, in three tiers:
//
//   code     scored here, by counting or by checking against the list
//   rubric   scored by a person, or by a model judge you name in the report
//   human    taste, scored by a sommelier. Never automated.
//
// A pending score is not a gap in the harness. It is the point: whether a pairing
// is right is a judgment, and a number that pretends otherwise is worth less than
// no number. There is no overall score until every scenario has one.
//
// One rule outranks the tiers: a wrong price fails the scenario, whatever the
// scenario was testing. A guest who is quoted the wrong price was served badly,
// however good the pairing.

import { validateCitedPrices } from "./prices.mjs";

// A guest types "Kuhn-Weiss" and an agent may write it that way. Matching the
// exact glyph would score correct service as a miss, so both sides are folded.
const fold = (value) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** List items named in a reply, by their distinctive head: "Rousset-Bellay". */
export function namedItems(reply, venue) {
  const text = fold(reply);
  return [...venue.wineItems, ...venue.zeroProofItems].filter((item) => {
    const head = fold(item.name.split(",")[0].trim());
    return head.length > 3 && text.includes(head);
  });
}

/** Three named options at three different prices. */
export function scoreThreeOptions(reply, venue) {
  const named = namedItems(reply, venue);
  if (named.length === 0) return 0;
  const pricePoints = new Set(named.map((item) => item.price)).size;
  return named.length >= 3 && pricePoints >= 3 ? 2 : 1;
}

/**
 * For a guest who states a budget but not a dish. A sommelier asks what they are
 * eating; recommending a bottle blind is the failure the scenario exists to catch.
 */
export function scoreClarifyingQuestion(reply, venue) {
  if (namedItems(reply, venue).length > 0) return 0;
  return /\?|？/.test(reply) ? 2 : 1;
}

const VINTAGE = /\b(?:19[5-9]\d|20[0-3]\d)\b/;

/** List and price accuracy. The list is the ground truth, not a model. */
export function scorePrice(scenario, reply, venue) {
  const { cited, errors } = validateCitedPrices(reply, venue);
  if (errors.length > 0) return 0;
  // The list carries no vintages, so any year quoted for a bottle was invented.
  if (scenario.forbidsVintage && VINTAGE.test(reply)) return 0;
  const quoted = new Set(cited.filter((c) => c.currency === "CAD").map((c) => c.amount));
  if ((scenario.requires ?? []).some((amount) => !quoted.has(amount))) return 1;
  return 2;
}

export function tierOf(scenario, categories) {
  return scenario.tier ?? categories[scenario.category].tier;
}

/**
 * One scenario's outcome. `reply` is the agent's answer to the last user turn,
 * or undefined if the agent was not run on it. `given` is a 0, 1 or 2 from a
 * person or a judge, for the rubric and human tiers.
 */
export function scoreScenario(scenario, reply, venue, categories, given) {
  const category = categories[scenario.category];
  const base = {
    id: scenario.id,
    category: scenario.category,
    categoryName: category.name,
    tier: tierOf(scenario, categories),
    probe: scenario.probe,
    flags: [],
  };
  if (typeof reply !== "string") return { ...base, score: null, pending: "no reply" };

  const { errors } = validateCitedPrices(reply, venue);
  if (errors.length > 0) {
    return {
      ...base,
      score: 0,
      by: "code",
      flags: [`wrong price: ${errors.map((e) => e.raw).join(", ")}`],
    };
  }

  if (base.tier === "code") {
    const score =
      scenario.category === "price" ? scorePrice(scenario, reply, venue)
      : scenario.expects === "clarifying_question" ? scoreClarifyingQuestion(reply, venue)
      : scoreThreeOptions(reply, venue);
    return { ...base, score, by: "code" };
  }

  if (given === undefined) {
    return { ...base, score: null, pending: base.tier === "human" ? "sommelier" : "rubric" };
  }
  if (![0, 1, 2].includes(given)) throw new Error(`${scenario.id}: a score must be 0, 1 or 2, got ${given}`);
  return { ...base, score: given, by: base.tier };
}

/** The report, honest about what is not yet scored. */
export function summarise(results, categories) {
  const byCategory = new Map();
  for (const key of Object.keys(categories).sort((a, b) => categories[a].order - categories[b].order)) {
    byCategory.set(key, { key, name: categories[key].name, tier: categories[key].tier, scored: 0, possible: 0, pending: 0 });
  }
  for (const r of results) {
    const c = byCategory.get(r.category);
    if (r.score === null) c.pending += 1;
    else { c.scored += r.score; c.possible += 2; }
  }
  const cats = [...byCategory.values()];
  const pending = cats.reduce((n, c) => n + c.pending, 0);
  const scored = cats.reduce((n, c) => n + c.scored, 0);
  const possible = cats.reduce((n, c) => n + c.possible, 0);
  return {
    categories: cats,
    scored,
    possible,
    pending,
    // Deliberately absent until every scenario is scored. A partial number gets
    // quoted as the whole one.
    overallPct: pending === 0 && possible > 0 ? (scored / possible) * 100 : null,
    wrongPrices: results.filter((r) => r.flags.some((f) => f.startsWith("wrong price"))).map((r) => `${r.id}: ${r.flags.join("; ")}`),
  };
}
