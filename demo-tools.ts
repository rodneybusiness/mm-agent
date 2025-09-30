import dotenv from "dotenv";
import { AgentOrchestrator } from "./src/core/orchestrator";

dotenv.config();

async function demoToolBasedAgents() {
  const orchestrator = new AgentOrchestrator({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    model: "claude-sonnet-4-20250514",
    maxTokens: 2000,
    enableLogging: true
  });

  console.log("🤖 MM-Agent Tool-Based Demo\n");
  console.log("This uses the NEW executeAgentWithTools() method where Claude");
  console.log("intelligently decides which tools to call and when.\n");

  const demos = [
    {
      title: "File Agent - Smart Directory Analysis",
      agent: "file",
      prompt: "List all TypeScript files in the src directory, tell me which is the largest, and show me what's in package.json"
    },
    {
      title: "Data Agent - Create Sample Data",
      agent: "data", 
      prompt: "Create a sample CSV with 5 users (name, email, role, status) and save it to users-sample.csv"
    },
    {
      title: "Code Agent - Project Analysis",
      agent: "code",
      prompt: "Analyze the src/core/orchestrator.ts file and tell me about its complexity and structure"
    }
  ];

  for (const demo of demos) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📋 ${demo.title}`);
    console.log(`${"=".repeat(60)}\n`);
    console.log(`Prompt: "${demo.prompt}"\n`);

    const result = await orchestrator.executeAgentWithTools(
      demo.agent,
      demo.prompt,
      `demo-session-${Date.now()}`
    );

    if (result.success) {
      console.log(`\n✅ SUCCESS\n`);
      console.log(`🔧 Tools Used: ${result.toolsUsed.join(", ")}\n`);
      console.log(`📝 Result:\n${result.result}\n`);
    } else {
      console.log(`\n❌ FAILED: ${result.error}\n`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("🎉 Demo Complete!");
  console.log(`${"=".repeat(60)}\n`);
}

demoToolBasedAgents().catch(console.error);
