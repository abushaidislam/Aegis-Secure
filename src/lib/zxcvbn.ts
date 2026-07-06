// Lazy-loaded zxcvbn wrapper. The library ships ~140KB of dictionaries so we
// keep it out of the initial bundle and load it on demand the first time a
// passphrase field asks for a score.

export interface PassphraseScore {
  /** 0 (weakest) – 4 (strongest). */
  score: 0 | 1 | 2 | 3 | 4;
  warning: string;
  suggestions: string[];
}

let factoryPromise: Promise<{ check: (pw: string) => { score: number; feedback: { warning?: string | null; suggestions?: string[] } } }> | null = null;

async function getFactory() {
  if (factoryPromise) return factoryPromise;
  factoryPromise = (async () => {
    const [core, common, en] = await Promise.all([
      import("@zxcvbn-ts/core"),
      import("@zxcvbn-ts/language-common"),
      import("@zxcvbn-ts/language-en"),
    ]);
    return new core.ZxcvbnFactory({
      translations: en.translations,
      graphs: common.adjacencyGraphs,
      dictionary: {
        ...common.dictionary,
        ...en.dictionary,
      },
    });
  })();
  return factoryPromise;
}

/** Warm the dictionaries in the background — cheap to call multiple times. */
export function preloadZxcvbn() {
  void getFactory();
}

export async function evaluatePassphrase(pw: string): Promise<PassphraseScore> {
  if (!pw) return { score: 0, warning: "", suggestions: [] };
  const factory = await getFactory();
  const result = factory.check(pw);
  return {
    score: Math.max(0, Math.min(4, result.score)) as 0 | 1 | 2 | 3 | 4,
    warning: result.feedback.warning ?? "",
    suggestions: result.feedback.suggestions ?? [],
  };
}
