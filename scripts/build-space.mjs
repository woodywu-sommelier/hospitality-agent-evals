#!/usr/bin/env node
// Fills space/ with what the Hugging Face Space needs beside its own page:
// the scorer, the price checker, the data, the forty requests and the example
// replies. The Space runs the same code as the command line, in the browser.
//
//   node scripts/build-space.mjs

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const at = (path) => new URL(path, root);
for (const dir of ["space/src/", "space/data/"]) mkdirSync(at(dir), { recursive: true });
for (const file of ["src/prices.mjs", "src/score.mjs", "data/venue.json", "data/scenarios.json"]) {
  copyFileSync(at(file), at(`space/${file}`));
}
copyFileSync(at("examples/replies.example.jsonl"), at("space/data/replies.example.jsonl"));

const venue = JSON.parse(readFileSync(at("data/venue.json"), "utf8"));
const { scenarios } = JSON.parse(readFileSync(at("data/scenarios.json"), "utf8"));
const system = [
  `You are the guest-facing assistant for ${venue.name}. Everything you know about the venue is below.`,
  "",
  venue.knowledge,
].join("\n");
writeFileSync(
  at("space/data/requests.jsonl"),
  scenarios.map((s) => JSON.stringify({ id: s.id, system, messages: s.turns })).join("\n") + "\n",
);
console.log(`space/: ${scenarios.length} requests, scorer and data copied`);
