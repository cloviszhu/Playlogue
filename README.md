# Playlogue

[English](README.md) | [简体中文](README.zh-CN.md)

Playlogue is a game UX interview prototype. Participants answer one question at a time, while researchers inspect tentative findings against the recorded questions and exact answer spans. The included examples and tests use fictional answers and synthetic data.

This source snapshot contains the v19 gameplay guide and the analysis loading spinner. The guide covers map design, perceived operator balance, and weapon customization and purchasing economy: three main questions, at most one immediate follow-up per topic, and at most two follow-ups overall. Existing saved guides retain their original version. Optional follow-ups depend on the answer; they are not guaranteed.

The interface supports text answers, explicit voice transcript confirmation, session recovery, saved analysis, and source inspection. Candidate findings require human review. Real microphone/speaker acceptance and continuous voice are not established by the synthetic tests. The separate provider span-normalization candidate is excluded from this snapshot. Source publication does not deploy a service or enable provider calls.

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
