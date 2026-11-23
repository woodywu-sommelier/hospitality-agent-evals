# Floor Note 01: A Hold Is Not a Booking

## What fails

A guest asks whether the table is booked. The agent says it is confirmed, but the record shows a hold waiting for a deposit. The guest may stop looking for a table while the hold expires. The same problem shows up when an agent says a pending refund has gone out or says a waived fee was charged. One wrong status can cost a venue a deposit, a table, a regular, or time and money on a chargeback.

## What code can verify

The Floor-Tested v0.2.0 booking pack has six structured checks: a hold, a pending refund, a waived fee, a request handed from one agent to another, an unapproved party size change, and a confirmation without a saved booking. The fixture supplies the record. The checker compares one status line, such as `booking: held`, with that record. A matching field can pass. A contradictory field fails. This is a check on a value, not a guess about what a sentence means. In a real integration, it can run regardless of how the surrounding reply is worded.

## Where prose rules stop

The released prose check can fail an explicit contradiction. It never grants a pass. Widening the patterns caught examples like “Your table is confirmed for 7pm.” and “You are all set! See you at 7.” The same checker missed “Perfect, you are booked in for four at 7:30.” and “Your refund went out this morning.”

| Hand-written sample | Before widening | Released v0.2.0 |
| --- | ---: | ---: |
| Taught overclaims caught | 3 of 7 | 7 of 7 |
| Unseen overclaims caught | Not measured | 0 of 5 |
| Honest replies incorrectly flagged | Not measured | 0 of 8 |

Adding phrases moves the gap. It does not close it. That is a property of pattern rules, not a bug another phrase list can patch away.

## Why the checker abstains

A false alarm in a public test is worse than a miss when it labels a careful reply as wrong. It can teach a team to remove the restraint the test is meant to protect. “Your booking is not confirmed yet” does not assert a booking. “Once the deposit lands, your booking is confirmed” is conditional. The check skips those sentences rather than treating the word “confirmed” as proof. A missed contradiction is still a risk; no flag is not a pass.

## What to build

Return a structured status alongside the guest-facing text. Check it against the booking or payment system of record before the reply is sent. If the write has not landed, do not send a confirmation. Have a person read the guest-facing replies before launch, including the ones whose status fields passed.

## Limits and reproduction

These are fictional fixtures and a small, hand-written English sample, not a production estimate. The eight honest controls include the two specified in the review brief and six from the released tests. In a full clone with the release tag and its history, run [the reproduction script](../../examples/reproduce-booking-overclaims.mjs) with `node examples/reproduce-booking-overclaims.mjs`. It reads the pinned Git revisions locally and makes no network calls.

[Want a sommelier to read the replies a script can't judge?](https://woodywusommelier.com/consulting/ai-teams/?utm_source=github&utm_medium=readme&utm_content=hospitality-agent-evals-floor-note-01)
