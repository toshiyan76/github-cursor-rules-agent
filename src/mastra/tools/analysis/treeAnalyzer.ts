import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

/**
 * tree構造解析ツール
 * リポジトリのディレクトリ構造を解析し、依存関係も分析します
 */
export const treeAnalyzerTool = createTool({
    id: "tree-analyzer",
    description:
        "treeコマンドを使ってリポジトリの構造を解析します。特定の拡張子でフィルタリングも可能です。",
    inputSchema: z.object({
        repositoryPath: z.string().describe("リポジトリのパス"),
        includeExtensions: z
            .array(z.string())
            .optional()
            .describe('含める拡張子のリスト (例: ["js", "ts", "json"])'),
        excludeExtensions: z
            .array(z.string())
            .optional()
            .describe("除外する拡張子のリスト"),
        maxDepth: z.number().optional().describe("表示する最大深度"),
        includeHidden: z
            .boolean()
            .optional()
            .default(false)
            .describe("隠しファイル（.で始まる）を含めるか"),
        excludePatterns: z
            .array(z.string())
            .optional()
            .describe("除外するパターン（.gitignore形式）"),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        tree: z.string().optional(),
        fileTypes: z.record(z.string(), z.number()).optional(),
        directoryCount: z.number().optional(),
        fileCount: z.number().optional(),
        treeJson: z.any().optional(),
    }),
    execute: async ({ context }) => {
        const {
            repositoryPath,
            includeExtensions,
            excludeExtensions,
            maxDepth,
            includeHidden,
            excludePatterns,
        } = context;

        try {
            // treeコマンドがインストールされているか確認
            try {
                await execAsync("which tree");
            } catch (error) {
                return {
                    success: false,
                    message:
                        'treeコマンドがインストールされていません。"brew install tree" でインストールしてください。',
                };
            }

            // .gitignoreの読み込み
            let gitignorePatterns: string[] = [];
            try {
                const gitignorePath = path.join(repositoryPath, ".gitignore");
                const gitignoreContent = await fs.readFile(
                    gitignorePath,
                    "utf-8"
                );
                gitignorePatterns = gitignoreContent
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => line && !line.startsWith("#"));
            } catch (error) {
                // .gitignoreが見つからない場合は無視
            }

            // .dockerignoreの読み込み
            let dockerignorePatterns: string[] = [];
            try {
                const dockerignorePath = path.join(
                    repositoryPath,
                    ".dockerignore"
                );
                const dockerignoreContent = await fs.readFile(
                    dockerignorePath,
                    "utf-8"
                );
                dockerignorePatterns = dockerignoreContent
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => line && !line.startsWith("#"));
            } catch (error) {
                // .dockerignoreが見つからない場合は無視
            }

            // コマンドを構築
            let command = `cd "${repositoryPath}" && tree`;

            // オプションを追加
            const options = [];

            // JSON出力
            options.push("-J");

            // 隠しファイル
            if (includeHidden) {
                options.push("-a");
            }

            // 深さ制限
            if (maxDepth !== undefined) {
                options.push(`-L ${maxDepth}`);
            }

            // ファイル拡張子フィルター
            if (includeExtensions && includeExtensions.length > 0) {
                options.push(
                    `-P "*.(${includeExtensions.join("|")})" --matchdirs`
                );
            }

            // 除外ファイル拡張子
            if (excludeExtensions && excludeExtensions.length > 0) {
                options.push(`-I "*.(${excludeExtensions.join("|")})"`);
            }

            // .gitignore & .dockerignore & カスタムパターン
            const allExcludePatterns = [
                ...gitignorePatterns,
                ...dockerignorePatterns,
                ...(excludePatterns || []),
            ];

            if (allExcludePatterns.length > 0) {
                // ワイルドカードをエスケープ
                const escapedPatterns = allExcludePatterns
                    .map((pattern) => {
                        // ディレクトリ名を抽出（末尾の/を削除）
                        const patternWithoutSlash = pattern.endsWith("/")
                            ? pattern.slice(0, -1)
                            : pattern;
                        return patternWithoutSlash;
                    })
                    .filter((pattern) => pattern && !pattern.startsWith("."))
                    .join("|");

                if (escapedPatterns) {
                    options.push(`-I "${escapedPatterns}"`);
                }
            }

            // オプションを追加
            if (options.length > 0) {
                command += ` ${options.join(" ")}`;
            }

            // コマンド実行
            const { stdout, stderr } = await execAsync(command);

            if (stderr) {
                return {
                    success: false,
                    message: `treeコマンドの実行中にエラーが発生しました: ${stderr}`,
                };
            }

            // テキスト形式のツリーを取得
            const { stdout: stdoutText } = await execAsync(
                `cd "${repositoryPath}" && tree -C --noreport`
            );

            // 結果を解析
            let treeJson;
            try {
                treeJson = JSON.parse(stdout);
            } catch (error: any) {
                return {
                    success: false,
                    message: `treeコマンドの出力をJSONとしてパースできませんでした: ${error.message}`,
                };
            }

            // ファイルタイプとディレクトリ/ファイル数を集計
            const stats = analyzeTreeJson(treeJson);

            return {
                success: true,
                message: "ディレクトリ構造の解析が完了しました。",
                tree: stdoutText,
                fileTypes: stats.fileTypes,
                directoryCount: stats.directoryCount,
                fileCount: stats.fileCount,
                treeJson,
            };
        } catch (error: any) {
            return {
                success: false,
                message: `ディレクトリ構造の解析に失敗しました: ${error.message}`,
            };
        }
    },
});

/**
 * TreeコマンドのJSON出力を解析して統計情報を生成
 */
function analyzeTreeJson(treeJson: any): {
    fileTypes: Record<string, number>;
    directoryCount: number;
    fileCount: number;
} {
    const fileTypes: Record<string, number> = {};
    let directoryCount = 0;
    let fileCount = 0;

    function traverse(node: any) {
        if (node.type === "directory") {
            directoryCount++;
            if (node.contents) {
                node.contents.forEach(traverse);
            }
        } else if (node.type === "file") {
            fileCount++;
            const nameParts = node.name.split(".");
            if (nameParts.length > 1) {
                const ext = nameParts.pop()?.toLowerCase() || "";
                fileTypes[ext] = (fileTypes[ext] || 0) + 1;
            } else {
                fileTypes["(no extension)"] =
                    (fileTypes["(no extension)"] || 0) + 1;
            }
        }
    }

    if (treeJson.length > 0) {
        traverse(treeJson[0]);
    }

    return {
        fileTypes,
        directoryCount,
        fileCount,
    };
}
