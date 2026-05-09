/**
 * Thought-experiment definitions + LLM baselines.
 *
 * The baselines come from runs already done by the author against
 * Claude Opus 4.7, GPT-5.5, and Gemini 2.5 Pro, blind-judged by
 * Llama 3.3-70B with the same rubric the live app uses. They are
 * shown to users for context, not as ground truth.
 */

export type ExperimentId = "diamond-uses-v1" | "animal-diamond-v1";

export interface LLMBaseline {
  model: string;
  meanCreativity: number;
  totalScore: number; // 0-100, treating each answer as 0-10
  topAnswer: number;
}

export interface Experiment {
  id: ExperimentId;
  shortTitle: string;
  longTitle: string;
  prompt: string;
  rubricNote: string;
  judgeRubric: string;
  baselines: LLMBaseline[];
}

export const EXPERIMENTS: Experiment[] = [
  {
    id: "diamond-uses-v1",
    shortTitle: "Diamond uses",
    longTitle: "10 unusual uses of a diamond",
    prompt:
      "Give 10 distinct uses of a diamond. Each use must satisfy ALL three constraints: " +
      "(A) NOT industrial — no cutting tools, abrasives, optics for instruments, semiconductors, " +
      "heat sinks, scientific tools. " +
      "(B) NOT jewelry / attraction — no rings, necklaces, status symbols, romantic gifts, fashion. " +
      "(C) NOT a commercialized or extensively-documented application — avoid cremation diamonds, optical " +
      "PUF tokens, NV-center qubits, diamond audio tweeters, diamond drug delivery, etc. (these all " +
      "already exist as real products or research).",
    rubricNote:
      "Each answer scored 0-10 by an independent LLM judge (Llama-3.3-70B). Skipped answers count as 0.",
    judgeRubric: "novelty (most weight) + plausibility + constraint compliance",
    baselines: [
      { model: "Claude Opus 4.7", meanCreativity: 7.30, totalScore: 73, topAnswer: 9 },
      { model: "GPT-5.5",          meanCreativity: 6.50, totalScore: 65, topAnswer: 9 },
      { model: "Gemini 2.5 Pro",   meanCreativity: 6.60, totalScore: 66, topAnswer: 9 },
    ],
  },
  {
    id: "animal-diamond-v1",
    shortTitle: "Animal-diamond",
    longTitle: "How would non-human animals use diamonds?",
    prompt:
      "Imagine diamonds existed naturally as found objects in the wild — just hard, transparent, " +
      "sometimes-shiny stones. No mining, no cutting, no commerce, no jewelry-meaning, no industrial uses. " +
      "Give 10 distinct ways NON-HUMAN ANIMALS might use, interact with, or be affected by diamonds — " +
      "based on REAL natural behaviors. Specify the animal explicitly.",
    rubricNote:
      "Each answer scored 0-10 on novelty + plausibility-of-behavior. Skipped answers count as 0.",
    judgeRubric: "novelty + grounding-in-real-cognition + non-anthropomorphic synthesis",
    baselines: [
      { model: "Claude Opus 4.7", meanCreativity: 7.30, totalScore: 73, topAnswer: 9 },
      { model: "GPT-5.5",          meanCreativity: 6.80, totalScore: 68, topAnswer: 9 },
      { model: "Gemini 2.5 Pro",   meanCreativity: 5.70, totalScore: 57, topAnswer: 8 },
    ],
  },
];

export function getExperiment(id: string): Experiment | null {
  return EXPERIMENTS.find((e) => e.id === id) ?? null;
}
