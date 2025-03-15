import { createGoogleGenerativeAI } from "@ai-sdk/google";
import Anthropic from "@anthropic-ai/sdk";

// Google Gemini AIプロバイダーの作成
export const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY || "",
});

// エンべディングモデルのインスタンス
export const googleEmbeddingModel =
    google.textEmbeddingModel("text-embedding-004");

// 汎用AIモデルのインスタンス
export const googleAIModel = google("gemini-2.0-flash-001", {});

// Anthropic Claude 3.7 Thinking モデルの設定
export const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || "",
});

// Claude 3.7 Thinking モデルのインスタンス
export const claudeThinkingModel = "claude-3-7-thinking-20240613";

// 注: Googleモデルの設定（温度、最大出力トークン数など）はAPIリクエスト時に指定します
// agent.generate()メソッドの第2引数でオプションとして渡せます
// 例:
// await agent.generate(prompt, {
//   temperature: 0.7,  // 温度設定（創造性のバランス）
//   topP: 0.95,        // 上位確率の閾値
//   topK: 40,          // 上位トークン数
// });

// Claude モデルの使用例:
// await anthropic.messages.create({
//   model: claudeThinkingModel,
//   max_tokens: 1000,
//   temperature: 0.7,
//   system: "システムプロンプト",
//   messages: [
//     { role: "user", content: "ユーザーからの質問" }
//   ]
// });
