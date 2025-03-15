import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Google Gemini AIプロバイダーの作成
export const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY || "",
});

// エンべディングモデルのインスタンス
export const googleEmbeddingModel =
    google.textEmbeddingModel("text-embedding-004");

// 汎用AIモデルのインスタンス
export const googleAIModel = google("gemini-2.0-flash-001", {});
