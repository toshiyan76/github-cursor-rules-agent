import { Agent } from "@mastra/core/agent";
import path from "path";
import { saveCheatsheetOutputSchema } from "../tools/cheatsheet/saveCheatsheet";
import { z } from "zod";

/**
 * チートシート生成のためのセクション定義
 */
export interface CheatsheetSection {
    id: string;
    title: string;
    prompt: string;
}

/**
 * チートシート生成オプション
 */
export interface GenerateCheatsheetOptions {
    repositoryPath: string;
    outputPath?: string;
    processedFiles: string[];
    temperature?: number;
    topP?: number;
    topK?: number;
}

/**
 * チートシート生成結果
 */
export interface CheatsheetResult {
    success: boolean;
    message: string;
    outputPath: string;
    sections: {
        id: string;
        title: string;
        success: boolean;
        contentLength?: number;
    }[];
}

/**
 * 標準セクションを生成
 */
export function getStandardSections(
    options: GenerateCheatsheetOptions
): CheatsheetSection[] {
    const { repositoryPath, processedFiles } = options;
    const repoName = path.basename(repositoryPath);

    return [
        {
            id: "project-overview",
            title: "プロジェクト概要",
            prompt: `リポジトリ ${repositoryPath} のプロジェクト概要を詳しく説明してください。
                - プロジェクトの目的と主な機能
                - 対象ユーザーと使用シナリオ
                - 技術スタックの全体像
                - 主要な依存関係
                
                この情報は、Cursor Rulesチートシートの「プロジェクト概要」セクションとして使用されます。
                処理済みファイル: ${JSON.stringify(processedFiles)}`,
        },
        {
            id: "project-structure",
            title: "プロジェクトの全体構造と設計パターン",
            prompt: `リポジトリ ${repositoryPath} のプロジェクト構造と設計パターンについて詳しく説明してください。
                - プロジェクトの主要コンポーネントとその関係
                - 採用している設計パターンとアーキテクチャ
                - ディレクトリ構造の意図と目的
                - 依存関係の管理方法と外部ライブラリの利用状況
                
                この情報は、Cursor Rulesチートシートの「プロジェクトの全体構造と設計パターン」セクションとして使用されます。
                処理済みファイル: ${JSON.stringify(processedFiles)}`,
        },
        {
            id: "important-elements",
            title: "重要なクラス・関数と依存関係",
            prompt: `リポジトリ ${repositoryPath} の重要なクラス、関数、およびそれらの依存関係について詳しく説明してください。
                - 中核となる重要なクラスと役割
                - 主要な関数とその目的
                - それらの間の依存関係と呼び出しフロー
                - 特に注目すべき実装パターン
                
                この情報は、Cursor Rulesチートシートの「重要なクラス・関数と依存関係」セクションとして使用されます。
                処理済みファイル: ${JSON.stringify(processedFiles)}`,
        },
        {
            id: "coding-conventions",
            title: "コーディング規約と命名パターン",
            prompt: `リポジトリ ${repositoryPath} で採用されているコーディング規約と命名パターンについて詳しく説明してください。
                - 変数、関数、クラスの命名規則
                - コード構造とフォーマットの規則
                - エラー処理の方針
                - コメントとドキュメントのスタイル
                
                この情報は、Cursor Rulesチートシートの「コーディング規約と命名パターン」セクションとして使用されます。
                処理済みファイル: ${JSON.stringify(processedFiles)}`,
        },
        {
            id: "design-patterns",
            title: "ユニークなデザインパターンと実装の特徴",
            prompt: `リポジトリ ${repositoryPath} におけるユニークなデザインパターンと実装の特徴について詳しく説明してください。
                - 通常とは異なる独自の実装アプローチ
                - このプロジェクト固有の最適化手法
                - パフォーマンスに関する考慮事項
                - 再利用可能なパターンと拡張性の確保方法
                
                この情報は、Cursor Rulesチートシートの「ユニークなデザインパターンと実装の特徴」セクションとして使用されます。
                処理済みファイル: ${JSON.stringify(processedFiles)}`,
        },
        {
            id: "best-practices",
            title: "開発ベストプラクティス",
            prompt: `リポジトリ ${repositoryPath} に基づいた開発ベストプラクティスをまとめてください。
                - プロジェクト固有の開発ガイドライン
                - バグを避けるためのパターン
                - よくある落とし穴と解決策
                - 効率的な開発のためのヒント
                
                この情報は、Cursor Rulesチートシートの「開発ベストプラクティス」セクションとして使用されます。
                処理済みファイル: ${JSON.stringify(processedFiles)}`,
        },
        {
            id: "summary",
            title: "まとめと重要なポイント",
            prompt: `リポジトリ ${repositoryPath} の分析に基づき、このプロジェクトを効率的に理解し開発するための簡潔なまとめと重要なポイントを3〜5つ挙げてください。
                処理済みファイル: ${JSON.stringify(processedFiles)}`,
        },
    ];
}

/**
 * セクション分割式のチートシート生成
 * エージェントを使って複数のセクションに分けてチートシートを生成し、
 * 各セクションを順次ファイルに保存します。
 */
export async function generateSectionedCheatsheet(
    agent: Agent,
    options: GenerateCheatsheetOptions
): Promise<CheatsheetResult> {
    const { repositoryPath, processedFiles } = options;
    const repoName = path.basename(repositoryPath);

    // 出力パスの決定
    const outputPath = options.outputPath || `./.cursor/rules/${repoName}.mdc`;

    // セクション定義
    const sections = getStandardSections(options);

    console.log(`チートシート生成開始: ${outputPath}`);
    console.log(`セクション数: ${sections.length}`);

    // 生成結果を追跡
    const results: CheatsheetResult = {
        success: true,
        message: `${sections.length}セクションのチートシートを生成しました`,
        outputPath,
        sections: [],
    };

    // 保存結果の型定義
    type SaveResult = z.infer<typeof saveCheatsheetOutputSchema>;

    // 各セクションを生成して保存
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        console.log(
            `セクション ${i + 1}/${sections.length} 「${section.title}」の生成を開始...`
        );

        try {
            // セクションごとの生成（温度などのパラメーターを指定可能）
            const sectionResponse = await agent.generate(section.prompt, {
                temperature: options.temperature || 0.7,
                topP: options.topP || 0.95,
                topK: options.topK || 40,
            });

            // ファイルへの保存
            const saveResponse = await agent.generate(
                `
生成されたセクション「${section.title}」をファイルに保存してください。
`,
                {
                    toolChoice: {
                        type: "tool",
                        toolName: "save-cheatsheet",
                    },
                    output: saveCheatsheetOutputSchema,
                }
            );

            // レスポンスをSaveResult型にキャスト
            const saveResult = saveResponse.object as SaveResult;

            // 結果を追跡
            results.sections.push({
                id: section.id,
                title: section.title,
                success: true,
                contentLength: saveResult.bytesWritten,
            });

            console.log(
                `セクション「${section.title}」の生成が完了 (${saveResult.bytesWritten || 0}バイト)`
            );
        } catch (error: any) {
            console.error(
                `セクション「${section.title}」の生成中にエラーが発生: ${error.message}`
            );

            // エラーを記録してスキップ
            results.sections.push({
                id: section.id,
                title: section.title,
                success: false,
            });

            // 全体の結果にも反映
            results.success = false;
            results.message = `一部のセクションの生成に失敗しました: ${error.message}`;
        }
    }

    console.log(`チートシート生成完了: ${outputPath}`);
    console.log(
        `成功: ${results.sections.filter((s) => s.success).length}/${sections.length}セクション`
    );

    return results;
}
