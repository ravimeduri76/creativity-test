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

## Privacy

- Submissions are anonymous unless the user supplies a display name.
- No raw IP stored — only `sha256(ip + monthly_salt)` truncated, used for de-dup only.
- `opt_in_share` controls whether answers may be referenced (anonymized) in future analyses.

## License

MIT.
