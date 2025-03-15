import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { LibSQLVector } from "@mastra/core/vector/libsql";
import { embed } from "ai";
import { googleEmbeddingModel } from "../../models";

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
        indexName: z.string().describe("ベクトルストアのインデックス名"),
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
        const { query, dbPath, indexName } = context;

        try {
            // ベクトルストアを初期化
            const vectorStore = new LibSQLVector({
                connectionUrl: `file:${dbPath}`,
            });

            try {
                // クエリをベクトル化
                const { embedding } = await embed({
                    model: googleEmbeddingModel,
                    value: query,
                });

                // ベクトル検索を実行
                const searchResults = await vectorStore.query({
                    indexName: indexName,
                    queryVector: embedding,
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
            } catch (embeddingError: any) {
                // エンベディングエラーが発生した場合は、ダミーの結果を返す
                console.warn(
                    `エンベディング処理でエラーが発生しました: ${embeddingError.message}`
                );
                return {
                    success: false,
                    message: `エンベディング処理でエラーが発生しました: ${embeddingError.message}`,
                    results: [],
                };
            }
        } catch (error: any) {
            return {
                success: false,
                message: `検索中にエラーが発生しました: ${error.message}`,
                results: [],
            };
        }
    },
});
