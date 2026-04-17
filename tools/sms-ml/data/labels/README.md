# Labels

This directory contains manual labeling queues and reviewed category labels for
the seed SMS dataset.

Primary file:

- `seed-label-queue.csv`

Workflow:

1. Run `yarn ml:labels:init`.
2. Review debit transactions and adjust the suggested `target_category` where needed.
3. Optionally add reviewer notes.
4. Run `yarn ml:labels:apply` to merge labels into the normalized JSONL files.

Current suggestion policy:

- food merchants such as Zomato and Swiggy map to `Food`
- Uber, Ola, and similar commute merchants map to `Transport`
- Zepto, Instamart, Blinkit, BigBasket, and similar merchants map to `Groceries`
- fuel merchants such as HP, BP, Shell, Chevron, and Exxon are collapsed to `Transport`
- travel-ticket merchants such as MakeMyTrip and similar travel-booking text are collapsed to `Transport`
- Netflix, BookMyShow, Spotify, and similar merchants map to `Entertainment`
- electricity and similar bill text maps to `Utilities`
- Apollo, medicines, and similar health text maps to `Health`
- uncertain cases default to `Other`

Taxonomy note:

- the current shipped app categories do not include `Fuel` or `Travel`, so those intents are intentionally collapsed into `Transport` in this labeling workflow
- the current seed labels are bootstrapped from this same policy, so downstream benchmark results must be interpreted as heuristic-on-heuristic until more independent review is added

Allowed categories:

- Food
- Transport
- Groceries
- Rent
- Utilities
- Entertainment
- Health
- Other