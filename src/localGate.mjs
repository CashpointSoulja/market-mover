// Free first-pass gate: an open-source zero-shot classifier (DeBERTa-v3 xsmall trained on NLI) running locally
// via transformers.js. Like Jev it returns a typed decision with a probability and writes no text, but it is
// free and runs here in about 20 ms. It only drops clear chatter; the Haiku gate (via Mubit) decides the rest.
import { pipeline, env } from "@huggingface/transformers";

export const LOCAL_GATE_MODEL = "Xenova/nli-deberta-v3-xsmall";
const LABELS = ["a specific new fact, result or announcement", "an opinion, joke, advert or chatter"];
env.cacheDir = new URL("../data/models/", import.meta.url).pathname;

let classifier = null;
export const localGateReady = () => classifier !== null;

export async function loadLocalGate() {
  classifier = await pipeline("zero-shot-classification", LOCAL_GATE_MODEL, { dtype: "q8" });
}

// Probability (0-1) that the post states a fact; null while the model is still loading.
export async function factScore(text) {
  if (!classifier) return null;
  const r = await classifier(text.slice(0, 500), LABELS, { hypothesis_template: "This post is {}." });
  return r.scores[r.labels.indexOf(LABELS[0])];
}
