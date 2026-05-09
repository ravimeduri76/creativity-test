import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creativity Test — How creative are you, vs LLMs?",
  description:
    "A small thought-experiment game. Write 10 answers to a constrained creativity prompt; an independent LLM judge scores you against Claude, GPT, and Gemini.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-4xl px-6 py-10">
          <header className="mb-10">
            <a href="/" className="font-serif text-xl font-bold tracking-tight text-ink">
              Creativity Test
            </a>
            <p className="mt-1 text-sm text-slate-600">
              How creative are you compared to frontier LLMs?
            </p>
          </header>
          <main>{children}</main>
          <footer className="mt-20 border-t border-slate-200 pt-6 text-xs text-slate-500">
            <p>
              Companion to{" "}
              <a className="underline" href="https://github.com/ravimeduri76">@ravimeduri76</a>
              {"'"}s posts on LLM creativity. Submissions are anonymous unless you opt in.
              Source: <a className="underline" href="https://github.com/ravimeduri76/creativity-test">github.com/ravimeduri76/creativity-test</a>.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
