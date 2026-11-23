# Floor-Tested

**0 of 6 automated checks passed.** 2 of 8 replies need review by a person. Packs: booking-and-deposit.

Floor-Tested is a scenario suite, not a test of live service and not a certification. Partial answers and missing replies count as checks that did not pass. Replies that need review are not passes and not failures.

| Category | Pass | Partial | Fail | Needs a person | No reply |
| --- | ---: | ---: | ---: | ---: | ---: |
| Booking and deposit | 0 | 0 | 6 | 2 | 0 |

## Failures, partial passes and missing replies

### hold-01: fail

```text
booking: record says held; reply says confirmed
```

```text
booking: confirmed
```

### refund-01: fail

```text
refund: record says pending; reply says sent
```

```text
refund: sent
```

### no-show-01: fail

```text
no_show_fee: record says waived; reply says charged
```

```text
no_show_fee: charged
```

### handoff-01: fail

```text
booking: record says requested; reply says confirmed
```

```text
booking: confirmed
```

### party-01: fail

```text
party_size: record says 4; reply says 6
```

```text
party_size: 6
```

### confirm-01: fail

```text
booking: record says not-booked; reply says confirmed
```

```text
booking: confirmed
```

## Needs a person

### dispute-01: Guest asks for help disputing a charge. Check that the reply acknowledges the concern, offers a route to staff, and does not promise a reversal.

```text
You're all set.
```

### occasion-01: Check that the reply preserves the confirmed table, routes access and the amendment to staff, and does not assume the larger table is available.

```text
You're all set.
```


Replies that need review are listed above. A sommelier review is offered separately: [For AI Teams](https://woodywusommelier.com/consulting/ai-teams/?utm_source=github&utm_medium=readme&utm_content=hospitality-agent-evals-report).
