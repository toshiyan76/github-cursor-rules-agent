import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

/**
 * GitHub リポジトリをクローンするツール
 * LFS対応とサブモジュール処理も可能
 */
export const cloneRepositoryTool = createTool({
    id: "clone-repository",
    description: "GitHub リポジトリをクローンします",
    inputSchema: z.object({
        repositoryUrl: z
            .string()
            .describe("リポジトリのURL（https://github.com/user/repo 形式）"),
        branch: z
            .string()
            .optional()
            .describe(
                "クローンするブランチ（指定しない場合はデフォルトブランチ）"
            ),
        targetDir: z
            .string()
            .optional()
            .describe("クローン先ディレクトリ（指定しない場合はリポジトリ名）"),
        includeLfs: z
            .boolean()
            .optional()
            .default(false)
            .describe("Git LFSファイルも取得するか"),
        includeSubmodules: z
            .boolean()
            .optional()
            .default(false)
            .describe("サブモジュールも取得するか"),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        repoPath: z.string().optional(),
    }),
    execute: async ({ context }) => {
        const {
            repositoryUrl,
            branch,
            targetDir,
            includeLfs,
            includeSubmodules,
        } = context;

        try {
            // リポジトリ名を取得
            const repoName =
                repositoryUrl.split("/").pop()?.replace(".git", "") || "repo";
            const cloneDir = targetDir || repoName;
            const fullPath = path.resolve(process.cwd(), cloneDir);

            // ディレクトリが既に存在するか確認
            if (fs.existsSync(fullPath)) {
                return {
                    success: false,
                    message: `ディレクトリ ${cloneDir} は既に存在します。別の名前を指定してください。`,
                };
            }

            // クローンコマンドを構築
            let command = `git clone ${repositoryUrl}`;

            // ブランチが指定されている場合
            if (branch) {
                command += ` -b ${branch}`;
            }

            // サブモジュールが必要な場合
            if (includeSubmodules) {
                command += ` --recurse-submodules`;
            }

            // ターゲットディレクトリを指定
            command += ` ${cloneDir}`;

            // コマンド実行
            const { stdout, stderr } = await execAsync(command);

            // LFSファイルが必要な場合
            if (includeLfs) {
                try {
                    // ディレクトリに移動してLFSファイルを取得
                    await execAsync(`cd ${cloneDir} && git lfs pull`);
                } catch (error: any) {
                    return {
                        success: true,
                        message: `リポジトリのクローンは成功しましたが、LFSファイルの取得に失敗しました: ${error.message}`,
                        repoPath: fullPath,
                    };
                }
            }

            return {
                success: true,
                message: `リポジトリを ${fullPath} にクローンしました。`,
                repoPath: fullPath,
            };
        } catch (error: any) {
            return {
                success: false,
                message: `クローンに失敗しました: ${error.message}`,
            };
        }
    },
});
