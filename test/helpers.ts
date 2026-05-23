export interface RegisteredTool {
  name: string;
  parameters: unknown;
  execute: (...args: any[]) => Promise<any>;
}

export function registerTools(extension: (api: { registerTool(tool: RegisteredTool): void }) => void) {
  const tools: RegisteredTool[] = [];

  extension({
    registerTool(tool) {
      tools.push(tool);
    },
  });

  return tools;
}

export function findTool(tools: RegisteredTool[], name: string) {
  const tool = tools.find((candidate) => candidate.name === name);

  if (!tool) {
    throw new Error(`Expected ${name} to be registered.`);
  }

  return tool;
}
