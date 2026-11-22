# P1 — bounded static UNKNOWN; original FAIL retained

Source base: `main@99fe6aa8863e45b92ab0e0d18720cf7f7ee11eb4`, previously accepted PR #16. No change to the nine pinned public sources, 80 manual labels, three Knip 6.45.1 mutations or npm lock.

## Source-backed boundaries

- **React Router** `remix-run/react-router@9916920a490c018eb78d7cc8c55a0efd6e9feac9`: `packages/react-router/lib/dom/ssr/route-discovery.ts` contains `import(/* @vite-ignore */ manifest.url)`. A runtime URL is still UNKNOWN. Literal-only computed imports are a safe, much narrower subset.
- **Floating UI** `floating-ui/floating-ui@c3042f1f37d96dfadff1d8894daa31e120d89ed4`: `extension/src/views/index.ts` statically references `common.views`. Exact element access from string-only concatenation is proven; `common[property]` with an identifier stays UNKNOWN.
- **React Hook Form** `react-hook-form/react-hook-form@8d7bd6c2c774fd9b4310e8cbc07d36ce1cacf736`: `src/__tests__/useFormContext.test.tsx` uses `<FormProvider {...methods} register={mockRegister}>`. The runtime method spread must stay `POSSIBLE_PROP_USAGE`, even though adjacent explicit `register` is known. An **inline complete object literal** can instead provide its exact statically named keys.

## Original red evidence

Initial test-only commit `c533821faa16b4284f263f0fefc5862571b79784` reproduced three independent FAIL on [PR CI #45028629728](https://github.com/levencode-labs/blastradius/actions/runs/45028629728): string concatenation `import('./'+'Widget')`, `common['vi'+'ews']`, and complete inline JSX object spread. A fixture-generation bug accidentally pre-evaluated a template substitution; it was corrected *without changing the engine* in test-only commit `c1be6e575933ae80605b390f6acbdbe5bac8ca07`.

The corrected **Linux/macOS source-exact test-only red** appears in [push CI #45028789529](https://github.com/levencode-labs/blastradius/actions/runs/45028789529), macOS 15/Node 22 job `137227549419`: **161 tests, 157 PASS, 4 FAIL**. Now all four intended positives genuinely fail: literal concat import, literal-interpolated template import, namespace concat, static JSX object spread. The eight existing/new negative controls for runtime/identifier/call/computed/nested spreads, source-literal import, and an explicit JSX prop pass. These original red logs must not be discarded, bypassed or counted as an accepted build.

## Fixed model boundary

Only pure source-literal strings (string literals, parenthesized `+` concatenations, template interpolation whose **every** segment recursively resolves to a literal) are evaluated, bounded at 1024 characters and 12 recursive steps. No evaluation of `const` identifiers, call expressions, environment values or runtime module names. Dynamic imports from runtime expressions still get `possible_dynamic` and `DYNAMIC_IMPORT_UNRESOLVED` and remain UNKNOWN.

JSX spreads resolve only if the entire expression is an inline object with **all** property keys statically known and no nested spreads, getters, calls or unsupported computed names; special React `key`/`ref` are not treated as ordinary proven props. Other spreads retain `POSSIBLE_PROP_USAGE` and remain UNKNOWN. Known static props emit verified `prop_pass` edges. The namespace `ns['vi'+'ews']` becomes equivalent to `ns.views` without guessing `ns[name]`.

The internal file-facts cache version advances `0.0.10-dev` → `0.0.11-dev`. The externally packed npm version remains `0.0.1-dev`, `private: true`; no release.

**Acceptance pending**: full eight OS/Node CI plus byte parity, independent nine-project TypeChecker/Knip on exact corrected SHA, then merge-SHA CI. All nine full graphs may still be incomplete, and the scoped pair accuracy does not authorize automatic code deletion.
