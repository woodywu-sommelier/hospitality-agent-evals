// The price checker. Every price an agent quotes is read out of its reply and
// checked against the venue's list: an unknown amount is wrong, a price in the
// wrong currency is wrong, and a real price attached to the wrong bottle is wrong.
//
// It is built to miss rather than to accuse. A price it cannot attach to a named
// item is only checked against the set of prices on the list, so "$24" after no
// named wine passes because something on the list costs $24. Attaching a price to
// the wrong bottle would report a correct answer as an error, and an error rate
// has to run in the understating direction to be worth publishing.

function searchable(value) {
  return value.normalize("NFKC").toLocaleLowerCase("en-CA");
}

function amountFrom(raw) {
  return Number(raw.replaceAll(",", ""));
}

// "Everything under $25" repeats the guest's budget; it is not a price for anything.
// A ceiling or a floor is skipped, so an agent is never marked wrong for echoing
// the guest. "About $24" is still checked: that is a quote, however hedged.
const LIMIT_BEFORE = /(?:under|over|below|above|up to|less than|more than|no more than|at most|at least|within)\s*$/i;
// "$25 or under" puts the limit word after the amount.
const LIMIT_AFTER = /^\s*(?:以内|以下|以上|之内|(?:or|and)\s+(?:under|less|below|lower|over|more|above|up)\b)/i;

function isLimit(value, index, length) {
  return LIMIT_BEFORE.test(value.slice(Math.max(0, index - 16), index)) || LIMIT_AFTER.test(value.slice(index + length));
}

/** Prices quoted in a reply: $16, $ 21.00, CAD 24, CA$28, 12元, 13 加元, 17美元. */
export function extractCitedPrices(value) {
  const matches = [];
  const prefix = /(?:CA\$|CAD\s*|\$)\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)(?!\d|[.,]\d)/gi;
  // Only a Latin letter or digit after 元 makes it part of something else. Chinese
  // runs straight on ("16加元到42加元"), and those are prices.
  const suffix = /(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(加元|美元|元)(?![A-Za-z0-9])/gu;

  for (const match of value.matchAll(prefix)) {
    if (isLimit(value, match.index, match[0].length)) continue;
    matches.push({ raw: match[0], amount: amountFrom(match[1]), index: match.index, currency: "CAD" });
  }
  for (const match of value.matchAll(suffix)) {
    if (isLimit(value, match.index, match[0].length)) continue;
    matches.push({
      raw: match[0],
      amount: amountFrom(match[1]),
      index: match.index,
      currency: match[2] === "美元" ? "USD" : "CAD",
    });
  }
  return matches.sort((a, b) => a.index - b.index);
}

// A full stop, question or exclamation mark followed by a space, a semicolon, a
// Chinese full stop, or a line break. "No. 3" counts as a break; that only ever
// stops an association, so it can miss an error but never invent one.
const SENTENCE_BREAK = /[.!?;]\s|[。！？；\n]/;

export function allItems(venue) {
  return [...venue.wineItems, ...venue.zeroProofItems, ...venue.otherPricedItems];
}

function occurrencesOf(haystack, needle, item) {
  const found = [];
  let from = 0;
  while (from < haystack.length) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) break;
    found.push({ index, end: index + needle.length, item });
    from = index + needle.length;
  }
  return found;
}

/** The distinctive head of a list entry: "Rousset-Bellay, Gevrey-Chambertin" -> "rousset-bellay". */
function headOf(name) {
  return searchable(name.split(",")[0].trim());
}

// The list stores "Kühn-Weiss, Riesling Trocken, Mosel". An agent writes "the
// Kühn-Weiss Riesling Trocken from the Mosel". So: the stored entry first, then
// the distinctive head. A head shared by two items identifies neither, and a head
// of three letters or fewer is not distinctive, so neither is used.
function itemMentions(value, items) {
  const haystack = searchable(value);
  const headUses = new Map();
  for (const item of items) {
    const head = headOf(item.name);
    headUses.set(head, (headUses.get(head) ?? 0) + 1);
  }
  return items
    .flatMap((item) => {
      const full = searchable(item.name);
      const byFull = occurrencesOf(haystack, full, item);
      if (byFull.length > 0) return byFull;
      const head = headOf(item.name);
      if (head === full || head.length <= 3 || (headUses.get(head) ?? 0) > 1) return [];
      return occurrencesOf(haystack, head, item);
    })
    .sort((a, b) => a.index - b.index);
}

/** Every quoted price, and the ones that are wrong. */
export function validateCitedPrices(value, venue) {
  const cited = extractCitedPrices(value);
  const items = allItems(venue);
  const knownPrices = new Set(items.map((item) => item.price));
  const named = itemMentions(value, items);
  const errors = cited.filter((price) => {
    if (price.currency !== "CAD" || !knownPrices.has(price.amount)) return true;
    // A price belongs to the last item named before it in the same sentence, unless
    // another item is named between them. Across a sentence break the name and the
    // price are about different things: "Clos Verrier is worth trying. The tasting
    // menu is $165" does not price the Crémant at $165.
    const priorItem = named.filter((mention) => mention.end <= price.index).at(-1);
    const nextItem = named.find((mention) => mention.index > (priorItem?.index ?? -1));
    // An item takes only the first price after it. In "the tasting menu is $165,
    // with pairings at $95 or $155" the later amounts price something else, and in
    // "the Étienne Farge ($38) and the Crozes-Hermitage ($24)" the $24 belongs to a
    // wine named by appellation alone. Both came from real model replies.
    const isAssociated =
      priorItem !== undefined &&
      (nextItem === undefined || price.index < nextItem.index) &&
      !SENTENCE_BREAK.test(value.slice(priorItem.end, price.index)) &&
      !cited.some((other) => other.index >= priorItem.end && other.index < price.index);
    return isAssociated && priorItem.item.price !== price.amount;
  });
  return { cited, errors };
}
