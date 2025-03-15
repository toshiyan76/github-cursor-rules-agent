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
