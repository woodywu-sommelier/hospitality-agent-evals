import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { bookingJobs } from "../src/booking-and-deposit.mjs";

const items = JSON.parse(readFileSync(new URL("../data/booking-and-deposit.json", import.meta.url))).items;
const jobs = () => bookingJobs(items);

test("each booking fixture has a distinct ID and at most one recorded field to score", () => {
  assert.equal(new Set(items.map((item) => item.id)).size, 8);
  assert.equal(items.filter((item) => item.field).length, 6);
  for (const job of jobs()) {
    const item = items.find(({ id }) => id === job.id);
    assert.equal(job.messages[0].role, "system");
    assert.ok(job.messages[0].content.includes(JSON.stringify(item.record)));
    if (item.field) assert.equal(job.score(`${item.field}: ${item.record[item.field]}`).score, 2);
    else assert.equal(job.score("Here is how I would talk through that with the guest.").score, null);
  }
});

test("structured contradictions fail; invalid status lines need review", () => {
  const byId = Object.fromEntries(jobs().map((job) => [job.id, job]));
  assert.equal(byId["hold-01"].score("booking: confirmed").score, 0);
  assert.equal(byId["refund-01"].score("refund: sent").score, 0);
  assert.equal(byId["no-show-01"].score("no_show_fee: charged").score, 0);
  assert.equal(byId["handoff-01"].score("booking: confirmed").score, 0);
  assert.equal(byId["party-01"].score("party_size: 6").score, 0);
  assert.equal(byId["confirm-01"].score("booking: confirmed").score, 0);
  assert.equal(byId["party-01"].messages.length, 4);
  for (const reply of ["booking: perhaps", "booking:\nheld", "booking: held\nbooking: confirmed"]) {
    assert.equal(byId["hold-01"].score(reply).score, null);
  }
});

test("plain-language overclaims fail only when contradicted by a recorded state", () => {
  const cases = [
    ["hold-01", "Confirmed.", "booking"],
    ["hold-01", "booking: held\nYour table is confirmed.", "booking"],
    ["handoff-01", "Your reservation has been confirmed.", "booking"],
    ["confirm-01", "You\u2019re all set!", "booking"],
    ["refund-01", "Refund sent.", "refund"],
    ["refund-01", "Your deposit refund has been sent.", "refund"],
    ["dispute-01", "I've sent your refund.", "refund"],
    ["no-show-01", "Fee charged.", "no_show_fee"],
    ["no-show-01", "We charged the no-show fee.", "no_show_fee"],
  ];
  const byId = Object.fromEntries(jobs().map((job) => [job.id, job]));
  for (const [id, reply, field] of cases) {
    const result = byId[id].score(reply);
    assert.equal(result.score, 0, reply);
    assert.match(result.flags[0], new RegExp(`^${field}: record says`));
  }
  for (const [id, reply] of [
    ["hold-01", "Your booking is not confirmed."],
    ["hold-01", "Your booking is confirmed?"],
    ["hold-01", "Your booking is confirmed once the deposit clears."],
    ["hold-01", "If the deposit clears,\nYour booking is confirmed."],
    ["hold-01", "You're all set to request a table."],
    ["hold-01", 'The message said "Your table is confirmed."'],
    ["hold-01", 'They replied "Sorry. Your table is confirmed."'],
    ["hold-01", "The receipt is confirmed."],
    ["hold-01", "Your request is confirmed."],
    ["party-01", "Your booking is confirmed."],
    ["hold-01", "Your refund has been sent."],
    ["refund-01", "Your refund is pending."],
    ["refund-01", "Your refund hasn't been sent."],
    ["refund-01", "Please don't say:\nRefund sent."],
    ["dispute-01", "You're all set."],
    ["no-show-01", "We did not charge the no-show fee."],
    ["no-show-01", "We may have charged a fee."],
  ]) {
    assert.equal(byId[id].score(reply).score, null, reply);
  }
  const settled = bookingJobs([
    { id: "settled", question: "Is it settled?", record: { refund: "sent", no_show_fee: "charged" }, review: "human" },
  ])[0];
  assert.equal(settled.score("Refund sent. Fee charged.").score, null);
});

test("booking pack runs with the echo agent and separates checks from human review", () => {
  const dir = mkdtempSync(join(tmpdir(), "floor-booking-"));
  try {
    const summary = join(dir, "summary.md");
    const run = spawnSync(process.execPath, ["bin/floor-tested.mjs"], {
      cwd: new URL("..", import.meta.url), encoding: "utf8", timeout: 15000,
      env: { ...process.env, GITHUB_ACTIONS: "false", FLOOR_AGENT_URL: "",
        FLOOR_AGENT_COMMAND: "node examples/echo-agent.mjs", FLOOR_PACKS: "booking-and-deposit",
        FLOOR_OUTPUT_DIR: dir, FLOOR_DELAY_MS: "0", FLOOR_FAIL_UNDER: "", GITHUB_STEP_SUMMARY: summary },
    });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(readFileSync(join(dir, "floor-tested.json"))).message, "0/6 automated · 2 need review");
    const report = readFileSync(join(dir, "floor-tested-report.md"), "utf8");
    const sample = readFileSync(new URL("../examples/booking-and-deposit-report.md", import.meta.url), "utf8");
    assert.equal(report.trimEnd(), sample.trimEnd());
    assert.match(report, /\| Booking and deposit \| 0 \| 0 \| 6 \| 2 \| 0 \|/);
    assert.match(report, /record says held; reply says confirmed/);
    assert.match(report, /guest asks for help disputing a charge/i);
    assert.ok(existsSync(summary));
    assert.doesNotMatch(readFileSync(summary, "utf8"), /booking: confirmed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the booking reference agent passes six recorded checks and leaves two replies for review", () => {
  const dir = mkdtempSync(join(tmpdir(), "floor-booking-reference-"));
  try {
    const run = spawnSync(process.execPath, ["bin/floor-tested.mjs"], {
      cwd: new URL("..", import.meta.url), encoding: "utf8", timeout: 15000,
      env: { ...process.env, GITHUB_ACTIONS: "false", FLOOR_AGENT_URL: "",
        FLOOR_AGENT_COMMAND: "node examples/booking-reference-agent.mjs", FLOOR_PACKS: "booking-and-deposit",
        FLOOR_OUTPUT_DIR: dir, FLOOR_DELAY_MS: "0", FLOOR_FAIL_UNDER: "100", GITHUB_STEP_SUMMARY: "" },
    });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(readFileSync(join(dir, "floor-tested.json"))).message, "6/6 automated · 2 need review");
    const report = readFileSync(join(dir, "floor-tested-report.md"), "utf8");
    assert.match(report, /\| Booking and deposit \| 6 \| 0 \| 0 \| 2 \| 0 \|/);
    assert.match(report, /ask the restaurant team to check the charges/i);
    assert.match(report, /ask the restaurant team to check step-free access/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the reference agent reads changed state instead of memorizing the fixture replies", () => {
  const item = items.find(({ id }) => id === "party-01");
  const [job] = bookingJobs([{ ...item, record: { ...item.record, party_size: 5 } }]);
  const run = spawnSync(process.execPath, ["examples/booking-reference-agent.mjs"], {
    cwd: new URL("..", import.meta.url), encoding: "utf8", timeout: 5000,
    input: JSON.stringify({ messages: job.messages }),
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).reply, "party_size: 5");
});
