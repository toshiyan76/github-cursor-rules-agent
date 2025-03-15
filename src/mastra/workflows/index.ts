import { Workflow, Step } from "@mastra/core/workflows";
import { z } from "zod";
import { cursorRulesAgent } from "../agents";
import { Agent } from "@mastra/core";
import {
    CloneOutput,
    cloneOutputSchema,
} from "../tools/github/cloneRepository";
import path from "path";
import process from "process";

// 分析結果のスキーマを定義
export const analyzeOutputSchema = z
    .object({
        success: z.boolean().describe("分析操作が成功したかどうか"),
        message: z.string().describe("分析結果の詳細メッセージ"),
        readmeInfo: z
            .object({
                title: z
                    .string()
                    .optional()
                    .describe("READMEから抽出したプロジェクトタイトル"),
                description: z
                    .string()
                    .optional()
                    .describe("プロジェクトの説明文"),
                technologies: z
                    .array(z.string())
                    .optional()
                    .describe("使用されている技術スタック一覧"),
                architecture: z
                    .string()
                    .optional()
                    .describe("プロジェクトのアーキテクチャに関する情報"),
                installation: z
                    .string()
                    .optional()
                    .describe("インストール手順"),
                usage: z.string().optional().describe("使用方法"),
                contributing: z.string().optional().describe("貢献方法"),
                license: z.string().optional().describe("ライセンス情報"),
            })
            .optional()
            .describe("READMEファイルから抽出した構造化情報"),
        tokeiStats: z
            .object({
                languageSummary: z
                    .record(
                        z.string(),
                        z.object({
                            files: z.number().describe("ファイル数"),
                            lines: z.number().describe("合計行数"),
                            code: z.number().describe("コード行数"),
                            comments: z.number().describe("コメント行数"),
                            blanks: z.number().describe("空行数"),
                            complexity: z
                                .number()
                                .optional()
                                .describe("コード複雑度"),
                        })
                    )
                    .optional()
                    .describe("プログラミング言語別の統計情報"),
                totalSummary: z
                    .object({
                        files: z.number().describe("合計ファイル数"),
                        lines: z.number().describe("合計行数"),
                        code: z.number().describe("合計コード行数"),
                        comments: z.number().describe("合計コメント行数"),
                        blanks: z.number().describe("合計空行数"),
                    })
                    .optional()
                    .describe("リポジトリ全体の統計情報"),
                mainLanguage: z
                    .string()
                    .optional()
                    .describe("最も使用されているプログラミング言語"),
            })
            .optional()
            .describe("tokeiによる言語統計情報"),
        directoryStructure: z
            .object({
                tree: z
                    .string()
                    .optional()
                    .describe("テキスト形式のディレクトリツリー"),
                fileTypes: z
                    .record(z.string(), z.number())
                    .optional()
                    .describe("ファイル拡張子ごとの数"),
                directoryCount: z
                    .number()
                    .optional()
                    .describe("ディレクトリの総数"),
                fileCount: z.number().optional().describe("ファイルの総数"),
                treeJson: z
                    .any()
                    .optional()
                    .describe("JSON形式のディレクトリ構造"),
            })
            .optional()
            .describe("リポジトリのディレクトリ構造情報"),
    })
    .describe("リポジトリ分析の結果");

export type AnalyzeOutput = z.infer<typeof analyzeOutputSchema>;

// ワークフローの入力スキーマ
const cursorRulesWorkflowSchema = z.object({
    repositoryUrl: z.string().describe("解析するGitHubリポジトリのURL"),
    branch: z
        .string()
        .optional()
        .describe("クローンするブランチ（指定しない場合はデフォルトブランチ）"),
    outputPath: z
        .string()
        .optional()
        .describe("生成したCursor Rulesの出力先パス"),
});

type TriggerType = z.infer<typeof cursorRulesWorkflowSchema>;

// ステップ1: リポジトリのクローン
const cloneRepositoryStep = new Step({
    id: "clone-repository",
    description: "GitHubリポジトリをクローンする",
    inputSchema: z.object({
        repositoryUrl: z.string(),
        branch: z.string().optional(),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        repositoryPath: z.string(),
        message: z.string(),
    }),
    execute: async ({ context, mastra }) => {
        const { repositoryUrl, branch } =
            context.getStepResult<TriggerType>("trigger");

        const agent = mastra?.getAgent("cursorRulesAgent");
        if (!agent) {
            throw new Error("cursorRulesAgentが見つかりません");
        }

        const response = await agent?.generate(
            `リポジトリ ${repositoryUrl} をクローンしてください${branch ? `（ブランチ: ${branch}）` : ""}。`,
            {
                toolChoice: {
                    type: "tool",
                    toolName: "clone-repository",
                },
                output: cloneOutputSchema,
            }
        );

        if (!response) {
            throw new Error("リポジトリのクローンに失敗しました");
        }

        const { success, message, repositoryFullPath, cloneDirectoryName } =
            response.object;

        console.log("クローン結果:", JSON.stringify(response.object, null, 2));

        // 実際のリポジトリパスを決定
        let actualRepositoryPath = repositoryFullPath;

        // 想定外の値が返された場合のフォールバック処理
        if (!actualRepositoryPath && cloneDirectoryName) {
            console.log(
                `警告: repositoryFullPathが取得できませんでした。cloneDirectoryName ${cloneDirectoryName} から構築します。`
            );
            // 相対パスを絶対パスに変換
            if (path.isAbsolute(cloneDirectoryName)) {
                actualRepositoryPath = cloneDirectoryName;
            } else {
                actualRepositoryPath = path.resolve(
                    process.cwd(),
                    cloneDirectoryName
                );
            }
        }

        return {
            success,
            repositoryPath: actualRepositoryPath || "",
            message,
        };
    },
});

// ステップ2: リポジトリの初期分析
const analyzeRepositoryStep = new Step({
    id: "analyze-repository",
    description: "リポジトリの構造と統計情報を収集する",
    inputSchema: z.object({
        repositoryPath: z.string(),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        summary: z.string(),
        readmeInfo: z.any(),
        tokeiStats: z.any(),
        directoryStructure: z.any(),
    }),
    execute: async ({ context, mastra }) => {
        const { repositoryPath } = context.getStepResult(cloneRepositoryStep);

        if (!repositoryPath) {
            throw new Error("リポジトリパスが見つかりません");
        }

        const agent = mastra?.getAgent("cursorRulesAgent");
        if (!agent) {
            throw new Error("cursorRulesAgentが見つかりません");
        }

        const response = await agent?.generate(
            `リポジトリ ${repositoryPath} のREADME、tokei統計、ディレクトリ構造を分析してください。
            
次の手順で進めてください：
1. READMEの内容を解析して、プロジェクトの目的と概要を把握する
2. tokeiを使用して言語統計を収集し、使用されている主要言語を特定する
3. treeコマンドでディレクトリ構造を分析する`,
            {
                output: analyzeOutputSchema,
            }
        );

        if (!response) {
            throw new Error("リポジトリの分析に失敗しました");
        }

        // GenerateObjectResultの場合はobjectプロパティを使用
        const { success, message, readmeInfo, tokeiStats, directoryStructure } =
            response.object;

        // 主要言語の特定
        let mainLanguage = "";
        if (tokeiStats?.languageSummary) {
            let maxCode = 0;
            for (const [lang, stats] of Object.entries(
                tokeiStats.languageSummary
            )) {
                if (stats.code > maxCode) {
                    maxCode = stats.code;
                    mainLanguage = lang;
                }
            }
        }

        return {
            success: true,
            summary: message || "",
            readmeInfo: readmeInfo || {},
            tokeiStats: tokeiStats || {},
            directoryStructure: directoryStructure || {},
            mainLanguage,
        };
    },
});

// ステップ3: 重要ファイルの特定と計画
const identifyImportantFilesStep = new Step({
    id: "identify-important-files",
    description: "重要なファイルを特定し、解析計画を立てる",
    inputSchema: z.object({
        repositoryPath: z.string(),
        summary: z.string(),
        readmeInfo: z.any(),
        tokeiStats: z.any(),
        directoryStructure: z.any(),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        plan: z.string(),
        importantFiles: z.array(z.string()),
    }),
    execute: async ({ context, mastra }) => {
        const { repositoryPath } = context.getStepResult(cloneRepositoryStep);
        const { summary, readmeInfo, tokeiStats, directoryStructure } =
            context.getStepResult(analyzeRepositoryStep);

        const agent = mastra!.getAgent("cursorRulesAgent");
        const response = await agent.generate(`
これまでの分析に基づいて、リポジトリ ${repositoryPath} の重要なファイルを特定し、それらをベクトルデータベースに格納するための計画を立ててください。
以下の情報を参考にしてください：
1. READMEの分析: ${JSON.stringify(readmeInfo)}
2. 言語統計: ${JSON.stringify(tokeiStats)}
3. ディレクトリ構造: ${JSON.stringify(directoryStructure)}
`);

        return {
            success: true,
            plan: response.text,
            importantFiles: response.toolCalls?.[0]?.args?.importantFiles || [],
        };
    },
});

// ステップ4: ファイルの処理とRAG構築
const processFilesStep = new Step({
    id: "process-files",
    description: "重要ファイルを処理してRAGを構築する",
    inputSchema: z.object({
        repositoryPath: z.string(),
        importantFiles: z.array(z.string()),
        plan: z.string(),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        processedFiles: z.array(z.string()),
        message: z.string(),
    }),
    execute: async ({ context, mastra }) => {
        const { repositoryPath } = context.getStepResult(cloneRepositoryStep);
        const { importantFiles, plan } = context.getStepResult(
            identifyImportantFilesStep
        );

        const agent = mastra!.getAgent("cursorRulesAgent");
        const response = await agent.generate(`
リポジトリ ${repositoryPath} の重要ファイルをベクトルデータベースに格納してください。
処理計画: ${plan}
重要ファイル: ${JSON.stringify(importantFiles)}
`);

        return {
            success: true,
            processedFiles: response.toolCalls?.[0]?.args?.processedFiles || [],
            message: response.text,
        };
    },
});

// ステップ5: チートシート生成
const generateCursorRulesStep = new Step({
    id: "generate-cursor-rules",
    description: "ベクトルデータベースの情報を元にCursor Rulesを生成する",
    inputSchema: z.object({
        repositoryPath: z.string(),
        processedFiles: z.array(z.string()),
        outputPath: z.string().optional(),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        cursorRules: z.string(),
        outputPath: z.string(),
    }),
    execute: async ({ context, mastra }) => {
        const { repositoryPath } = context.getStepResult(cloneRepositoryStep);
        const { processedFiles } = context.getStepResult(processFilesStep);
        const { outputPath } = context.getStepResult("trigger");

        const finalOutputPath =
            outputPath ||
            `./.cursor/rules/${repositoryPath.split("/").pop()}.mdc`;

        const agent = mastra!.getAgent("cursorRulesAgent");
        const response = await agent.generate(`
ベクトルデータベースに格納された情報を元に、${repositoryPath} プロジェクトのためのCursor Rulesチートシートを生成してください。
処理済みファイル: ${JSON.stringify(processedFiles)}
出力先パス: ${finalOutputPath}

チートシートには以下の内容を含めてください：
1. プロジェクトの全体構造と設計パターン
2. 重要なクラス・関数と依存関係
3. コーディング規約と命名パターン
4. ユニークなデザインパターンと実装の特徴
`);

        return {
            success: true,
            cursorRules: response.text,
            outputPath: finalOutputPath,
        };
    },
});

// ワークフローの定義
export const cursorRulesWorkflow = new Workflow({
    name: "cursor-rules-workflow",
    triggerSchema: cursorRulesWorkflowSchema,
})
    .step(cloneRepositoryStep)
    .then(analyzeRepositoryStep)
    .then(identifyImportantFilesStep)
    .then(processFilesStep)
    .then(generateCursorRulesStep);

// ワークフローをコミット
cursorRulesWorkflow.commit();
