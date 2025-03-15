import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

/**
 * チートシート保存操作の結果を表すスキーマ
 */
export const saveCheatsheetOutputSchema = z
    .object({
        success: z.boolean().describe("保存操作が成功したかどうか"),
        message: z.string().describe("操作結果の詳細メッセージ"),
        filePath: z.string().describe("保存されたファイルのパス"),
        filename: z.string().describe("ファイル名"),
        bytesWritten: z.number().optional().describe("書き込まれたバイト数"),
        isContinuation: z.boolean().optional().describe("継続書き込みかどうか"),
        contentLength: z.number().optional().describe("コンテンツの長さ"),
    })
    .describe("チートシート保存操作の結果");

/**
 * チートシートを保存するツール
 */
export const saveCheatsheetTool = createTool({
    id: "save-cheatsheet",
    description: "生成されたチートシートをファイルに保存します",
    inputSchema: z.object({
        content: z.string().describe("保存するチートシートの内容"),
        outputPath: z.string().describe("保存先のファイルパス"),
        append: z
            .boolean()
            .default(false)
            .describe("既存ファイルに追記する場合はtrue"),
        section: z
            .string()
            .optional()
            .describe("セクション名（複数セクションに分割する場合）"),
        sectionIndex: z
            .number()
            .optional()
            .describe("セクションのインデックス"),
        totalSections: z.number().optional().describe("総セクション数"),
    }),
    outputSchema: saveCheatsheetOutputSchema,
    execute: async ({ context }) => {
        const { content, outputPath, append, section } = context;

        try {
            // 出力ディレクトリが存在することを確認
            const dirPath = path.dirname(outputPath);
            try {
                await fs.mkdir(dirPath, { recursive: true });
            } catch (error) {
                // ディレクトリ作成エラーを無視（既に存在する場合など）
            }

            // ファイルへの書き込みフラグ
            const flag = append ? "a" : "w";

            // セクションヘッダーを追加（指定されている場合）
            let contentToWrite = content;
            if (section && !append) {
                contentToWrite = `# ${section}\n\n${content}`;
            } else if (section && append) {
                contentToWrite = `\n\n# ${section}\n\n${content}`;
            }

            // ファイルに書き込み
            await fs.writeFile(outputPath, contentToWrite, { flag });

            // ファイル情報の取得
            const stats = await fs.stat(outputPath);

            return {
                success: true,
                message: append
                    ? `チートシートを ${outputPath} に追記しました${section ? ` (セクション: ${section})` : ""}`
                    : `チートシートを ${outputPath} に保存しました${section ? ` (セクション: ${section})` : ""}`,
                filePath: outputPath,
                filename: path.basename(outputPath),
                bytesWritten: Buffer.byteLength(contentToWrite, "utf8"),
                isContinuation: append,
                contentLength: stats.size,
            };
        } catch (error: any) {
            return {
                success: false,
                message: `チートシートの保存中にエラーが発生しました: ${error.message}`,
                filePath: outputPath,
                filename: path.basename(outputPath),
            };
        }
    },
});
