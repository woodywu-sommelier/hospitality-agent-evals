# Floor-Tested build report

Implemented locally on `feat/floor-tested`. Nothing pushed, tagged, released or published.

## What ships

- Dependency-free composite GitHub Action that uses an agent endpoint with an optional secret bearer key, or a trusted local command. It sends one request per scenario in sequence, paces requests and applies a per-request timeout. No redirects, telemetry, uploads or automatic badge publication.
- Aster Room uses the existing requests, scorer and price checks with no rubric changes. Constance Lite adds eight verbatim public development prompts with attribution and a separate conservative machine check. The pack includes the 2012 Yquem and 2001 Dom Pérignon questions.
- Markdown report with a category table, failure and review replies, a counts-only GitHub summary, and a Shields endpoint file. README, example workflow, badge instructions and a push-triggered self-test are included.

## Run locally

```sh
FLOOR_AGENT_COMMAND='node examples/echo-agent.mjs' FLOOR_PACKS=aster-room,constance-lite node bin/floor-tested.mjs
```

## Echo sample

**0/48 machine-verifiable passes.** The toy agent intentionally returns a wrong price for the 40 Aster Room scenarios. The Constance pack adds one explicit invention and seven replies that need a person.

| Category | Pass | Partial | Fail | Needs a person | No reply |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pairing accuracy | 0 | 0 | 5 | 0 | 0 |
| Three named options | 0 | 0 | 5 | 0 | 0 |
| List and price accuracy | 0 | 0 | 5 | 0 | 0 |
| Reading the guest | 0 | 0 | 5 | 0 | 0 |
| Boundary respect | 0 | 0 | 5 | 0 | 0 |
| Honest refusal | 0 | 0 | 5 | 0 | 0 |
| Second language quality | 0 | 0 | 5 | 0 | 0 |
| Zero-proof service | 0 | 0 | 5 | 0 | 0 |
| Constance Lite | 0 | 0 | 1 | 7 | 0 |

Failure, `pair-01`: “The tasting menu costs $999.”

Failure, `CT-dev-004`: “Château d'Yquem 2012 is a Sauternes with notes of apricot.”

Needs a person, `CT-dev-001`: “I'd need to check that first.”

The full echo report is generated at `floor-tested-report.md` and ignored by git. The badge is `{"schemaVersion":1,"label":"floor-tested","message":"0/48","color":"red"}`.

## Verification and limits

`npm test`: 20 tests passed and the public-content check was clean. The loopback HTTP test verified 40 one-shot requests, the payload contract, redirect refusal, and redaction of reflected URL and credentials. All three YAML files parsed. The composite action's actual shell step ran locally with both packs and produced the expected badge and job summary. All eight prompts matched the pinned public development file verbatim. Hosted Actions, Marketplace listing and live Shields rendering were not run, because nothing was pushed or published.

Only full machine-verifiable passes contribute to the numerator; all selected scenarios remain in the denominator. The badge is not a certification, leaderboard or overall service score. The Constance check is narrow and English-specific; paraphrases or ambiguous claims can need human review. Only known matched credentials can be redacted, so review full reports before sharing. Different packs produce different denominators and are not directly comparable.

## Branch and release decisions

- `feat/floor-tested`
- `0f1d79b` Add Floor-Tested hospitality evaluation action
- This report is in the following documentation commit.

Woody to decide: approve the **Floor-Tested** name, whether to publish a GitHub Marketplace listing, and which version tag to use. Before sharing badge links, verify the separate site landing page is live and use a reviewed commit or tag in the example workflow.
