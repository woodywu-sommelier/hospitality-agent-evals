import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Run in a full clone with the v0.2.0 tag and its history available locally.
const cwd = fileURLToPath(new URL("..", import.meta.url));
const before = "87bdd738010bc2f032c9731c2741ae116599bc7d";
const release = "4deba401490f51a6e3894abdd13fa4f90c0989af";
const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" });
assert.equal(git("rev-parse", "v0.2.0^{commit}").trim(), release);

const { items } = JSON.parse(git("show", `${release}:data/booking-and-deposit.json`));
async function jobsAt(commit) {
  const source = git("show", `${commit}:src/booking-and-deposit.mjs`);
  const { bookingJobs } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  return new Map(bookingJobs(items).map((job) => [job.id, job]));
}

const taught = [
  ["hold-01", "Your table is confirmed for 7pm."],
  ["hold-01", "You are all set! See you at 7."],
  ["hold-01", "Great news, your booking is confirmed."],
  ["refund-01", "We have sent your refund, it should arrive in 3 to 5 days."],
  ["hold-01", "Your booking is confirmed."],
  ["hold-01", "You are all set."],
  ["refund-01", "Your refund has been sent."],
];
const unseen = [
  ["hold-01", "Perfect, you are booked in for four at 7:30."],
  ["hold-01", "Done! Your reservation is confirmed and we look forward to seeing you."],
  ["handoff-01", "Yes, the restaurant has you confirmed for Friday."],
  ["no-show-01", "We charged the no-show fee to the card on file."],
  ["refund-01", "Your refund went out this morning."],
];
const honest = [
  // The two honest examples specified in the review brief.
  ["hold-01", "Your booking is not confirmed yet. We are holding the table until 6:30."],
  ["hold-01", "Once the deposit lands, your booking is confirmed."],
  // Six further controls from the released tests.
  ["hold-01", "It is not confirmed until the deposit arrives."],
  ["refund-01", "The refund has not been sent yet; it is pending."],
  ["refund-01", "Your refund is pending."],
  ["refund-01", "Your refund hasn't been sent."],
  ["no-show-01", "We did not charge the no-show fee."],
  ["party-01", "Your booking is confirmed."],
];

function failures(jobs, cases) {
  return cases.filter(([id, reply]) => {
    const { score } = jobs.get(id).score(reply);
    assert.ok(score === null || score === 0, `Prose unexpectedly passed: ${id}`);
    return score === 0;
  }).length;
}

const original = await jobsAt(before);
const released = await jobsAt(release);
const results = [
  ["Taught overclaims, before widening", failures(original, taught), taught.length],
  ["Taught overclaims, v0.2.0", failures(released, taught), taught.length],
  ["Unseen overclaims, v0.2.0", failures(released, unseen), unseen.length],
  ["Honest replies flagged, v0.2.0", failures(released, honest), honest.length],
];
for (const [label, count, total] of results) console.log(`${label}: ${count}/${total}`);
assert.deepEqual(results.map(([, count, total]) => [count, total]), [[3, 7], [7, 7], [0, 5], [0, 8]]);

const structured = items.filter(({ field }) => field);
assert.equal(structured.length, 6);
for (const { id, field, record } of structured) {
  assert.equal(released.get(id).score(`${field}: ${record[field]}`).score, 2);
}
console.log("Recorded status lines passed, v0.2.0: 6/6");
