# 🤖 Autonomous Bug Fixer

A multi-agent AI system that turns a plain-English bug report into a reviewed, ready-to-merge GitHub pull request — triggered from Slack or a web dashboard.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-LLaMA_3.1-F55036?style=flat)
![Pinecone](https://img.shields.io/badge/Pinecone-Vector_DB-1C17FF?style=flat)
![Slack](https://img.shields.io/badge/Slack-Bolt-4A154B?style=flat&logo=slack&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-Octokit-181717?style=flat&logo=github&logoColor=white)

![System Architecture](./architecture-diagram.svg)

## 📌 Overview

Most AI coding tools stop at suggesting a fix. This project goes further: it reads the actual codebase, traces the bug to its root cause, writes a real code diff, opens a pull request on GitHub, and — critically — tells you how confident it is in its own fix and why.

Nothing merges automatically. Every fix ships with a confidence score, a written explanation, and a mandatory human review step, so the system stays useful without being reckless.

## ✨ Key features

- 🧠 **Codebase-aware fixes (RAG)** — the repository is indexed into a vector store, so every fix is grounded in the actual code, not just the error message.
- 🔀 **Multi-agent pipeline** — three specialized agents (Analyzer, Fixer, Reviewer) each handle one part of the job instead of one model trying to do everything at once.
- 📊 **Confidence scoring** — the Reviewer agent scores every fix from 0-100 and explains what it's uncertain about, instead of presenting every fix as equally safe.
- 🧭 **Intent routing** — general questions about the codebase are answered directly; only genuine bug reports trigger the full fix-and-PR pipeline.
- 🚀 **Autonomous PR creation** — a new branch is created, the fix is committed, and a pull request is opened automatically, with the root cause, fix explanation, and confidence score in the PR description.
- 🔒 **Branch protection by design** — pull requests always require human review before merging, regardless of how high the confidence score is.
- 💬 **Two entry points** — trigger the whole pipeline from a Slack mention or from a web dashboard chat interface.

## ⚙️ How it works

1. **Trigger** — a bug is reported via a Slack mention or the web dashboard.
2. **Intent routing** — a lightweight classification step decides whether the message is a bug report or a general question about the codebase.
3. **RAG retrieval** — the indexed repository is searched for the most relevant code chunks.
4. **Multi-agent pipeline**
   - *Analyzer* — reads the bug report and the retrieved code, and identifies the root cause.
   - *Fixer* — generates a precise code diff that addresses the root cause.
   - *Reviewer* — validates the fix, flags potential side effects, and assigns a confidence score with reasoning.
5. **GitHub integration** — a new branch is created, the fix is committed, and a pull request is opened with the full analysis attached. The repository's branch protection rules mean this PR cannot be merged without a human approval.
6. **Response delivered** — the result (confidence score, reasoning, and PR link, or a plain-text answer for general questions) is sent back through whichever channel triggered the request.

## 🛠️ Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| LLM | Groq (LLaMA 3.1) |
| Vector store | Pinecone (integrated embeddings) |
| Source control | GitHub API (Octokit) |
| Chat integration | Slack Bolt |
| Dashboard | HTML, CSS, vanilla JavaScript |

## 📁 Project structure

```
├── src/
│   ├── server.js              Express app entry point
│   ├── api/
│   │   ├── auth.js            GitHub OAuth flow
│   │   ├── repos.js           Repository indexing endpoint
│   │   └── sentinel.js        Main pipeline endpoint (analyze / process)
│   ├── agents/
│   │   ├── analyzer.js        Root cause analysis
│   │   ├── fixer.js           Code fix generation
│   │   ├── reviewer.js        Confidence scoring and verdict
│   │   └── router.js          Intent classification (bug vs. general question)
│   ├── rag/
│   │   ├── indexer.js         Repository indexing into Pinecone
│   │   └── retriever.js       Relevant chunk retrieval
│   ├── github/
│   │   └── prCreator.js       Branch, commit, and PR creation
│   └── slack/
│       └── slackBot.js        Slack event handling
├── dashboard/
│   └── index.html             Web dashboard (repo connect + chat)
├── architecture-diagram.svg
└── .env
```

## 🚀 Getting started

### Prerequisites

- Node.js and npm
- A GitHub account
- A Groq API key
- A Pinecone account and index
- A Slack workspace (for the Slack integration; optional if only using the dashboard)

### Environment variables

Create a `.env` file in the project root:

```
PORT=8080
REDIS_HOST=localhost

DATABASE_URL=postgresql://postgres:password@localhost:5432/autonomous-bug-fixer

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_TOKEN=your_github_personal_access_token

GROQ_API_KEY=your_groq_key

PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX=your_pinecone_index_name

JWT_SECRET=your_jwt_secret

SLACK_BOT_TOKEN=your_slack_bot_token
SLACK_SIGNING_SECRET=your_slack_signing_secret
```

### Installation

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
npm install
```

### Running locally

```bash
node src/server.js
```

This starts the Express server on port 8080 and the Slack bot listener on port 3000.

### Setting up GitHub OAuth

1. Go to GitHub Settings → Developer settings → OAuth Apps → New OAuth App.
2. Set the callback URL to `http://localhost:8080/api/auth/callback`.
3. Copy the client ID and client secret into `.env`.
4. Generate a personal access token (classic) with `repo` and `workflow` scopes, and add it to `.env` as `GITHUB_TOKEN`.

### Setting up the Slack app

1. Create a new Slack app at `api.slack.com/apps`.
2. Add the following bot token scopes: `app_mentions:read`, `channels:history`, `chat:write`, `im:history`, `im:write`.
3. Install the app to your workspace and copy the bot token into `.env`.
4. Expose your local server with a tunnel (for example, Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:3000`).
5. Under Event Subscriptions, set the request URL to `<your-tunnel-url>/slack/events` and subscribe to the `app_mention` bot event.

## 💻 Usage

### Web dashboard

1. Open `http://localhost:8080/dashboard/index.html`.
2. Click "Connect GitHub" and authorize the app.
3. Enter the repository owner and name, then click "Index repository."
4. Describe a bug in the chat box. The dashboard shows the root cause, the fix, a confidence gauge, and a link to the generated pull request. General questions about the codebase are answered directly without generating a fix.

### Slack

Mention the bot in any channel it has been added to:

```
@AutonomousBugFixer fix this bug: submitSolution crashes when the API response is invalid
```

The bot replies in-thread once the analysis is complete, with the same confidence score, reasoning, and PR link shown in the dashboard.

## 🔐 Safeguards

- **Branch protection** — the target repository requires pull request review before merging, so no fix (regardless of confidence score) reaches `main` without a human decision.
- **Confidence scoring** — every fix is accompanied by a numeric confidence score and a written explanation of what the reviewer agent is uncertain about, if anything.
- **Intent routing** — the system distinguishes bug reports from general questions, so it never opens an unnecessary pull request in response to a casual question about the codebase.

---

## 👩‍💻 Built by

**Himanshi Sonkusale**

GitHub: [@himanshisonkusale](https://github.com/himanshisonkusale)

If you found this project interesting, consider starring the repository — it helps others discover it too.