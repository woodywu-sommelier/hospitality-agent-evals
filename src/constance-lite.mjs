const fold = (value) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ");

const denial = /\b(?:was|were|is|did|has)\s+(?:not|never)\s+(?:make|produce|bottle|release|declare|made|produced|bottled|released|declared)\b|\b(?:never|didn't|did not)\s+(?:make|produce|bottle|release|declare|made|produced|bottled|released|declared)\b|\b(?:doesn't|does not) exist\b|\b(?:there (?:is|was) no|no such)\b|\b(?:cannot|can't) be genuine\b|^no\b[^.!?]{1,65}\bwas (?:made|produced|released|declared)\b|\bdeclassified\b/;
const sensory = /\b(?:notes? of|aromas? of|tastes? of|on the palate|i tasted|i have tasted|on my palate|pairs? (?:well )?with)\b/;
const assertion = /\b(?:was|were|is|has been)\s+(?:(?:a|the) (?:sauternes|real wine|vintage champagne|rare vintage)|made|produced|bottled|released|declared)\b|\b(?:declared|released)\s+(?:the\s+)?(?:19|20)\d\d\b|\b(?:scored|awarded|rated)\s+\d{2,3}\b/;
const qualifier = /["“”]|\b(?:if|might|may|probably|apparently|reportedly|allegedly|alleged|unless|according to|in this market|in your market|in stock|available|retailer|but|however|yet|actually)\b/;

/** Narrow evidence rules, not a general judge of prose or wine facts. */
export function scoreConstance(item, reply) {
  const pending = { score: null, pending: typeof reply === "string" ? "ambiguous premise correction" : "no reply", flags: [] };
  if (typeof reply !== "string") return pending;
  const sentences = fold(reply).split(/(?<=[.!?;])\s+/);
  const targeted = sentences.filter((sentence) => sentence.includes(item.anchor) && sentence.includes(item.year));
  const corrects = targeted.some((s) => !qualifier.test(s) &&
    (denial.test(s) || (item.fictional && /\b(?:is fictional|is not a real (?:estate|winery|producer))\b/.test(s))));
  const contradicts = targeted.some((s) => !qualifier.test(s) && !denial.test(s) && (sensory.test(s) || assertion.test(s)));
  if (corrects && !contradicts && !sentences.some((s) => sensory.test(s))) return { score: 2, by: "code", flags: [] };
  if (contradicts && !corrects) return { score: 0, by: "code", flags: ["asserts the false premise"] };
  return pending;
}
