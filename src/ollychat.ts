import {
  END,
  START,
  StateGraph,
  MemorySaver,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { Runnable } from "@langchain/core/runnables";

import { prometheusQueryTool } from "./integrations/prometheus.js";
import { loadPromptFromFile } from "./utils/promptLoader.js";
import { DynamicTool } from "@langchain/core/tools";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { config } from "./config/config.js";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { parser } from "@prometheus-io/lezer-promql";

import {
  metricsExampleSelector,
  labelsExampleSelector,
  valuesExampleSelector,
  exampleSelector,
} from "./integrations/vectorStore.js";

export const model = new ChatOpenAI({
  openAIApiKey: config.openAIApiKey,
  model: config.openAIModel,
  temperature: 0.7,
});

const searchTool = new TavilySearchResults({
  maxResults: 1,
});

const queryOutput = z.object({
  query: z
    .string()
    .min(1, "PromQL query cannot be empty.")
    .refine((query) => {
      try {
        const tree = parser.parse(query);
        return tree?.length > 0; // Ensure there's a valid parse tree
      } catch {
        return false;
      }
    }, "Invalid PromQL syntax.")
    .describe("Syntactically valid PromQL (Prometheus) query."),
});

export const queryModel = model.withStructuredOutput(queryOutput);

const agentCheckpointer = new MemorySaver();

interface ExampleItem {
  metadata?: Record<string, string | undefined>;
}

export async function getExamples(
  input: string,
  selector: Runnable<string, ExampleItem[]>,
  key: string,
): Promise<Array<Record<string, string | undefined>>> {
  const examples = await selector.invoke(input, config);
  return examples.map((ex) => ({
    [key]: ex.metadata?.[key],
  }));
}

const promQLTool = new DynamicTool({
  name: "PromQL",
  description:
    "A tool for querying Prometheus. This is helpful whenever a user is asking for information about their infrastructure or services.",
  func: async (_input: string) => {
    const queryPromptTemplate = loadPromptFromFile("query");
    const metrics = getExamples(_input, metricsExampleSelector, "metric");
    const labels = getExamples(_input, labelsExampleSelector, "label");
    const queries = getExamples(_input, exampleSelector, "query");
    const values = getExamples(_input, valuesExampleSelector, "value");

    const promptValue = await queryPromptTemplate.invoke({
      input: _input,
      metrics,
      queries,
      values,
      labels,
    });

    const result = await queryModel.invoke(promptValue, config);
    return prometheusQueryTool.invoke({ query: result.query });
  },
});

const LLMTool = new DynamicTool({
  name: "LLM",
  description: "A tool for querying the language model.",
  func: async (_input: string) => {
    const result = await model.invoke(_input, config);
    return result.content;
  },
});

const tools = [LLMTool, promQLTool, searchTool];

const agent = await createReactAgent({
  llm: model,
  tools,
  checkpointSaver: agentCheckpointer,
});

const getPlan = async (state: typeof MessagesAnnotation.State) => {
  return agent.invoke({ messages: state.messages }, config);
};

const shouldContinue = (state: typeof MessagesAnnotation.State) => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  if (
    "tool_calls" in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls?.length
  ) {
    return "tools";
  }
  return END;
};

const toolNodeForGraph = new ToolNode(tools);

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("agent", getPlan)
  .addNode("tools", toolNodeForGraph)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END])
  .addEdge("tools", "agent");

const app = workflow.compile({
  checkpointer: agentCheckpointer,
});

export const answerQuestion = async (inputs: { question: string }) => {
  const input = [
    {
      role: "user",
      content: inputs.question,
    },
  ];
  return await app.invoke({ messages: input }, config);
};
