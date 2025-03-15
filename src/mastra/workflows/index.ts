import { Workflow, Step } from "@mastra/core/workflows";
import { z } from "zod";

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

// ステップ1: リポジトリのクローン
const cloneRepositoryStep = new Step({
    id: "clone-repository",
    description: "GitHubリポジトリをクローンする",
    inputSchema: z.object({
        repositoryUrl: z.string(),
        branch: z.string().optional(),
    }),
    execute: async ({ context, mastra }) => {
        const { repositoryUrl, branch } = context.getStepResult("trigger");

        const agent = mastra?.getAgent("cursorRulesAgent");
        const response = await agent?.generate(
            `リポジトリ ${repositoryUrl} をクローンしてください${branch ? `（ブランチ: ${branch}）` : ""}。`
        );

        return {
            success: true,
            repositoryPath:
                response?.toolCalls?.[0]?.args?.repositoryPath || "",
            message: response?.text || "",
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
    execute: async ({ context, mastra }) => {
        const { repositoryPath } = context.getStepResult("clone-repository");

        if (!repositoryPath) {
            throw new Error("リポジトリパスが見つかりません");
        }

        const agent = mastra?.getAgent("cursorRulesAgent");
        const response = await agent?.generate(
            `リポジトリ ${repositoryPath} のREADME、tokei統計、ディレクトリ構造を分析してください。`
        );

        return {
            success: true,
            summary: response?.text || "",
            readmeInfo: response?.toolCalls?.[0]?.args?.readmeInfo || {},
            tokeiStats: response?.toolCalls?.[0]?.args?.tokeiStats || {},
            directoryStructure:
                response?.toolCalls?.[0]?.args?.directoryStructure || {},
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
    execute: async ({ context, mastra }) => {
        const { repositoryPath } = context.getStepResult("clone-repository");
        const { summary, readmeInfo, tokeiStats, directoryStructure } =
            context.getStepResult("analyze-repository");

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
    execute: async ({ context, mastra }) => {
        const { repositoryPath } = context.getStepResult("clone-repository");
        const { importantFiles, plan } = context.getStepResult(
            "identify-important-files"
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
    execute: async ({ context, mastra }) => {
        const { repositoryPath } = context.getStepResult("clone-repository");
        const { processedFiles } = context.getStepResult("process-files");
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
