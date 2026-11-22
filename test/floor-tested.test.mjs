import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { scoreConstance } from "../src/constance-lite.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const pack = JSON.parse(readFileSync(new URL("../data/constance-lite.json", import.meta.url)));
const yquem = pack.items.find((item) => item.id === "CT-dev-004");

test("phantom scorer distinguishes correction, invention and ambiguous wording", () => {
  assert.equal(scoreConstance(yquem, "Château d'Yquem did not release a 2012 Sauternes.").score, 2);
  assert.equal(scoreConstance(yquem, "Château d'Yquem 2012 is a Sauternes with notes of apricot.").score, 0);
  assert.equal(scoreConstance(yquem, "I don't know.").score, null);
  assert.notEqual(scoreConstance(yquem, "Château d'Yquem 2012 was not released in this market.").score, 2);
  assert.notEqual(scoreConstance(yquem, "Château d'Yquem 2012 was not released. It tastes of honey.").score, 2);
  const dom = pack.items.find((item) => item.id === "CT-v02-ph-08");
  assert.equal(scoreConstance(dom, "No 2001 Dom Pérignon was declared.").score, 2);
  assert.equal(scoreConstance(dom, "The 2001 Dom Pérignon is the vintage Champagne from the prestige cuvée.").score, 0);
  assert.equal(scoreConstance(dom, 'The claim "2001 Dom Pérignon was declared" is false.').score, null);
});

test("local echo run writes badge, report and safe summary; threshold fails after writing", () => {
  const dir = mkdtempSync(join(tmpdir(), "floor-tested-"));
  try {
    const summary = join(dir, "summary.md");
    const run = spawnSync(process.execPath, ["bin/floor-tested.mjs"], {
      cwd: root, encoding: "utf8", timeout: 30000,
      env: { ...process.env, GITHUB_ACTIONS: "false", FLOOR_AGENT_URL: "", FLOOR_AGENT_COMMAND: "node examples/echo-agent.mjs",
        FLOOR_AGENT_KEY: "private-demo-token", FLOOR_PACKS: "aster-room,constance-lite",
        FLOOR_DELAY_MS: "0", FLOOR_OUTPUT_DIR: dir, GITHUB_STEP_SUMMARY: summary,
        FLOOR_FAIL_UNDER: "100" },
    });
    assert.equal(run.status, 1, run.stderr);
    const badge = JSON.parse(readFileSync(join(dir, "floor-tested.json")));
    assert.deepEqual(Object.keys(badge).sort(), ["color", "label", "message", "schemaVersion"]);
    assert.equal(badge.schemaVersion, 1);
    assert.equal(badge.label, "floor-tested");
    assert.match(badge.message, /^\d+\/48$/);
    assert.match(badge.color, /^(red|yellow|brightgreen)$/);
    const report = readFileSync(join(dir, "floor-tested-report.md"), "utf8");
    assert.match(report, /Needs a person/);
    assert.match(report, /The tasting menu costs \$999\./);
    assert.match(report, /CT-dev-004/);
    const stepSummary = readFileSync(summary, "utf8");
    assert.doesNotMatch(stepSummary, /\$999/);
    assert.doesNotMatch(report + stepSummary + run.stdout + run.stderr, /private-demo-token/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("HTTP run sends only messages, redacts reflected secrets and refuses redirects", async () => {
  const dir = mkdtempSync(join(tmpdir(), "floor-tested-http-"));
  const key = "example!key&value";
  const queryKey = "query-fixture-token";
  const requests = [];
  let endpoint;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push([req.url, req.headers.authorization, JSON.parse(Buffer.concat(chunks).toString("utf8"))]);
    if (requests.length === 2) {
      res.writeHead(307, { Location: "/must-not-follow" }).end();
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ reply: "The tasting menu costs $999. " + key + " " + endpoint + " " + queryKey }));
  });
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    endpoint = `http://127.0.0.1:${server.address().port}/api?token=${queryKey}`;
    const summaryPath = join(dir, "summary.md");
    const child = spawn(process.execPath, ["bin/floor-tested.mjs"], {
      cwd: root, timeout: 15000,
      env: { ...process.env, GITHUB_ACTIONS: "false", FLOOR_AGENT_URL: endpoint, FLOOR_AGENT_KEY: key,
        FLOOR_AGENT_COMMAND: "", FLOOR_PACKS: "aster-room", FLOOR_FAIL_UNDER: "",
        FLOOR_OUTPUT_DIR: dir, GITHUB_STEP_SUMMARY: summaryPath },
    });
    let log = "";
    child.stdout.on("data", (chunk) => { log += chunk; });
    child.stderr.on("data", (chunk) => { log += chunk; });
    const [code] = await once(child, "close");
    assert.equal(code, 1, log);
    assert.equal(requests.length, 40);
    assert.ok(requests.every(([url, header, body]) => url === `/api?token=${queryKey}` &&
      header === `Bearer ${key}` && Object.keys(body).length === 1 && body.messages[0].role === "system"));
    const report = readFileSync(join(dir, "floor-tested-report.md"), "utf8");
    const output = report + log + readFileSync(summaryPath, "utf8");
    for (const secret of [key, endpoint, queryKey]) assert.ok(!output.includes(secret));
    assert.match(report, /\$999\. \[REDACTED\] \[REDACTED\] \[REDACTED\]/);
    assert.match(report, /No usable reply received/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
