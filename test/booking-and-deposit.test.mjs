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

test("contradictory claims fail; prose, unsupported values and mixed assertions need review", () => {
  const byId = Object.fromEntries(jobs().map((job) => [job.id, job]));
  assert.equal(byId["hold-01"].score("booking: confirmed").score, 0);
  assert.equal(byId["refund-01"].score("refund: sent").score, 0);
  assert.equal(byId["no-show-01"].score("no_show_fee: charged").score, 0);
  assert.equal(byId["handoff-01"].score("booking: confirmed").score, 0);
  assert.equal(byId["party-01"].score("party_size: 6").score, 0);
  assert.equal(byId["confirm-01"].score("booking: confirmed").score, 0);
  assert.equal(byId["party-01"].messages.length, 4);
  for (const reply of ["You're all set.", "booking: perhaps", "booking:\nheld", "booking: held\nbooking: confirmed", "booking: held\nYour table is confirmed."]) {
    assert.equal(byId["hold-01"].score(reply).score, null);
  }
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
