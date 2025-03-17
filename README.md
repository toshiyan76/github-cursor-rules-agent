# GitHub Cursor Rules Agent

![Mastraで作るAIエージェント入門](assets/cover.png)

「Mastraで作るAIエージェント入門 〜GitHub解析で学ぶ自動化の第一歩〜」の公式サンプルコードリポジトリです。このプロジェクトでは、GitHubリポジトリのコードを解析し、Cursor AIエディタ用のルールを自動生成するAIエージェントを実装しています。

## 概要

このエージェントは、指定したGitHubリポジトリのコードを解析し、Cursor AIエディタの利用を効率化するためのカスタムルールを自動生成します。これにより、特定のプロジェクトや技術スタックに特化したAIアシスタントの振る舞いをカスタマイズすることができます。

Mastraフレームワークを使用してAIエージェントを構築する方法を学べる実践的な例として、以下の機能を提供しています：

- GitHubリポジトリのコード解析
- リポジトリ内のプログラミング言語やフレームワークの検出
- Cursor AIエディタ用のカスタムルールの自動生成
- 複数のAIモデル（Google Gemini、Anthropic Claude、OpenAI）の切り替え

## Mastraの特徴

Mastraは、TypeScriptネイティブのAIエージェントフレームワークで、開発者がLLMベースのエージェントとワークフローを簡単に構築できるように設計されています。以下はMastraの主な特徴です。

### 使いやすい開発用UI

Mastraには直感的な開発用UIが付属しており、エージェントとワークフローのテスト・監視が容易です。

![開発用UI](assets/1.png)

### 強力なツール管理

豊富なビルトインツールと、カスタムツールの簡単な作成・管理が可能です。ツールリストページでは、利用可能なすべてのツールを確認できます。

![ツールリスト](assets/2.png)

### 対話型ツール実行

各ツールは詳細な入力フォームを備えており、パラメータを指定して直接実行できます。これにより開発やデバッグが効率化されます。

![ツール実行フォーム](assets/3.png)

### 柔軟なワークフロー設計

複雑なタスクを小さなステップに分解し、それらを組み合わせて強力なワークフローを構築できます。ワークフローは視覚的に確認でき、実行状況も追跡可能です。

![ワークフロー](assets/4.png)

### 詳細なエージェントトレース

エージェントの実行履歴、メモリの使用状況、ツールの呼び出しなど、詳細なトレース情報を確認できます。これにより、エージェントの動作を理解し、デバッグが容易になります。

![エージェントトレース](assets/5.png)

## 始め方

### 前提条件

- Node.js 18以上
- pnpm 8.0.0以上
- 各種AIサービスのAPIキー（Google AI、Anthropic、またはOpenRouter）

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/noplan-inc/github-cursor-rules-agent.git
cd github-cursor-rules-agent

# 依存パッケージのインストール
pnpm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してAPIキーを設定
```

### 設定

`.env`ファイルにAPIキーを設定してください：

```
# 無編集で動かす場合は、以下の2つのAPIキーが必要です
GOOGLE_API_KEY=your_google_api_key_here    # Google Gemini AIモデル用
OPENROUTER_API_KEY=your_openrouter_api_key_here  # OpenRouter経由のClaude用
```

#### モデルのカスタマイズ

デフォルトでは、Google GeminiとOpenRouter経由のClaude 3.7 Sonnet:thinkingを使用していますが、別のモデルを使いたい場合は `src/mastra/models/index.ts` ファイルを編集することで簡単に変更できます。

例えば：

- 異なるバージョンのClaudeモデルを使用したい
- OpenAI GPTモデルを使いたい
- Anthropic APIを直接使いたい

などの場合、`src/mastra/models/index.ts`を編集して必要なモデルを設定してください。モデルを変更した場合は、それに対応するAPIキーを`.env`ファイルに追加する必要があります：

```
# 追加のモデル用APIキー（必要に応じて）
ANTHROPIC_API_KEY=your_anthropic_api_key_here  # Anthropic APIを直接使用する場合
OPENAI_API_KEY=your_openai_api_key_here        # OpenAI APIを使用する場合
```

### 実行方法

```bash
# 開発モードで実行
pnpm dev

# ビルド
pnpm build
```

## 使用方法

開発用UIを使って簡単にエージェントを実行できます：

1. 以下のコマンドで開発サーバーを起動します：

    ```bash
    pnpm dev
    ```

2. ブラウザで自動的に開かれるMastra開発用UIにアクセスします（通常は http://localhost:4111/ ）

3. UI上で「エージェント」タブを選択し、「cursorRulesAgent」をクリックします

4. 以下のようなプロンプトをエージェントに送信します：

    ```
    GitHubリポジトリ https://github.com/example/repo のmainブランチを解析して、
    ./output/rules ディレクトリにCursor用ルールを生成してください
    ```

5. エージェントが処理を実行し、指定したパスにCursor用のルールファイルが生成されます

6. エージェントとの対話を通じて、生成されたルールの調整や追加情報の提供も可能です

## プロジェクト構造

```
github-cursor-rules-agent/
├── src/
│   └── mastra/
│       ├── agents/      # AIエージェント定義
│       ├── models/      # AIモデル設定
│       ├── tools/       # カスタムツール
│       ├── workflows/   # ワークフロー定義
│       └── index.ts     # エントリーポイント
├── .env                 # 環境変数
└── package.json         # プロジェクト設定
```

## 技術スタック

- [Mastra](https://mastra.ai/) - TypeScriptベースのAIエージェントフレームワーク
- [Google AI (Gemini)](https://ai.google.dev/) - AIモデル
- [Anthropic Claude](https://www.anthropic.com/) - AIモデル
- [OpenRouter](https://openrouter.ai/) - AIモデルルーティングサービス
- [TypeScript](https://www.typescriptlang.org/) - プログラミング言語

## 関連リソース

- [書籍「Mastraで作るAIエージェント入門 〜GitHub解析で学ぶ自動化の第一歩〜」](https://zenn.dev/serinuntius/books/4346a0fc6818f3)
- [Mastra公式ドキュメント](https://mastra.ai/)
- [Cursor AIエディタ](https://cursor.sh/)

## ライセンス

[MIT License](LICENSE)

## 貢献

バグ報告や機能リクエストは、GitHubのIssueでお気軽にお寄せください。プルリクエストも歓迎します。
