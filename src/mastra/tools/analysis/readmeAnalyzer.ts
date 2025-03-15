import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { MDocument } from "@mastra/rag";

/**
 * README解析ツール
 * リポジトリのREADMEファイルを読み取り、構造化データを抽出します
 */
export const readmeAnalyzerTool = createTool({
    id: "readme-analyzer",
    description:
        "リポジトリのREADMEファイルを解析して重要な情報を構造化データとして抽出します",
    inputSchema: z.object({
        repositoryPath: z.string().describe("リポジトリのパス"),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        content: z.string().optional(),
        metadata: z
            .object({
                title: z.string().optional(),
                description: z.string().optional(),
                technologies: z.array(z.string()).optional(),
                architecture: z.string().optional(),
                installation: z.string().optional(),
                usage: z.string().optional(),
                contributing: z.string().optional(),
                license: z.string().optional(),
            })
            .optional(),
    }),
    execute: async ({ context }) => {
        const { repositoryPath } = context;

        try {
            // READMEファイルの候補リスト
            const readmeVariants = [
                "README.md",
                "Readme.md",
                "readme.md",
                "README",
                "README.markdown",
                "README.txt",
            ];

            // READMEファイルを探索
            let readmeContent = "";
            let readmePath = "";

            for (const variant of readmeVariants) {
                const filePath = path.join(repositoryPath, variant);
                try {
                    const stat = await fs.stat(filePath);
                    if (stat.isFile()) {
                        readmeContent = await fs.readFile(filePath, "utf-8");
                        readmePath = filePath;
                        break;
                    }
                } catch (error) {
                    // ファイルが存在しない場合は次のバリアントを試す
                    continue;
                }
            }

            if (!readmeContent) {
                return {
                    success: false,
                    message: "READMEファイルが見つかりませんでした。",
                };
            }

            // マークダウンとして解析
            const doc = MDocument.fromMarkdown(readmeContent);

            // チャンキング
            const chunks = await doc.chunk({
                strategy: "markdown",
                size: 1000,
                overlap: 100,
            });

            // メタデータ抽出処理（ここでは単純なパターンマッチング）
            // 実際のプロダクションでは、LLMを使ったより高度な抽出をするべき
            const metadata = extractMetadata(readmeContent, chunks);

            return {
                success: true,
                message: `READMEファイル ${readmePath} の解析が完了しました。`,
                content: readmeContent,
                metadata,
            };
        } catch (error: any) {
            return {
                success: false,
                message: `READMEの解析に失敗しました: ${error.message}`,
            };
        }
    },
});

/**
 * READMEファイルからメタデータを抽出する関数
 */
function extractMetadata(
    content: string,
    chunks: any[]
): {
    title: string;
    description: string;
    technologies: string[];
    architecture: string;
    installation: string;
    usage: string;
    contributing: string;
    license: string;
} {
    // タイトルの抽出（最初の見出し）
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // 説明の抽出（タイトルの後の最初の段落）
    let description = "";
    const descriptionMatch = content.match(
        /^#\s+.+\n+([^#\n].+(?:\n[^#\n].+)*)/m
    );
    if (descriptionMatch) {
        description = descriptionMatch[1].trim();
    }

    // 技術スタックの検出
    const technologies: string[] = [];
    const techPatterns = [
        /(?:tech(?:nolog(?:y|ies))?|stack|dependencies|built\s+with|powered\s+by|using)[^\n]*?:\s*([^\n]+)/i,
        /##\s*(?:tech(?:nolog(?:y|ies))?|stack|dependencies|built\s+with|powered\s+by)[^\n]*\n+([^#]+)/i,
    ];

    for (const pattern of techPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
            const techSection = match[1].trim();
            const extracted = techSection
                .split(/[,\n]/)
                .map((t) => t.trim().replace(/[*-]/g, "").trim())
                .filter(
                    (t) =>
                        t.length > 0 && !t.startsWith("(") && !t.startsWith("[")
                );
            technologies.push(...extracted);
        }
    }

    // インストール方法
    let installation = "";
    const installMatch = content.match(
        /##\s*(?:インストール|installation|getting\s+started|setup)[^\n]*\n+([^#]+)/i
    );
    if (installMatch && installMatch[1]) {
        installation = installMatch[1].trim();
    }

    // 使用方法
    let usage = "";
    const usageMatch = content.match(
        /##\s*(?:使用方法|usage|how\s+to\s+use)[^\n]*\n+([^#]+)/i
    );
    if (usageMatch && usageMatch[1]) {
        usage = usageMatch[1].trim();
    }

    // アーキテクチャ
    let architecture = "";
    const archMatch = content.match(
        /##\s*(?:アーキテクチャ|architecture|structure|design)[^\n]*\n+([^#]+)/i
    );
    if (archMatch && archMatch[1]) {
        architecture = archMatch[1].trim();
    }

    // コントリビューション
    let contributing = "";
    const contribMatch = content.match(
        /##\s*(?:コントリビュート|貢献|contributing|contribute)[^\n]*\n+([^#]+)/i
    );
    if (contribMatch && contribMatch[1]) {
        contributing = contribMatch[1].trim();
    }

    // ライセンス
    let license = "";
    const licenseMatch = content.match(
        /##\s*(?:ライセンス|license)[^\n]*\n+([^#]+)/i
    );
    if (licenseMatch && licenseMatch[1]) {
        license = licenseMatch[1].trim();
    } else {
        // ライセンスがセクションとして見つからない場合、単純な言及を探す
        const simpleLicenseMatch = content.match(
            /(?:ライセンス|license)[:：]\s*([A-Za-z0-9\s-]+)/i
        );
        if (simpleLicenseMatch && simpleLicenseMatch[1]) {
            license = simpleLicenseMatch[1].trim();
        }
    }

    return {
        title,
        description,
        technologies,
        architecture,
        installation,
        usage,
        contributing,
        license,
    };
}
