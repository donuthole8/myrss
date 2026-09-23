import type { Article, Feed } from "./types";

/**
 * AI 関連の判定。略語は大文字小文字を区別して単語境界で見る
 * (「rag」「mail」などに引っかからないように)。
 * 日本語の中の略語 (生成AIを) も \b で切れる。
 */
const ACRONYMS = /\b(AI|AGI|LLMs?|GPT(-?\d[\w.]*)?|RAG|MCP|NLP|VLM|SLM|RLHF|LoRA)\b/;
const NAMES =
  /(chatgpt|openai|anthropic|claude|gemini|copilot|deepmind|hugging ?face|llama|mistral|deepseek|qwen|grok|perplexity|stable diffusion|midjourney|transformer|diffusion model|neural|machine learning|deep learning|language model|fine-?tun|embedding|prompt|agentic|ai agent|生成ai|人工知能|機械学習|深層学習|ディープラーニング|ニューラル|言語モデル|プロンプト|ファインチューニング|エージェント|推論モデル|画像生成)/i;

/** AI トピックとして常に含めるフォルダ (プリセットの AI パックの入れ先) */
export const AI_FOLDER = "AI";

export function isAiText(text: string): boolean {
  return ACRONYMS.test(text) || NAMES.test(text);
}

export function isAiArticle(
  article: Article,
  aiFeeds: Set<string>,
  translated?: string,
): boolean {
  if (aiFeeds.has(article.feedUrl)) return true;
  return (
    isAiText(article.title) ||
    (!!translated && isAiText(translated)) ||
    isAiText(article.summary.slice(0, 300))
  );
}

export function aiFeedUrls(feeds: Feed[]): Set<string> {
  return new Set(feeds.filter((f) => f.folder === AI_FOLDER).map((f) => f.url));
}
