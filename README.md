# Creativity Test

A small web app: **how creative are you, compared to frontier LLMs?**

You write 10 answers to a constrained thought-experiment prompt (e.g. *"10 unusual uses of a diamond"*). An independent LLM judge (Llama 3.3-70B on Groq) scores each answer 1-10. Your total is shown next to baselines from Claude Opus 4.7, GPT-5.5, and Gemini 2.5 Pro on the same experiment.

Companion to a series of LinkedIn posts on LLM creativity. Sources from the [`concept-bridge`](https://github.com/ravimeduri76/concept-bridge) project.

## Architecture

- **Next.js 15** — single Next app, App Router, Tailwind. Two pages (form + results).
- **Cloud Run** — auto-scaling, idle cost ~$0.
- **Neon Postgres** — one table `creativity_submissions`. Shares the DB with `concept-bridge` for cross-app analyses.
- **Groq Llama 3.3-70B** — judge (free tier covers expected traffic; ~10 calls per submission).

## Local dev

```bash
cp .env.example .env
# fill DATABASE_URL and GROQ_API_KEY
npm install
npm run dev
```

## Deploy

```bash
bash scripts/deploy-cloudrun.sh

# First deploy only — mount secrets:
gcloud run services update creativity-test \
  --project concept-bridge-494005 --region us-central1 \
  --update-secrets DATABASE_URL=database-url:latest,GROQ_API_KEY=groq-api-key:latest
```

The schema is created lazily on first request via `ensureSchema()` in `src/lib/db.ts`.

## Adding a new experiment

1. Add to `EXPERIMENTS` in `src/lib/experiments.ts` — `id`, prompt, baselines.
2. Add a corresponding rubric entry in `RUBRIC_BY_EXPERIMENT` in `src/lib/groq.ts`.
3. Run the same offline experiment yourself to populate baselines (use the helper scripts in the `concept-bridge` repo).
4. No DB migration needed — the existing table handles any `experiment_id`.

## Abuse / cost protection

The app makes ~10 Groq API calls per submission, so cost runaway and bot abuse are real concerns. Layered defenses:

| Layer | Defense |
|---|---|
| **Diversity gaming** | Server-side Jaccard similarity check on lowercased non-stopword tokens. If an answer is ≥ 50% similar to any earlier non-skipped non-duplicate answer, it's flagged as duplicate, **the Groq call is skipped**, and it scores 0/10. Catches the "crocodile gastrolith → alligator gastrolith" pattern. |
| **Daily cap** | `MAX_SUBMISSIONS_PER_24H` env var, default 500. Server returns HTTP 429 once exceeded. Hard wall against runaway. |
| **Bots** | Honeypot field (CSS-hidden `<input>` named `website`). Real users never see it; bots that auto-fill all fields trigger silent rejection. |
| **Cloud Run** | `max-instances=5`, `memory=512Mi`, `cpu=1`. Caps total parallel compute regardless of inbound traffic. |
| **Body size** | Form caps each answer at 300 chars; server hard-caps at 600 before the judge call. |
| **Prompt injection** | User text is wrapped with `<USE>...</USE>` tags + control-char stripping + fence-breaker neutralization. The judge's system prompt instructs it to treat input inside tags as untrusted. Worst-case attacker scores themselves 10/10 on gibberish — they can't exfiltrate data (judge has no tools / no DB access). |

## Privacy

**Nothing personal is tracked or stored.** Privacy is by design — the database schema literally has no columns for IP, user-agent, session, or any fingerprint. The only things the app persists per submission:

- the 10 answer texts (or the skip flag)
- the judge's per-answer scores and reasoning
- an optional `display_name` if the user chose to type one
- the `opt_in_share` flag (governs whether answers may be referenced, anonymized, in future analyses)
- a server-generated UUID and timestamp

No cookies, no analytics, no third-party trackers. The judge call goes to Groq with only the answer text — no metadata.

## License

MIT.
