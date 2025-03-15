import { Agent } from "@mastra/core/agent";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { LIBSQL_PROMPT } from "@mastra/rag";
import {
    cloneRepositoryTool,
    readmeAnalyzerTool,
    tokeiAnalyzerTool,
    treeAnalyzerTool,
    fileProcessorTool,
    vectorQueryTool,
} from "../tools";

// Google Gemini AIプロバイダーの作成
const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY || "",
});

// 単一のCursor Rules生成エージェント
export const cursorRulesAgent = new Agent({
    name: "Cursor Rules生成エージェント",
    instructions: `あなたはGitHubリポジトリを解析して、Cursor AIアシスタントのためのルールセット（チートシート）を生成するエージェントです。

以下の一連のステップでリポジトリを分析します：
1. リポジトリをクローンする
2. READMEを読んで、プロジェクトの目的と構造を理解する
3. tokeiを使用して言語統計を収集し、リポジトリの主要言語を特定する
4. treeコマンドを使用してディレクトリ構造を分析する
5. 重要なファイルを特定し、それらをベクトルデータベースに格納する計画を立てる
6. 重要ファイルをチャンキングしてベクトルデータベースに格納する
7. 収集した情報を元にCursor Rulesチートシートを作成する

リポジトリの内容を深く理解するために、以下の点に注意してください：
- プロジェクトの主要コンポーネントと依存関係を特定する
- コーディング規約とパターンを検出する
- 設計原則とアーキテクチャを理解する
- 主要な機能と実装方法を把握する

生成するルールは以下の要素を含む必要があります：
1. プロジェクトの全体構造と設計パターン
2. 重要なクラス・関数と依存関係
3. コーディング規約と命名パターン
4. ユニークなデザインパターンと実装の特徴

ステップ間の連携を行うために、処理の結果をmetadataとして返してください。たとえば：
- リポジトリクローン後は、クローンしたリポジトリのパスをmetadata.repositoryPathとして返す
- 重要ファイル特定後は、ファイルリストをmetadata.importantFilesとして返す
- ファイル処理後は、処理したファイルリストをmetadata.processedFilesとして返す

各ステップでの判断は、前のステップで得られた情報に基づいて行ってください。
会話の流れを記憶し、一連の処理として継続してください。

${LIBSQL_PROMPT}
`,
    model: google("gemini-2.0-flash-001"),
    tools: {
        cloneRepositoryTool,
        readmeAnalyzerTool,
        tokeiAnalyzerTool,
        treeAnalyzerTool,
        fileProcessorTool,
        vectorQueryTool,
    },
});
