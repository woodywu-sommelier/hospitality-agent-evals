// The Space's page logic. It runs the same scorer and price checker as the
// command line, in the browser, so nothing a visitor pastes leaves the page.

import { validateCitedPrices } from "./src/prices.mjs";
import { scoreScenario, summarise } from "./src/score.mjs";

const load = async (path, as = "json") => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response[as]();
};
const [venue, { categories, scenarios }, exampleReplies] = await Promise.all([
  load("data/venue.json"),
  load("data/scenarios.json"),
  load("data/replies.example.jsonl", "text"),
]);

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};
const TIER_LABEL = { code: "Code", rubric: "Rubric", human: "Sommelier" };
const rubricOf = (scenario) =>
  scenario.rubric
    ? [["", scenario.rubric]]
    : Object.entries(categories[scenario.category].rubric).sort(([a], [b]) => b - a);

// One question

const system = [
  `You are the guest-facing assistant for ${venue.name}. Everything you know about the venue is below.`,
  "",
  venue.knowledge,
].join("\n");
$("system").textContent = system;
$("copy-system").addEventListener("click", async (event) => {
  await navigator.clipboard.writeText(system);
  event.target.textContent = "Copied";
});

const order = Object.keys(categories).sort((a, b) => categories[a].order - categories[b].order);
for (const key of order) {
  const group = el("optgroup", { label: categories[key].name });
  for (const s of scenarios.filter((s) => s.category === key)) {
    group.append(el("option", { value: s.id, textContent: s.turns.at(-1).content }));
  }
  $("pick").append(group);
}

function showScenario() {
  const scenario = scenarios.find((s) => s.id === $("pick").value);
  $("guest").replaceChildren(
    ...scenario.turns.map((turn, i) => {
      const last = i === scenario.turns.length - 1;
      return el("p", { className: last ? "said" : "earlier" }, [
        el("span", { className: "who", textContent: turn.role === "user" ? "Guest  " : "Agent  " }),
        turn.content,
      ]);
    }),
  );
  $("probe").textContent = `What it tests: ${scenario.probe}.`;
  showOne();
}

function showOne() {
  const scenario = scenarios.find((s) => s.id === $("pick").value);
  const reply = $("reply").value.trim();
  const out = $("one-result");
  if (!reply) return out.replaceChildren();

  const { cited, errors } = validateCitedPrices(reply, venue);
  const result = scoreScenario(scenario, reply, venue, categories);
  const nodes = [];

  if (errors.length) {
    nodes.push(el("p", { className: "verdict bad", textContent: "0 of 2. A wrong price fails the question." }));
  } else if (result.score !== null) {
    nodes.push(el("p", {
      className: `verdict ${result.score === 2 ? "good" : result.score === 0 ? "bad" : ""}`,
      textContent: `${result.score} of 2, scored by code.`,
    }));
    nodes.push(el("p", { className: "note", textContent: categories[scenario.category].rubric[result.score] }));
  } else {
    const who = result.pending === "sommelier" ? "a sommelier" : "a person or a judge";
    nodes.push(el("p", { className: "verdict", textContent: `No wrong price. The score is for ${who}.` }));
    nodes.push(el("ul", { className: "rubric" }, rubricOf(scenario).map(([score, text]) =>
      el("li", {}, [el("b", { textContent: score }), el("span", { textContent: text })]))));
  }

  if (cited.length) {
    nodes.push(el("ul", { className: "plain" }, cited.map((price) => {
      const wrong = errors.includes(price);
      return el("li", {}, [
        el("span", { textContent: price.raw }),
        el("span", { className: wrong ? "bad" : "good", textContent: wrong ? "Not what the list says" : "Matches the list" }),
      ]);
    })));
  } else {
    nodes.push(el("p", { className: "note", textContent: "No prices quoted in this reply." }));
  }
  out.replaceChildren(...nodes);
}

$("pick").addEventListener("change", showScenario);
$("reply").addEventListener("input", showOne);
$("sample").addEventListener("click", () => {
  $("pick").value = "price-02";
  $("reply").value = "Corkage is $40 per bottle, with a maximum of two bottles.";
  showScenario();
});
$("pick").value = "pair-01";
showScenario();

// A full run

function parseReplies(text) {
  const replies = new Map();
  const known = new Set(scenarios.map((s) => s.id));
  text.split(/\r?\n/).forEach((line, n) => {
    if (!line.trim()) return;
    let row;
    try { row = JSON.parse(line); } catch { throw new Error(`Line ${n + 1} is not valid JSON.`); }
    if (typeof row.id !== "string" || typeof row.reply !== "string") {
      throw new Error(`Line ${n + 1} needs an "id" and a "reply", both text.`);
    }
    if (!known.has(row.id)) throw new Error(`Line ${n + 1}: there is no question called "${row.id}".`);
    replies.set(row.id, row.reply);
  });
  if (!replies.size) throw new Error("Paste at least one reply first.");
  return replies;
}

function scoreRun() {
  const out = $("run-result");
  let replies, given = {};
  try {
    replies = parseReplies($("replies").value);
    if ($("scores").value.trim()) {
      try { given = JSON.parse($("scores").value); } catch { throw new Error("The scores are not valid JSON."); }
    }
    var results = scenarios.map((s) => scoreScenario(s, replies.get(s.id), venue, categories, given[s.id]));
  } catch (error) {
    return out.replaceChildren(el("p", { className: "verdict bad", textContent: error.message }));
  }
  const summary = summarise(results, categories);
  const answered = results.filter((r) => r.pending !== "no reply");
  const waiting = answered.filter((r) => r.score === null).length;

  const rows = summary.categories.map((c) => el("tr", {}, [
    el("td", { textContent: c.name }),
    el("td", { textContent: TIER_LABEL[c.tier] }),
    el("td", { className: "num", textContent: c.possible ? `${c.scored} / ${c.possible}` : "" }),
    el("td", { className: "num", textContent: c.pending || "" }),
  ]));
  const table = el("div", { className: "table-wrap" }, [el("table", {}, [
    el("thead", {}, [el("tr", {}, [
      el("th", { textContent: "Category" }), el("th", { textContent: "Scored by" }),
      el("th", { className: "num", textContent: "Score" }), el("th", { className: "num", textContent: "Pending" }),
    ])]),
    el("tbody", {}, rows),
  ])]);

  const headline = summary.overallPct === null
    ? `${replies.size} of ${scenarios.length} answered. No overall score yet.`
    : `${summary.scored} of ${summary.possible}, or ${summary.overallPct.toFixed(1)}%.`;
  const nodes = [el("p", { className: "verdict", textContent: headline })];
  if (summary.overallPct === null) {
    const missing = scenarios.length - replies.size;
    const parts = [];
    if (waiting) parts.push(`${waiting} answered ${waiting === 1 ? "question waits" : "questions wait"} for a person's score`);
    if (missing) parts.push(`${missing} ${missing === 1 ? "has" : "have"} no reply`);
    nodes.push(el("p", { className: "note", textContent: `${parts.join(", and ")}. A partial number gets quoted as the whole one, so none is shown.` }));
  }
  nodes.push(table);

  if (summary.wrongPrices.length) {
    nodes.push(el("p", { className: "verdict bad", style: "margin-top:20px", textContent: "Wrong prices" }));
    nodes.push(el("ul", { className: "plain" }, results.filter((r) => r.flags.length).map((r) =>
      el("li", {}, [
        el("span", { textContent: `${r.id}: ${r.flags.join("; ").replace("wrong price: ", "")}` }),
        el("span", { className: "bad", textContent: "Fails the question" }),
      ]))));
  } else {
    nodes.push(el("p", { className: "note good", style: "margin-top:16px", textContent: "No wrong price found in any reply." }));
  }
  out.replaceChildren(...nodes);
}

$("score").addEventListener("click", scoreRun);
$("load-example").addEventListener("click", () => {
  $("replies").value = exampleReplies.trim();
  scoreRun();
});
