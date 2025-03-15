import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { MDocument } from "@mastra/rag";
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { LibSQLVector } from "@mastra/core/vector/libsql";

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
        indexName: z
            .string()
            .default("code_chunks")
            .describe("ベクトルストアのインデックス名"),
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

            // LibSQLVectorライブラリを使用してベクトルストアを初期化
            const vectorStore = new LibSQLVector({
                connectionUrl: `file:${dbPath}`,
            });

            // 必要に応じてインデックスを作成
            await vectorStore.createIndex({
                indexName: indexName,
                dimension: 1536, // OpenAI embedding-3-small の次元数
            });

            // 埋め込みベクトルを生成
            const { embeddings } = await embedMany({
                model: openai.embedding("text-embedding-3-small"),
                values: chunks.map((chunk) => chunk.text),
            });

            // メタデータを準備
            const metadata = chunks.map((chunk) => ({
                text: chunk.text,
                filePath: filePath,
                fileType: fileType,
                ...(chunk.metadata || {}),
            }));

            // ベクトルストアに保存
            await vectorStore.upsert({
                indexName: indexName,
                vectors: embeddings,
                metadata: metadata,
            });

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
