declare module '../../../dist/stream-agent.js' {
  export function runStreamAgent(opts: {
    history: any[];
    input: string;
    onSSE: (event: string, data: string) => void;
  }): Promise<void>;
}
