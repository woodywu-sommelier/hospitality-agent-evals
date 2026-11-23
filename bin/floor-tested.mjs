#!/usr/bin/env node
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { asterRequests } from "./requests.mjs";
import { scoreScenario } from "../src/score.mjs";
import { scoreConstance } from "../src/constance-lite.mjs";
import { bookingJobs } from "../src/booking-and-deposit.mjs";

const env = process.env;
const read = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), "utf8"));
const { scenarios, categories } = read("scenarios");
const venue = read("venue");
const { items } = read("constance-lite");
const cap = 256 * 1024;
const mask = (s) => s.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
const secretForms = (s) => s ? [s, encodeURIComponent(s), JSON.stringify(s).slice(1, -1)] : [];
const secrets = new Set([...secretForms(env.FLOOR_AGENT_URL), ...secretForms(env.FLOOR_AGENT_KEY)]);
try {
  const url = new URL(env.FLOOR_AGENT_URL);
  for (const s of [url.href, url.origin + url.pathname, ...url.searchParams.values()]) {
    if (s) for (const form of secretForms(s)) secrets.add(form);
  }
} catch { /* validate configuration below without printing any input */ }
const secretList = [...secrets].sort((a, b) => b.length - a.length);
const redact = (value) => secretList.reduce((result, s) => result.replaceAll(s, "[REDACTED]"), value);
const fence = (value) => {
  const ticks = "`".repeat((value.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length + 1), 3));
  return `${ticks}text\n${value}${value.endsWith("\n") ? "" : "\n"}${ticks}`;
};

function number(name, fallback, min, max) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) throw Error(`Invalid ${name}.`);
  return n;
}

function replyOf(value) {
  if (typeof value !== "string" || !value.trim()) throw Error("Empty or invalid reply.");
  return value;
}

async function httpReply(url, payload, timeout) {
  const response = await fetch(url, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(timeout),
    headers: { "Content-Type": "application/json", ...(env.FLOOR_AGENT_KEY ? { Authorization: `Bearer ${env.FLOOR_AGENT_KEY}` } : {}) },
    body: JSON.stringify(payload),
  });
  if (!response.ok || !response.body) throw Error("Unsuccessful agent response.");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > cap) throw Error("Reply too large.");
    chunks.push(chunk);
  }
  return replyOf(JSON.parse(Buffer.concat(chunks).toString("utf8"))?.reply);
}

function commandReply(command, payload, timeout) {
  return new Promise((resolve, reject) => {
    const childEnv = { ...env };
    for (const name of ["FLOOR_AGENT_URL", "FLOOR_AGENT_KEY", "FLOOR_AGENT_COMMAND", "GITHUB_STEP_SUMMARY", "GITHUB_OUTPUT", "GITHUB_ENV", "GITHUB_PATH"]) delete childEnv[name];
    const grouped = process.platform !== "win32";
    const child = spawn(command, { shell: true, detached: grouped, env: childEnv, stdio: ["pipe", "pipe", "ignore"] });
    let size = 0;
    let aborted = false;
    const chunks = [];
    const stop = () => {
      aborted = true;
      try { if (grouped) process.kill(-child.pid, "SIGKILL"); else child.kill("SIGKILL"); } catch { /* already exited */ }
      child.stdout.destroy();
      child.stdin.destroy();
      reject(Error("Command ran too long or returned too much data."));
    };
    const timer = setTimeout(stop, timeout);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.stdin.on("error", () => { /* exit and reply validation below handle early close */ });
    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > cap) stop();
      else chunks.push(chunk);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (aborted) return;
      try {
        if (code !== 0) throw Error("Agent command exited unsuccessfully.");
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(replyOf(text.trimStart().startsWith("{") ? JSON.parse(text)?.reply : text));
      } catch (error) { reject(error); }
    });
    child.stdin.end(JSON.stringify(payload) + "\n");
  });
}

function render(rows, packs) {
  const empty = { pass: 0, partial: 0, fail: 0, pending: 0, error: 0 };
  const counts = { ...empty };
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.category)) grouped.set(row.category, { ...empty });
    grouped.get(row.category)[row.status]++;
    counts[row.status]++;
  }
  // Only some scenarios can be judged by code. Scoring against all of them would
  // cap a perfect agent at 9/40 on Aster Room, so the badge counts the checks a
  // machine made and says plainly how many replies still need a person.
  const checked = counts.pass + counts.partial + counts.fail + counts.error;
  const score = `${counts.pass}/${checked}`;
  const percent = checked ? counts.pass * 100 / checked : 0;
  const message = counts.pending ? `${score} automated · ${counts.pending} need review` : `${score} automated`;
  const summary = [
    "# Floor-Tested", "",
    `**${counts.pass} of ${checked} automated checks passed.** ${counts.pending} of ${rows.length} replies need review by a person. Packs: ${packs.join(", ")}.`, "",
    "Floor-Tested is a scenario suite, not a test of live service and not a certification. Partial answers and missing replies count as checks that did not pass. Replies that need review are not passes and not failures.", "",
    "| Category | Pass | Partial | Fail | Needs a person | No reply |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...[...grouped].map(([category, c]) => `| ${category} | ${c.pass} | ${c.partial} | ${c.fail} | ${c.pending} | ${c.error} |`),
    "",
  ].join("\n");
  const details = rows.filter(({ status }) => ["partial", "fail", "error"].includes(status));
  const pending = rows.filter(({ status }) => status === "pending");
  const report = [summary, "## Failures, partial passes and missing replies", "",
    ...(details.length ? details.map((r) => [
      `### ${r.id}: ${r.status}`, "", ...(r.flags.length ? [fence(redact(r.flags.join("; "))), ""] : []),
      r.reply === undefined ? "No usable reply received." : fence(redact(r.reply)), "",
    ].join("\n")) : ["None.", ""]),
    "## Needs a person", "",
    ...(pending.length ? pending.map((r) => [
      `### ${r.id}: ${r.pending}`, "", fence(redact(r.reply)), "",
    ].join("\n")) : ["None."]), "",
    "Replies that need review are listed above. A sommelier review is offered separately: [For AI Teams](https://woodywusommelier.com/consulting/ai-teams/?utm_source=github&utm_medium=readme&utm_content=hospitality-agent-evals-report).", "",
  ].join("\n");
  return {
    report, summary, counts, percent, score, message,
    badge: { schemaVersion: 1, label: "floor-tested", message, color: percent >= 80 ? "brightgreen" : percent >= 50 ? "yellow" : "red" },
  };
}

async function main() {
  if (env.GITHUB_ACTIONS === "true") for (const s of secretList) console.log(`::add-mask::${mask(s)}`);
  const command = env.FLOOR_AGENT_COMMAND?.trim();
  const target = env.FLOOR_AGENT_URL?.trim();
  if (Boolean(command) === Boolean(target)) throw Error("Set exactly one agent URL or command.");
  let url;
  if (target) {
    try { url = new URL(target); } catch { throw Error("Invalid agent URL."); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw Error("Use an HTTP(S) URL without embedded credentials.");
    if (env.FLOOR_AGENT_KEY && url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      throw Error("A bearer key requires HTTPS or loopback HTTP.");
    }
  }
  const packs = [...new Set((env.FLOOR_PACKS || "aster-room").split(/[\s,]+/).filter(Boolean))];
  if (!packs.length || packs.some((pack) => !["aster-room", "constance-lite", "booking-and-deposit"].includes(pack))) {
    throw Error("Use aster-room, constance-lite or booking-and-deposit.");
  }
  const cutoff = number("FLOOR_FAIL_UNDER", null, 0, 100);
  const timeout = Math.round(1000 * number("FLOOR_TIMEOUT_SECONDS", 30, 0.01, 600));
  const delay = command && env.GITHUB_ACTIONS !== "true" ? number("FLOOR_DELAY_MS", 250, 0, 10000) : 250;
  const jobs = [];
  if (packs.includes("aster-room")) {
    for (const [index, request] of asterRequests().entries()) {
      const scenario = scenarios[index];
      jobs.push({ id: request.id, category: categories[scenario.category].name,
        messages: [{ role: "system", content: request.system }, ...request.messages],
        score: (reply) => scoreScenario(scenario, reply, venue, categories) });
    }
  }
  if (packs.includes("constance-lite")) for (const item of items) {
    jobs.push({ id: item.id, category: "Constance Lite", messages: [{ role: "user", content: item.question }],
      score: (reply) => scoreConstance(item, reply) });
  }
  if (packs.includes("booking-and-deposit")) jobs.push(...bookingJobs(read("booking-and-deposit").items));
  const rows = [];
  for (const job of jobs) {
    if (delay && rows.length) await sleep(delay);
    let reply;
    try {
      const payload = { messages: job.messages };
      reply = command ? await commandReply(command, payload, timeout) : await httpReply(url, payload, timeout);
    } catch {
      rows.push({ ...job, status: "error", flags: [] });
      continue;
    }
    const result = job.score(reply);
    const status = result.score === 2 ? "pass" : result.score === 1 ? "partial" : result.score === 0 ? "fail" : "pending";
    rows.push({ ...job, status, reply, pending: result.pending, flags: result.flags });
  }
  const result = render(rows, packs);
  const output = env.FLOOR_OUTPUT_DIR || ".";
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, "floor-tested-report.md"), result.report, { mode: 0o600 });
  writeFileSync(join(output, "floor-tested.json"), JSON.stringify(result.badge, null, 2) + "\n");
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, result.summary + "\n");
  console.log(`Floor-Tested: ${result.message}.`);
  if (result.counts.error || (cutoff !== null && result.percent < cutoff)) process.exitCode = 1;
}

main().catch(() => {
  console.error("Floor-Tested could not run. Check agent configuration and output permissions.");
  process.exitCode = 1;
});
