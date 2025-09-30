import dotenv from "dotenv";
import { AgentOrchestrator } from "./src/core/orchestrator";

dotenv.config();

async function main() {
  try {
    console.log("🚀 Initializing MM-Agent Orchestrator...\n");

    // Initialize the orchestrator
    const orchestrator = new AgentOrchestrator({
      anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
      model: "claude-sonnet-4-20250514",
      maxTokens: 1500,
      temperature: 0.7,
      enableLogging: true
    });

    // Display available agents
    const agents = orchestrator.getAvailableAgents();
    console.log("📋 Available Agents:");
    agents.forEach(agent => {
      console.log(`  • ${agent.name}: ${agent.description}`);
    });
    console.log();

    // Test health check
    console.log("🏥 Running health check...");
    const health = await orchestrator.health();
    console.log(`Status: ${health.status}`);
    console.log(`Claude Connection: ${health.claudeConnection}`);
    console.log(`Agents Online: ${Object.values(health.agents).filter(s => s === 'online').length}/${Object.keys(health.agents).length}`);
    console.log();

    // Demo requests
    const demoRequests = [
      "Analyze the current directory structure",
      "Create a simple test CSV file with sample data",
      "Search the web for information about TypeScript best practices",
      "Plan a task to organize project documentation"
    ];

    console.log("🎯 Running Demo Requests:\n");
    
    for (const request of demoRequests) {
      console.log(`\n📝 Request: "${request}"`);
      console.log("─".repeat(50));
      
      const result = await orchestrator.processRequest(request);
      
      console.log(`✅ Response: ${result.response}`);
      console.log(`⏱️  Execution Time: ${result.executionTime}ms`);
      console.log(`🤖 Agents Used: ${result.agentResponses.length}`);
      
      if (result.agentResponses.length > 0) {
        result.agentResponses.forEach((response, index) => {
          console.log(`   Agent ${index + 1}: ${response.success ? '✅ Success' : '❌ Failed'} - Tools: ${response.toolsUsed.join(', ')}`);
        });
      }
      
      console.log();
    }

    console.log("\n🎉 MM-Agent demonstration completed successfully!");
    console.log("\n💡 Usage Examples:");
    console.log("  • 'Analyze code quality in ./src directory'");
    console.log("  • 'Process data.csv and generate summary statistics'");
    console.log("  • 'Search for Python best practices and save to file'");
    console.log("  • 'Create a plan to refactor the authentication system'");
    console.log("  • 'Convert users.json to CSV format'");

  } catch (error) {
    console.error("\n❌ Error running MM-Agent:", error);
  }
}

// Interactive mode (if running directly)
async function interactiveMode() {
  const orchestrator = new AgentOrchestrator({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    model: "claude-sonnet-4-20250514"
  });

  console.log("\n🤖 MM-Agent Interactive Mode");
  console.log("Type your requests below (or 'exit' to quit):\n");

  // Simple readline implementation (in a real app, you'd use a proper readline library)
  process.stdin.setEncoding('utf8');
  process.stdout.write('> ');

  for await (const chunk of process.stdin) {
    const input = chunk.toString().trim();
    
    if (input === 'exit' || input === 'quit') {
      console.log("👋 Goodbye!");
      process.exit(0);
    }
    
    if (input.length === 0) {
      process.stdout.write('> ');
      continue;
    }

    try {
      const result = await orchestrator.processRequest(input);
      console.log(`\n${result.response}\n`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }
    
    process.stdout.write('> ');
  }
}

// Check if running in interactive mode
const args = process.argv.slice(2);
if (args.includes('--interactive') || args.includes('-i')) {
  interactiveMode();
} else {
  main();
}