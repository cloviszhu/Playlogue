<div align="center">

# Playlogue

### Read the finding. Check the player's words.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-D16A32?style=flat-square&logo=cloudflare&logoColor=white)
![SQLite](https://img.shields.io/badge/D1_%2F_SQLite-245467?style=flat-square&logo=sqlite&logoColor=white)
![Prototype](https://img.shields.io/badge/Project-Research_prototype-356F60?style=flat-square)

**English | [简体中文](README.zh-CN.md)**

[Source code](client/) · [Development notes](docs/DEVELOPMENT.md) · [Screenshot provenance](docs/SCREENSHOTS.md)

</div>

![A candidate finding beside its original question and highlighted answer](docs/images/source.png)

*Actual interface with hand-authored fictional records.*

An interview answer changes. What happens to the analysis that quoted it?

Playlogue keeps that connection explicit. Each candidate finding points to the question, the exact answer span and the revision it used. Edit the answer and the old analysis becomes stale. A researcher can inspect the source before accepting or rewriting the finding.

The prototype also runs guided player interviews, with limits on follow-ups and model-call budgets. Participants answer one question at a time, type a reply or confirm a voice transcript, and can pause or revise their answers.

## How evidence moves through the workspace

```mermaid
flowchart TB
    Guide["Published interview guide<br/>Topic and follow-up limits"] --> Answer["Participant answer<br/>Typed or confirmed transcript"]
    Answer --> Snapshot["Saved answer revision"]
    Snapshot --> Finding["Candidate finding<br/>Question, quote and source span"]
    Finding --> Check{"Source and revision<br/>still valid?"}
    Check -->|Yes| Review["Researcher review<br/>Inspect, approve or rewrite"]
    Answer -->|Edit answer| New["New answer revision"]
    New --> Stale["Previous analysis marked stale"]
    Check -->|No| Stale
    classDef flow fill:#E7F2EE,stroke:#477A6A,color:#183E33,stroke-width:1.5px;
    classDef review fill:#EAF0F8,stroke:#54739C,color:#203953;
    classDef invalid fill:#FFF1DF,stroke:#AD7832,color:#5F401B;
    class Guide,Answer,Snapshot,Finding flow;
    class Check,Review review;
    class New,Stale invalid;
```

| Design decision | What happens in practice |
| --- | --- |
| Put a limit on follow-ups | The current API gameplay guide asks three main questions, allows at most one immediate follow-up per topic and two overall. Saved guides keep their own limits. |
| Store the evidence with the finding | Source references include question and answer IDs, answer revision, UTF-16 offsets and a verbatim quote. |
| Treat an edit as a new source | Answer and session revisions change. Earlier analyses lose their current-source status. |
| Make voice submission deliberate | Participants review and confirm a transcript before it becomes an answer. |
| Keep retry and spending rules on the server | State checks, duplicate-request protection and budget reservations constrain API operations. |

A valid citation confirms where the words came from. It doesn't establish that the interpretation is correct. Researchers still review candidate findings.

## Try the fictional practice

Use **Node.js 24+**. The API test harness uses Node's built-in SQLite.

```sh
git clone https://github.com/cloviszhu/Playlogue.git
cd Playlogue
npm ci
npm start
```

Open [127.0.0.1:4174](http://127.0.0.1:4174). The local practice uses fictional answers and doesn't call an AI or audio provider. No API key is needed. Its older practice guide has different limits from the current API gameplay guide.

![Playlogue local practice workspace](docs/images/workspace.png)

<details>
<summary><strong>Architecture and code worth reading</strong></summary>

```mermaid
flowchart LR
    UI["Browser workspace<br/>JavaScript, HTML and CSS"] --> Adapter{"Demo or API?"}
    Adapter -->|Demo| Fixture["Fictional fixtures<br/>No provider calls"]
    Adapter -->|API| Worker["TypeScript Worker"]
    Worker --> Rules["Shared rules<br/>Routing, budgets and evidence"]
    Worker <--> DB[("D1 / SQLite")]
    Worker -. runtime gates .-> Provider["Text and speech providers"]
    classDef app fill:#E7F2EE,stroke:#477A6A,color:#183E33;
    classDef server fill:#EAF0F8,stroke:#54739C,color:#203953;
    classDef runtime fill:#FFF1DF,stroke:#AD7832,color:#5F401B;
    class UI,Adapter,Fixture app;
    class Worker,Rules,DB server;
    class Provider runtime;
```

The frontend uses JavaScript ES modules. The Worker uses TypeScript; shared JavaScript modules define interview transitions, source validation and budgets. Drizzle defines the schema, and esbuild bundles the Worker.

| Source | Focus |
| --- | --- |
| [client/adapter.js](client/adapter.js) | Demo and API boundaries |
| [shared/evidence.mjs](shared/evidence.mjs) | Exact spans, source manifests and stale analysis |
| [shared/default-guide.mjs](shared/default-guide.mjs) | Built-in guides and versioned question limits |
| [shared/budget.mjs](shared/budget.mjs) | Call reservations and spending accounting |
| [server/repository.ts](server/repository.ts) | Persisted session changes and revision checks |
| [db/schema.ts](db/schema.ts) | Database schema |

Span repair is narrow: the verbatim quote must occur exactly once in its named answer, and the repaired span must pass the same strict validation. A plausible paraphrase doesn't qualify.

</details>

<details>
<summary><strong>Build commands, runtime setup and verification status</strong></summary>

```sh
npm run check
npm run build
npm run typecheck
npm run test:synthetic
```

These are verification commands, not a claim that the suite passes. [Development notes](docs/DEVELOPMENT.md) record the failed full-suite attempt and a narrower 44-test pass. Date-bound fixtures and the fixed server call cutoff affect current results.

After building, `npm run preview:worker` starts a local API preview with fresh synthetic SQLite data. Open [127.0.0.1:4175/?adapter=api](http://127.0.0.1:4175/?adapter=api). Live calls and trusted identity remain disabled.

Hosted use needs private runtime bindings, including `DB`, `APP_ORIGIN`, `AUTH_MODE`, `SITE_ACCESS_MODE` and `RESEARCHER_USER_ID`, plus provider credentials where required. The server checks authorization, consent, quotas, retention and call budgets. The call window in `shared/session.mjs` ends at `2026-10-04T16:00:00Z`; configuring credentials alone won't make live calls available.

Synthetic tests don't verify microphone/speaker behavior, continuous voice, provider billing or research quality. App-side deletion and provider retention have separate boundaries. This repository doesn't publish a hosted demo or grant a new open-source license.

</details>

For a wider view, open the [full fictional evidence example](docs/images/evidence.png). [Screenshot notes](docs/SCREENSHOTS.md) identify the capture source and explain the fixture data.
