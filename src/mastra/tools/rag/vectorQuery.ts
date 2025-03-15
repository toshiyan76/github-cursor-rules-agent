import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { LibSQLVector } from "@mastra/core/vector/libsql";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";

/**
 * ベクトルデータベースからクエリを実行するツール
 */
export const vectorQueryTool = createTool({
    id: "vector-query",
    description:
        "ベクトルデータベースに対してクエリを実行し、関連するコード片を取得します",
    inputSchema: z.object({
        query: z.string().describe("検索クエリ"),
        dbPath: z
            .string()
            .default("vector_store.db")
            .describe("ベクトルストアのDBパス"),
        indexName: z
            .string()
            .default("code_chunks")
            .describe("ベクトルストアのインデックス名"),
        limit: z.number().default(5).describe("取得する結果の数"),
        threshold: z.number().default(0.7).describe("類似度のしきい値（0～1）"),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        results: z
            .array(
                z.object({
                    text: z.string(),
                    filePath: z.string().optional(),
                    fileType: z.string().optional(),
                    similarity: z.number().optional(),
                    metadata: z.any().optional(),
                })
            )
            .optional(),
    }),
    execute: async ({ context }) => {
        const { query, dbPath, indexName, limit, threshold } = context;

        try {
            // ベクトルストアを初期化
            const vectorStore = new LibSQLVector({
                connectionUrl: `file:${dbPath}`,
            });

            // クエリをベクトル化
            const { embedding } = await embed({
                model: openai.embedding("text-embedding-3-small"),
                value: query,
            });

            // ベクトル検索を実行
            const searchResults = await vectorStore.query({
                indexName: indexName,
                vector: embedding,
                limit: limit,
                threshold: threshold,
            });

            if (!searchResults || searchResults.length === 0) {
                return {
                    success: true,
                    message: "クエリに一致する結果が見つかりませんでした。",
                    results: [],
                };
            }

            // 結果を整形
            const formattedResults = searchResults.map((result: any) => ({
                text: result.metadata?.text || "",
                filePath: result.metadata?.filePath || "",
                fileType: result.metadata?.fileType || "",
                similarity: result.similarity,
                metadata: result.metadata || {},
            }));

            return {
                success: true,
                message: `${searchResults.length}件の結果が見つかりました。`,
                results: formattedResults,
            };
        } catch (error: any) {
            return {
                success: false,
                message: `検索中にエラーが発生しました: ${error.message}`,
                results: [],
            };
        }
    },
});
