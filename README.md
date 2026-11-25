# Hospitality Agent Evals: The Aster Room

An open hospitality AI evaluation suite with 40 guest scenarios, a fictional wine list, a scorer and the Floor-Tested GitHub Action.

## Run it on your agent in two minutes

From this checkout, use Node 20 or later. Point Floor-Tested at a sandbox endpoint with live booking and payment tools disabled:

```sh
FLOOR_AGENT_URL='https://your-sandbox.example/agent' node bin/floor-tested.mjs
```

Replace the example URL with your endpoint. It receives `{"messages":[...]}` and returns `{"reply":"..."}`. If it requires authentication, set `FLOOR_AGENT_KEY` privately and use HTTPS. For a local adapter, use `FLOOR_AGENT_COMMAND='node path/to/adapter.mjs'` in place of `FLOOR_AGENT_URL`. It receives the same JSON on stdin and writes reply text or a JSON object with a `reply` field to stdout.

Open `floor-tested-report.md` to see which checks passed and which replies need human review. The default run uses the fictional Aster Room scenarios. Setup takes about two minutes. Run time depends on your agent. See [Floor-Tested in CI](#floor-tested-in-ci) for pack selection and CI setup.

Want a sommelier to review your agent's replies before launch? [Pre-Launch Review](https://woodywusommelier.com/consulting/ai-teams/?utm_source=github&utm_medium=readme&utm_content=hospitality-agent-evals-quickstart).

### Try the offline example

```sh
FLOOR_AGENT_COMMAND='node examples/echo-agent.mjs' FLOOR_PACKS=aster-room,constance-lite node bin/floor-tested.mjs
```

The deliberately bad echo agent needs no dependencies, network, or API key. It quotes a wrong price and invents a wine vintage. The badge reports `0/41 automated · 7 need review` for this example.

These are the questions I test The House Somm with, the AI sommelier I built, adapted so anyone can run them against any agent. The venue, The Aster Room, is fictional. Every producer, price and policy in it was invented for this test set.

The data is also on Hugging Face, with a browsable table: https://huggingface.co/datasets/woodywu-sommelier/hospitality-agent-evals

**Try it without installing anything:** [The Aster Room Test](https://huggingface.co/spaces/woodywu-sommelier/aster-room-test) runs the scorer in your browser. Paste one reply or a full run and every price is checked against the list.

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
| `space/` | The browser version on Hugging Face, built by `node scripts/build-space.mjs` |

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

## Floor-Tested in CI

**Floor-Tested: open-source scenario tests for hospitality AI.** Run your agent against restaurant service scenarios and see which replies still need a person. It is a scenario suite, not a test of live service and not a certification.

Add this step to a job with Node 20 or newer. Pin to a release tag or a commit you have reviewed. [Complete workflow](examples/workflow.yml).

```yaml
steps:
  - name: Floor-Tested
    uses: woodywu-sommelier/hospitality-agent-evals@v0.2.0
    with:
      agent-url: ${{ secrets.HOSPITALITY_AGENT_URL }}
      agent-key: ${{ secrets.HOSPITALITY_AGENT_KEY }}
      packs: aster-room,constance-lite
      timeout-seconds: '30'
      # Optional minimum percentage of machine checks that must pass:
      # fail-under: '80'
```

The action sends one sequential POST per scenario, with a short pause between requests. Your endpoint accepts `{"messages":[...]}` and returns `{"reply":"..."}`. The Aster Room system message includes the fictional venue knowledge. If the endpoint requires a bearer key, use HTTPS. Alternatively, set only `agent-command` to a trusted command in your checkout. It receives the same JSON on stdin and returns plain reply text or a JSON object with a `reply` field on stdout.

Try both packs locally with the deliberately bad echo agent:

```sh
FLOOR_AGENT_COMMAND='node examples/echo-agent.mjs' FLOOR_PACKS=aster-room,constance-lite node bin/floor-tested.mjs
```

The action writes `floor-tested-report.md`, `floor-tested.json` and a GitHub job summary. The full report includes replies for failures and human review. The summary has aggregate counts only. Echo run excerpt:

| Category | Pass | Partial | Fail | Needs a person | No reply |
| --- | ---: | ---: | ---: | ---: | ---: |
| List and price accuracy | 0 | 0 | 5 | 0 | 0 |
| Constance Lite | 0 | 0 | 1 | 7 | 0 |

The badge for this example reads `floor-tested 0/41 automated · 7 need review`. A good agent on the default pack reads something like `floor-tested 9/9 automated · 31 need review`. The first number is full passes on automated checks: prices against the list, counts of named options, explicit corrections or inventions of a wine that was never made. The second is every reply a machine could judge, including partial answers and missing replies. "Need review" counts replies only a person can judge, such as whether a pairing is right. They are never passes. On the default `aster-room` pack, 9 of the 40 scenarios are scored by code; a wrong price fails any scenario, so the other 31 can still fail automatically but can only pass with a person. `constance-lite` adds eight public Constance questions and uses narrow English rules; ambiguous replies need review. Colors are red below 50% of automated checks, yellow from 50% to below 80%, and bright green from 80%. A red badge is not a hospitality quality verdict. Report the pack names next to the badge.

If `fail-under` is set, a run below that percentage of automated checks exits with an error after writing its files. Missing replies also fail the step. See [badge setup](examples/badge.md) to publish just the reviewed badge JSON yourself.

**Privacy:** No telemetry, analytics or phone-home. In HTTP mode the action sends requests only to the endpoint you configure and refuses redirects. Command mode runs the command you supply, so use trusted code and control its network access separately. The configured URL and bearer key are masked and redacted where matched; the action cannot identify unknown secrets or personal data that your agent might return. The example uploads no output files. Keep the full report private unless you have reviewed it. A Shields badge is optional and fetches only the public JSON you choose to publish.

## Booking and deposit pack

[Floor Note 01: A Hold Is Not a Booking](docs/floor-notes/01-booking-overclaims.md) shows what the released status checks catch and where the prose rules miss.

Run the eight fictional booking scenarios with the deliberately bad example agent:

```sh
FLOOR_AGENT_COMMAND='node examples/echo-agent.mjs' FLOOR_PACKS=booking-and-deposit node bin/floor-tested.mjs
```

The [sample report](examples/booking-and-deposit-report.md) shows `0/6 automated · 2 need review`. Use `packs: booking-and-deposit` in the GitHub Action on a revision that includes this pack. The default pack remains Aster Room.

Six scenarios ask for one status line. The checker compares it with the recorded state: a hold is not a confirmed booking, a pending refund is not a transfer, a waived fee was not charged, a delivered request is not a confirmation, and an unapproved party-size change does not alter the booking.

The prose check can **fail but never pass** a reply. It looks for explicit English claims about confirmation, refunds and fees that contradict the record, including common lead-ins and time details. A standalone "Confirmed" or a sentence such as "You're all set" counts only when the scenario asks for booking status. A negation or condition suppresses its own sentence, not a separate claim. Quoted and unmatched prose can still need review. This is not a general language judge. The two guest-facing cases cannot pass by machine, though explicit contradictions can fail.

Compare the echo run with the local reference agent:

```sh
FLOOR_AGENT_COMMAND='node examples/booking-reference-agent.mjs' FLOOR_PACKS=booking-and-deposit node bin/floor-tested.mjs
```

It reads the fictional record, reports the recorded field and leaves both guest-facing replies to a person: `6/6 automated · 2 need review`. This is an offline fixture reader, not a booking product or a live agent result.

The pack supplies fictional records. It does not book a table, take a deposit, issue a refund, or prove that an agent's production tools work. Use a sandbox with live booking and payment tools disabled. No telemetry. Only the configured endpoint receives requests in HTTP mode.

## Reporting results

Report the category table, not one number. Say which scenarios were scored by code, which by a judge (and which judge), and which by a person. If you changed the venue, the prompts or the rubric, say so. If a sommelier did not score the human tier, report it as pending, not as passed.

## Limits

One fictional venue, one by-the-glass list, Canadian dollars, English and Chinese. Mostly single turns. It does not test voice, real booking systems, a point of sale, or a list of hundreds of bottles. It tests whether an agent serves a guest the way a good floor would. Whether the business it runs for makes money is a separate question.

## License

Code (`src/`, `bin/`, `scripts/`, `test/`): MIT, see `LICENSE`. Data (`data/`, `examples/`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), see `LICENSE-DATA`. Credit "Woody Wu, Hospitality Agent Evals".

## Citation

See `CITATION.cff`, or:

> Wu, Woody. *Hospitality Agent Evals: The Aster Room*. 2026. https://github.com/woodywu-sommelier/hospitality-agent-evals

## About

Woody Wu is a sommelier, hospitality operator and AI builder in Western Canada, with dual WSET and ISG Diplomas, who writes The Floor and the Terminal and built The House Somm.

Want a sommelier to read the replies a script can't judge? [For AI Teams](https://woodywusommelier.com/consulting/ai-teams/?utm_source=github&utm_medium=readme&utm_content=hospitality-agent-evals-readme).
