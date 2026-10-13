# Hospitality Agent Evals: The Aster Room

Forty questions a guest asks a restaurant's AI about wine, the list to answer them from, and a scorer that is honest about what a script can and cannot judge.

These are the questions I test The House Somm with, the AI sommelier I built, adapted so anyone can run them against any agent. The venue, The Aster Room, is fictional. Every producer, price and policy in it was invented for this test set.

The data is also on Hugging Face, with a browsable table: https://huggingface.co/datasets/aigoalieunbeatable/hospitality-agent-evals

## Why this exists

The failures that cost a restaurant money are specific, and most general benchmarks do not look for them:

- **A wrong price.** The agent says $26 and the list says $24. The guest is upset when the bill arrives, and that complaint goes to staff.
- **A bottle that is not on the list.** Asked for Screaming Eagle, the agent finds a way to say yes.
- **A region in place of a recommendation.** "A nice Burgundy" is not something a server can pour.
- **A booking it cannot make.** "You're all set for Saturday at 8," with no reservation behind it.
- **A sales pitch to a statement.** The guest mentions an anniversary and gets three bottles before anyone asks what they would like.

A sommelier notices every one of these straight away, and a generic eval notices none of them.

## What is in it

| Path | What it is |
|---|---|
| `data/venue.json` | The Aster Room: the knowledge text the agent is given, and the priced list the checker scores against |
| `data/scenarios.json` | 40 scenarios, 8 categories of 5, each with a 0 / 1 / 2 rubric |
| `src/prices.mjs` | The price checker: reads every price out of a reply and checks it against the list |
| `src/score.mjs` | The scorer |
| `bin/requests.mjs` | Prints each scenario as a system message and conversation, ready for your agent |
| `bin/score.mjs` | Scores your agent's replies and writes a review sheet for the rest |

No dependencies. Node 20 or later.

## The eight categories

| # | Category | Scored by | A 0 looks like |
|---|---|---|---|
| 1 | Pairing accuracy | A sommelier | A pairing no sommelier would pour, or a wine not on the list |
| 2 | Three named options | Code | A region or a grape, no producer |
| 3 | List and price accuracy | Code | Any wrong price, any invented vintage |
| 4 | Reading the guest | A sommelier | A recommendation nobody asked for |
| 5 | Boundary respect | Rubric | "Booked", or an allergy answered by the agent |
| 6 | Honest refusal | Rubric | An invented bottle, vineyard, policy or table |
| 7 | Second language quality | A sommelier | A number lost in translation |
| 8 | Zero-proof service | A sommelier | Water, a lecture, or wine anyway |

## Run it

```bash
node bin/requests.mjs > requests.jsonl
```

Send each line to your agent however it is built: `system` is the venue knowledge, `messages` is the conversation. Save its answer to the last guest turn as one `{"id": "pair-01", "reply": "..."}` per line, then:

```bash
node bin/score.mjs replies.jsonl
```

That scores the code tier and lists what is still pending. For the rest:

```bash
node bin/score.mjs replies.jsonl --sheet > review.md
```

Score each reply in the sheet 0, 1 or 2 against its rubric, save the scores as `{"pair-01": 2, ...}`, and rerun with `--scores scores.json`. Add `--json` for the full result.

`examples/` has six replies written by hand to show the format, including one with a wrong price. None came from a model.

## How the scoring works

**Three tiers.** *Code* is scored by counting and by checking against the list. *Rubric* is scored by a person or a model judge; if you use a judge, name it when you report. *Human* is taste, scored by a sommelier, and is never automated. Whether a pairing is right is a judgment, and a number that pretends otherwise is worth less than no number.

**A wrong price fails the scenario, whatever it was testing.** A guest quoted the wrong price was served badly, however good the pairing. The checker runs on every reply, including the ones only a sommelier scores.

**No overall score until every scenario has one.** The report shows each category's score and how many scenarios are pending. A partial score tends to be quoted as the full result, so the scorer withholds the overall figure until every scenario has a score.

**The checker errs toward missing a wrong price, never toward inventing one.** A price is attached to the last item named before it. A price it cannot attach to a named item is only checked against the set of prices on the list, so "the Gevrey-Chambertin is $45" passes, because corkage costs $45 and "Gevrey-Chambertin" alone names the appellation, not the producer. A budget echoed back ("anything under $25") is not read as a quote. The tests in `test/prices.test.mjs` pin both behaviours. The trade is deliberate: a checker that wrongly accuses correct answers would make every reported error rate meaningless.

## Reporting results

Report the category table, not one number. Say which scenarios were scored by code, which by a judge (and which judge), and which by a person. If you changed the venue, the prompts or the rubric, say so. If a sommelier did not score the human tier, report it as pending, not as passed.

## Limits

One fictional venue, one by-the-glass list, Canadian dollars, English and Chinese. Mostly single turns. It does not test voice, real booking systems, a point of sale, or a list of hundreds of bottles. It tests whether an agent serves a guest the way a good floor would. Whether the business it runs for makes money is a separate question.

## For teams building in hospitality

I build test sets like this one for teams deploying AI in restaurants, hotels, bars and wine retail, on the real venue, the real list and the real failure modes, and I review agents before they reach guests. The details are at [woodywusommelier.com/consulting/ai-teams/](https://woodywusommelier.com/consulting/ai-teams/).

## License

Code (`src/`, `bin/`, `scripts/`, `test/`): MIT, see `LICENSE`. Data (`data/`, `examples/`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), see `LICENSE-DATA`. Credit "Woody Wu, Hospitality Agent Evals".

## Citation

See `CITATION.cff`, or:

> Wu, Woody. *Hospitality Agent Evals: The Aster Room*. 2026. https://github.com/woodywu-sommelier/hospitality-agent-evals

## About

Woody Wu is a sommelier, hospitality operator and AI builder in Western Canada, with dual WSET and ISG Diplomas, who writes The Floor and the Terminal and built The House Somm. [woodywusommelier.com](https://woodywusommelier.com)
