# Golden fixtures: P0 T-001–T-030

Every `scenarios/T-nnn.json` is a standalone tiny TypeScript/React/Git project. Every independently authored `expected/T-nnn.json` states a small, explicit static-analysis oracle; the test runner **does not snapshot or approve observed output**. Graph fixtures cover labeled positive and negative dependencies, precise edge types, warnings and coverage; Git fixtures compare exact differential finding identities. Unsupported results remain separate from false positives and false negatives.

Run `npm run build && node ci/run-tests.mjs unit` to reproduce. See `docs/P2_ACCURACY.md` for the confusion table, known unsupported semantics and separate quality claims. Never update golden expectations solely to make a failing analyzer pass.
