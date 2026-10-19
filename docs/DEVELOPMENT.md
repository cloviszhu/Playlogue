# Playlogue

[English](../README.md) | [简体中文](../README.zh-CN.md)

Playlogue is a game UX interview prototype. Participants answer one question at a time, while researchers inspect tentative findings against the recorded questions and exact answer spans. The included examples and tests use fictional answers and synthetic data.

This source snapshot contains the v19 gameplay guide and the analysis loading spinner. The guide covers map design, perceived operator balance, and weapon customization and purchasing economy: three main questions, at most one immediate follow-up per topic, and at most two follow-ups overall. Existing saved guides retain their original version. Optional follow-ups depend on the answer; they are not guaranteed.

The interface supports text answers, explicit voice transcript confirmation, session recovery, saved analysis, and source inspection. Candidate findings require human review. Real microphone/speaker acceptance and continuous voice are not established by the synthetic tests. Provider span offsets can be repaired only when a verbatim quote occurs uniquely in its named answer and the repaired span passes the existing strict source validation. Source publication does not deploy a service or enable provider calls.

## Run the fictional demo

Use Node.js 24 or later (the test harness uses built-in SQLite).

```sh
npm ci
npm start
```

Open the loopback URL printed by the server. This serves the fictional frontend demo; it does not enable a provider or real research collection.

## Build and test

```sh
npm run check
npm run build
npm run typecheck
npm run test:synthetic
```

The build generates the Worker and synthetic API harness without requiring private hosting metadata. `npm run preview:worker` starts a loopback Worker preview with a fresh synthetic SQLite database and identity/live calls disabled. The API frontend is selected explicitly with `?adapter=api`. Generated `work/`, `dist/`, and runtime databases are ignored.

The publication includes schema source, migrations, and mocked tests. Browser QA scripts, live verification scripts, private deployment configuration, internal evidence, diagnostic exports, participant records, audio, and logs are excluded. Some test names retain historical `live` terminology but use injected mock transports and synthetic fixtures; they do not validate real billing or research outcomes.

## Runtime configuration

Set bindings and secrets in your own server runtime. Never commit credential values or participant capabilities. The names include `DB`, `APP_ORIGIN`, `AUTH_MODE`, `SITE_ACCESS_MODE`, `RESEARCHER_USER_ID`, and `OPENAI_API_KEY`. Hosted text/speech readiness, authorization, consent, quota, retention, and budget gates are enforced by the server. Local mock/demo workflows need no real API key. A deployment-specific `.openai/hosting.json`, if used, must be created privately and stays ignored.

This is an engineering prototype. Model-generated interpretations are hypotheses, not representative player findings or validated design recommendations. App deletion and provider retention have different boundaries. No public demo address or new open-source license grant is supplied in this source snapshot.


## Documentation refresh verification — 2026-10-19

At source `5792bb3`, `npm run check`, `npm run build` and `npm run typecheck` passed. The full `npm run test:synthetic` attempt produced failures and was interrupted after it stopped producing output; it is not a passing suite result. A focused reproduction of `v3 fictional example` in `tests/gameplay-feedback.test.mjs` fails with `INVALID_SOURCE_SPAN`.

Some fixtures pin session dates to 2026-10-04 while source validation uses current time. The server call cutoff in `shared/session.mjs` is also fixed to 2026-10-04T16:00:00Z. These historical dates must be considered when interpreting test and hosted-service readiness. This documentation change does not extend that window, enable live calls, or change implementation/tests. The local fictional UI remains available without provider calls.

A focused follow-up run of `tests/contracts.test.mjs`, `tests/budget.test.mjs` and `tests/frontend.test.mjs` passed all 44 tests, covering interview transitions, revision/source checks, budgets and the demo/API adapter. This narrower result does not replace the failing full-suite attempt.
