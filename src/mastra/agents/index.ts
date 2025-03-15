import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/core/storage/libsql";
import { LibSQLVector } from "@mastra/core/vector/libsql";
import {
    cloneRepositoryTool,
    readmeAnalyzerTool,
    tokeiAnalyzerTool,
    treeAnalyzerTool,
    fileProcessorTool,
    vectorQueryTool,
    saveCheatsheetTool,
} from "../tools";
import { openRouter } from "../models";

// メモリの設定（LibSQLをストレージとベクターデータベースに使用）
const memory = new Memory({
    storage: new LibSQLStore({
        config: {
            url: process.env.DATABASE_URL || "file:local.db",
        },
    }),
    vector: new LibSQLVector({
        connectionUrl: process.env.DATABASE_URL || "file:local.db",
    }),
    options: {
        lastMessages: 30, // 会話履歴の保持数を増やす（10→30）
        semanticRecall: {
            topK: 5, // より多くの関連メッセージを取得（3→5）
            messageRange: 3, // コンテキスト範囲を拡大（2→3）
        },
        workingMemory: {
            enabled: true, // ワーキングメモリを有効化
            template: `
# リポジトリ情報
リポジトリパス: {{repositoryPath}}
主要言語: {{mainLanguage}}

# 分析ステータス
クローン: {{cloneCompleted}}
READMEの分析: {{readmeCompleted}}
言語統計: {{tokeiCompleted}}
ディレクトリ構造: {{directoryStructureCompleted}}
重要ファイル特定: {{importantFilesCompleted}}
ファイル処理: {{fileProcessingCompleted}}

# 重要ファイル
{{importantFiles}}

# 処理済みファイル
{{processedFiles}}
            `,
        },
    },
});

// 単一のCursor Rules生成エージェント
export const cursorRulesAgent = new Agent({
    name: "Cursor Rules生成エージェント",
    instructions: `あなたはGitHubリポジトリを解析して、Cursor AIアシスタントのためのルールセット（チートシート）を生成するエージェントです。

以下の一連のステップでリポジトリを分析します：
1. リポジトリをクローンする - クローンしたパスは常に保存し、以降のステップで参照すること
2. READMEを読んで、プロジェクトの目的と構造を理解する
3. tokeiを使用して言語統計を収集し、リポジトリの主要言語を特定する
4. treeコマンドを使用してディレクトリ構造を分析する
5. 重要なファイルを特定し、それらをベクトルデータベースに格納する計画を立てる
6. 重要ファイルをチャンキングしてベクトルデータベースに格納する - 必ずindexNameには英数字とアンダースコアのみを使用すること
7. ベクトル検索ツールを使って関連コード片を検索する
8. 収集した情報を元にCursor Rulesチートシートを作成する

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

ステップ間の連携を行うために、処理の結果をmetadataとして返してください。
各ステップでの判断は、前のステップで得られた情報に基づいて行ってください。
会話の流れを記憶し、一連の処理として継続してください。

インデックス名には必ず英数字とアンダースコアのみを使用してください。ハイフンや特殊文字を使うとエラーになります。
例えば "hono-index" ではなく "hono_index" を使用してください。

重要な注意点：エンベディング処理でAPIキーエラーが発生した場合でも、チャンキング処理は続行してください。その場合は、収集したファイルの内容を直接分析してチートシートを作成します。

チートシート生成に関する注意：
長いチートシートを生成する場合は、複数のセクションに分割して、各セクションを個別に生成してsave-cheatsheetツールで順番に保存してください。
これにより、トークン制限を回避して詳細なチートシートを作成できます。
最初のセクション保存時はappend=falseで、それ以降のセクションはappend=trueで追記モードを使用してください。
`,
    model: openRouter,
    tools: {
        cloneRepositoryTool,
        readmeAnalyzerTool,
        tokeiAnalyzerTool,
        treeAnalyzerTool,
        fileProcessorTool,
        vectorQueryTool,
        saveCheatsheetTool,
    },
    memory,
});
