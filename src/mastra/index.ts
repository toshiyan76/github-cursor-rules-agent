import { Mastra } from "@mastra/core/mastra";
import { createLogger } from "@mastra/core/logger";
import { cursorRulesWorkflow } from "./workflows";
import { cursorRulesAgent } from "./agents";

import "dotenv/config";

export const mastra = new Mastra({
    agents: {
        cursorRulesAgent,
    },
    workflows: {
        cursorRulesWorkflow,
    },
    logger: createLogger({
        name: "GitHub Cursor Rules Agent",
        level: "info",
    }),
});

// ワークフローを実行する関数
export const executeCursorRulesWorkflow = async (params: {
    repositoryUrl: string;

    branch?: string;
    outputPath?: string;
}) => {
    const { runId, start } = mastra
        .getWorkflow("cursorRulesWorkflow")
        .createRun();

    console.log("ワークフロー実行ID:", runId);

    const runResult = await start({
        triggerData: {
            repositoryUrl: params.repositoryUrl,
            branch: params.branch,
            outputPath: params.outputPath,
        },
    });

    console.log("実行結果:", runResult.results);
    return runResult.results;
};

(async () => {
    await executeCursorRulesWorkflow({
        repositoryUrl: "https://github.com/honojs/hono",
        branch: "main",
        outputPath: "./cursor-rules.mdc",
    });
})();
