import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractCitedPrices, validateCitedPrices } from "../src/prices.mjs";

const venue = JSON.parse(readFileSync(new URL("../data/venue.json", import.meta.url), "utf8"));
const wrong = (text) => validateCitedPrices(text, venue).errors.map((e) => e.raw);

test("reads English and Chinese Canadian-dollar formats without partial matches", () => {
  assert.deepEqual(
    extractCitedPrices("$16, $ 21.00, CAD 24, CA$28, 12元, 13 加元, 17美元").map(({ raw, amount, currency }) => ({ raw, amount, currency })),
    [
      { raw: "$16", amount: 16, currency: "CAD" },
      { raw: "$ 21.00", amount: 21, currency: "CAD" },
      { raw: "CAD 24", amount: 24, currency: "CAD" },
      { raw: "CA$28", amount: 28, currency: "CAD" },
      { raw: "12元", amount: 12, currency: "CAD" },
      { raw: "13 加元", amount: 13, currency: "CAD" },
      { raw: "17美元", amount: 17, currency: "USD" },
    ],
  );
  assert.deepEqual(extractCitedPrices("$16.50 and $16,000").map(({ amount }) => amount), [16.5, 16000]);
});

test("attaches each price to the item named before it", () => {
  assert.deepEqual(wrong("Vallon des Pierres, Côtes du Rhône at $16, Ridgeline Estate, Okanagan Syrah at $21, and Domaine Chapelle-Noire, Crozes-Hermitage at $24."), []);
  assert.deepEqual(wrong("Vallon des Pierres, Côtes du Rhône at $17, Ridgeline Estate, Okanagan Syrah at $21."), ["$17"]);
  assert.deepEqual(wrong("Vallon des Pierres, Côtes du Rhône 16加元，Ridgeline Estate, Okanagan Syrah 21元。"), []);
  assert.deepEqual(wrong("Vallon des Pierres, Côtes du Rhône 17美元。"), ["17美元"]);
  assert.deepEqual(wrong("Vallon des Pierres, Côtes du Rhône is $16, and the mystery pour is $99."), ["$99"]);
});

test("reads names the way an agent writes them, not the way the list stores them", () => {
  const natural = validateCitedPrices(
    "The Vallon des Pierres, Côtes du Rhône at $16 is bright and peppery, "
      + "the Ridgeline Estate Okanagan Syrah from the valley is $21, "
      + "and the Domaine Chapelle-Noire Crozes-Hermitage at $24 is the step up.",
    venue,
  );
  assert.equal(natural.cited.length, 3);
  assert.deepEqual(natural.errors, []);
  // $24 is a real price on this list, so this can only fail by association.
  assert.deepEqual(wrong("The Ridgeline Estate Okanagan Syrah is $24 tonight."), ["$24"]);
});

test("a guest's budget echoed back is not a quoted price", () => {
  assert.deepEqual(wrong("Most of the list sits under $25, so tell me the dish."), []);
  assert.deepEqual(wrong("Anything up to $30 works. 30加元以内都可以。"), []);
  // A hedged quote is still a quote.
  assert.deepEqual(wrong("The Rousset-Bellay is about $45."), ["$45"]);
});

test("errors run in the understating direction", () => {
  // "Gevrey-Chambertin" alone is the appellation, not the producer, so no item is
  // named and $45 passes because corkage costs $45. A miss, never a false accusation.
  assert.deepEqual(wrong("The Gevrey-Chambertin is about $45."), []);
});

test("multi-thousand amounts match the private room minimums", () => {
  assert.deepEqual(wrong("The Vault minimum on a Friday is $4,000."), []);
  assert.deepEqual(wrong("The Vault minimum on a Friday is $3,500."), ["$3,500"]);
});

test("a price is never pinned to a wine named in an earlier sentence", () => {
  // A real House Somm reply, 2026-10-04. Every price in it is right: the tasting
  // menu is $165 and the pairings are 95 and 155. The checker once pinned all three
  // to Clos Verrier, named a sentence earlier, and failed a correct answer.
  const reply = "小农香槟可以说是我们的招牌，目前有Maison Perrot和Clos Verrier两款配额酒，都很值得一试。"
    + "\n\n如果您想按杯点，价格从16加元到42加元不等。另外，如果您点7道菜的品鉴菜单($165/位)，我们也设计了专门的配酒方案，经典版95加元，珍藏版155加元。";
  const { cited, errors } = validateCitedPrices(reply, venue);
  assert.deepEqual(cited.map((c) => c.amount), [16, 42, 165, 95, 155], "Chinese prices followed by Chinese text are read");
  assert.deepEqual(errors, []);
  // Within a sentence, association still catches a wrong price.
  assert.deepEqual(wrong("Clos Verrier两款配额酒，每杯28加元。"), ["28加元"]);
  assert.deepEqual(wrong("The Clos Verrier is lovely. It is $28 a glass."), [], "across a sentence, a real list price passes");
});

// Three false alarms found on 9 Nov 2026 by running real model replies through
// the checker. Each sentence below is correct against the list.
test("an item takes only the first price after it", () => {
  assert.deepEqual(wrong("The 7-course tasting menu is $165 per person, with wine pairings at $95 (classic) or $155 (cellar reserve)."), []);
  assert.deepEqual(wrong("The Étienne Farge, Saint-Aubin 1er Cru ($38) suits the sablefish, and the Crozes-Hermitage ($24) suits the lamb."), []);
  // The first price after a named item is still checked.
  assert.deepEqual(wrong("The 7-course tasting menu is $155 per person, with wine pairings at $95."), ["$155"]);
});

test("a limit written after the amount is not a quote", () => {
  assert.deepEqual(wrong("Here are three good picks at $25 or under, each at a different price."), []);
  assert.deepEqual(wrong("Here are the by-the-glass wines at $25 or less."), []);
});
