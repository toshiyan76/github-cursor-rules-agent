import { Mastra } from "@mastra/core/mastra";
import { createLogger } from "@mastra/core/logger";
import { cursorRulesWorkflow } from "./workflows";
import { cursorRulesAgent } from "./agents";

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

(async () => {
    const { runId, start } = mastra
        .getWorkflow("cursorRulesWorkflow")
        .createRun();

    console.log("Run", runId);

    const runResult = await start({
        triggerData: {
            repositoryUrl: "https://github.com/honojs/hono",
            branch: "main",
            outputPath: "./examples/rules",
        },
    });

    console.log("Final output:", runResult.results);
})();
