import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { MDocument } from "@mastra/rag";
import { embedMany } from "ai";
import { LibSQLVector } from "@mastra/core/vector/libsql";
import { googleEmbeddingModel } from "../../models";

/**
 * ファイルを処理してチャンキング、ベクトル化、保存を行うツール
 */
export const fileProcessorTool = createTool({
    id: "file-processor",
    description:
        "ファイルを受け取り、チャンキングしてベクトルストアに保存します",
    inputSchema: z.object({
        filePath: z.string().describe("処理するファイルのパス"),
        strategy: z
            .enum([
                "recursive",
                "character",
                "token",
                "markdown",
                "html",
                "json",
                "latex",
            ])
            .default("recursive")
            .describe("チャンキング戦略"),
        chunkSize: z.number().default(512).describe("チャンクのサイズ"),
        overlap: z.number().default(50).describe("チャンク間の重複トークン数"),
        separator: z.string().default("\n").describe("区切り文字"),
        dbPath: z
            .string()
            .default("vector_store.db")
            .describe("ベクトルストアのDBパス"),
        indexName: z.string().describe("ベクトルストアのインデックス名"),
        extractMetadata: z
            .boolean()
            .default(true)
            .describe("メタデータを抽出するか"),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        filePath: z.string(),
        strategy: z.string(),
        chunkCount: z.number().optional(),
        fileType: z.string().optional(),
        metadata: z.any().optional(),
    }),
    execute: async ({ context }) => {
        const {
            filePath,
            strategy,
            chunkSize,
            overlap,
            separator,
            dbPath,
            indexName,
            extractMetadata,
        } = context;

        try {
            // ファイルが存在するか確認
            try {
                await fs.access(filePath);
            } catch (error) {
                return {
                    success: false,
                    message: `ファイル ${filePath} が見つかりません。`,
                    filePath,
                    strategy,
                };
            }

            // ファイル内容を読み込む
            const fileContent = await fs.readFile(filePath, "utf-8");

            if (!fileContent) {
                return {
                    success: false,
                    message: `ファイル ${filePath} は空です。`,
                    filePath,
                    strategy,
                };
            }

            // ファイルタイプを判断
            const fileExt = path.extname(filePath).toLowerCase();
            let fileType = "text";
            let doc;

            // ファイル拡張子に基づいて適切なMDocumentインスタンスを作成
            switch (fileExt) {
                case ".md":
                case ".markdown":
                    fileType = "markdown";
                    doc = MDocument.fromMarkdown(fileContent);
                    break;
                case ".html":
                case ".htm":
                    fileType = "html";
                    doc = MDocument.fromHTML(fileContent);
                    break;
                case ".json":
                    fileType = "json";
                    doc = MDocument.fromJSON(fileContent);
                    break;
                default:
                    fileType = "text";
                    doc = MDocument.fromText(fileContent);
            }

            // チャンキング - extractMetadataのエラーを修正
            const chunks = await doc.chunk({
                strategy: strategy,
                size: chunkSize,
                overlap: overlap,
                separator: separator,
            });

            if (chunks.length === 0) {
                return {
                    success: false,
                    message: `ファイル ${filePath} からチャンクを抽出できませんでした。`,
                    filePath,
                    strategy,
                    fileType,
                };
            }

            // チャンク処理成功のログ（埋め込み処理なしの場合のフォールバック用）
            console.log(
                `ファイル ${filePath} から ${chunks.length} 個のチャンクを抽出しました`
            );

            try {
                // LibSQLVectorライブラリを使用してベクトルストアを初期化
                const vectorStore = new LibSQLVector({
                    connectionUrl: `file:${dbPath}`,
                });

                // 必要に応じてインデックスを作成
                await vectorStore.createIndex({
                    indexName: indexName,
                    dimension: 768, // Google text-embedding-004 の次元数
                });

                // 埋め込みベクトルを生成
                // Googleのモデルは一度に最大100個のリクエストしか処理できないため、バッチ処理を実装
                const batchSize = 100;
                let allEmbeddings = [];

                for (let i = 0; i < chunks.length; i += batchSize) {
                    const batchChunks = chunks.slice(i, i + batchSize);
                    console.log(
                        `バッチ処理: ${i + 1}〜${Math.min(i + batchSize, chunks.length)}/${chunks.length}チャンク`
                    );

                    const { embeddings } = await embedMany({
                        model: googleEmbeddingModel,
                        values: batchChunks.map((chunk) => chunk.text),
                    });

                    allEmbeddings.push(...embeddings);
                }

                // メタデータを準備
                const metadata = chunks.map((chunk) => ({
                    text: chunk.text,
                    filePath: filePath,
                    fileType: fileType,
                    ...(chunk.metadata || {}),
                }));

                // ベクトルストアに保存（こちらもバッチ処理）
                for (let i = 0; i < allEmbeddings.length; i += batchSize) {
                    const batchEmbeddings = allEmbeddings.slice(
                        i,
                        i + batchSize
                    );
                    const batchMetadata = metadata.slice(i, i + batchSize);

                    console.log(
                        `ベクトル保存: ${i + 1}〜${Math.min(i + batchSize, allEmbeddings.length)}/${allEmbeddings.length}ベクトル`
                    );

                    await vectorStore.upsert({
                        indexName: indexName,
                        vectors: batchEmbeddings,
                        metadata: batchMetadata,
                    });
                }

                return {
                    success: true,
                    message: `ファイル ${filePath} のチャンキングと埋め込みが完了しました。${chunks.length}個のチャンクを作成しました。`,
                    filePath,
                    strategy,
                    chunkCount: chunks.length,
                    fileType,
                    metadata: {
                        totalChunks: chunks.length,
                        averageChunkLength: Math.round(
                            chunks.reduce(
                                (sum, chunk) => sum + chunk.text.length,
                                0
                            ) / chunks.length
                        ),
                    },
                };
            } catch (embeddingError: any) {
                // 埋め込み処理が失敗した場合でもチャンキング結果を返す
                console.warn(
                    `埋め込み処理でエラーが発生しました: ${embeddingError.message}`
                );
                return {
                    success: true,
                    message: `ファイル ${filePath} のチャンキングは成功しましたが、埋め込み処理でエラーが発生しました: ${embeddingError.message}`,
                    filePath,
                    strategy,
                    chunkCount: chunks.length,
                    fileType,
                };
            }
        } catch (error: any) {
            return {
                success: false,
                message: `ファイル処理中にエラーが発生しました: ${error.message}`,
                filePath,
                strategy,
            };
        }
    },
});
