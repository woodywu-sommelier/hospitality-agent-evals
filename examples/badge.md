# Add a Floor-Tested badge

1. Run Floor-Tested and review `floor-tested.json`. It contains only the Shields endpoint schema and the selected run's count. Never commit `floor-tested-report.md` without separately reviewing its quoted replies.
2. Commit the reviewed `floor-tested.json` at your repository root. It is ignored by default in this repository, so use `git add -f floor-tested.json` here. Consumer repositories may not need `-f`.
3. Replace `YOUR-ORG`, `YOUR-REPO` and `main` below. Shields must be able to read the JSON without credentials. For private code, publish only the reviewed badge JSON to a public location you control.

```markdown
[![Floor-Tested automated scenario checks](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FYOUR-ORG%2FYOUR-REPO%2Fmain%2Ffloor-tested.json)](https://woodywusommelier.com/floor-tested/)
```

Place the selected packs next to the badge. The badge is self-reported and only updates when you replace the committed JSON. Do not compare badges with different pack selections as though they were one scoreboard.
