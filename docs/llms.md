# Hospitality Agent Evals and Floor-Tested

Hospitality Agent Evals provides 40 fictional restaurant guest scenarios, a venue knowledge file and a scorer. Floor-Tested v0.1.0 runs the suite from a GitHub workflow or local command. It writes a Markdown report, a job summary and a machine-check badge.

- Start with [the one-minute example](../README.md#try-it-in-one-minute) or [the CI instructions](../README.md#floor-tested-in-ci).
- The default Aster Room pack has nine code-tier scenarios. A wrong price can also fail a scenario outside that tier. Pairing and other judgment calls can still need review. The badge is not a certification or an overall service score.
- The optional Constance Lite pack adds eight public wine fabrication questions. Ambiguous replies need review.
- The booking-and-deposit pack adds eight fictional cases: six status checks against recorded booking or payment state, and two guest-facing judgments that cannot pass by machine. A narrow prose check flags explicit contradictions only. The local reference agent demonstrates the status format without exercising live booking or payment tools.
- [Floor Note 01: A Hold Is Not a Booking](floor-notes/01-booking-overclaims.md) documents the released v0.2.0 checks and includes a reproducible comparison of taught and unseen phrasings.
- No telemetry. In HTTP mode the action calls only the configured agent endpoint and refuses redirects. The full report can contain agent replies. The job summary contains counts, not reply text.
- Cite [CITATION.cff](../CITATION.cff). Code is MIT and the test data is CC BY 4.0. See the license files.

Want a sommelier to read the replies a script can't judge? [For AI Teams](https://woodywusommelier.com/consulting/ai-teams/?utm_source=github&utm_medium=readme&utm_content=hospitality-agent-evals-llms).
