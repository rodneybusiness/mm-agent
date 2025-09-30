import dotenv from "dotenv";
import { AgentOrchestrator } from "./src/core/orchestrator";

dotenv.config();

async function testAnalytics() {
  console.log("🧪 Testing Analytics System\n");

  const orchestrator = new AgentOrchestrator({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    model: "claude-sonnet-4-20250514",
    maxTokens: 2000,
    enableLogging: true,
    enableAnalytics: true
  });

  const analytics = orchestrator.getAnalytics();
  if (!analytics) {
    console.error("❌ Analytics not enabled!");
    return;
  }

  // Test 1: Execute agent with tools (this should record analytics)
  console.log("=== Test 1: Execute Agent with Tools ===\n");
  
  const result = await orchestrator.executeAgentWithTools(
    'file',
    'List TypeScript files in src/ and show package.json',
    'test-session-1'
  );

  console.log(`✅ Agent execution complete`);
  console.log(`📊 Tools used: ${result.toolsUsed.join(', ')}\n`);

  // Wait a moment for async analytics to complete
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Query analytics
  console.log("=== Test 2: Query Analytics ===\n");

  const toolMetrics = await analytics.getToolMetrics();
  console.log("📈 Tool Metrics:");
  console.log(`  Total Executions: ${toolMetrics.totalExecutions}`);
  console.log(`  Success Rate: ${toolMetrics.successRate.toFixed(2)}%`);
  console.log(`  Average Duration: ${toolMetrics.averageDuration.toFixed(0)}ms`);
  console.log(`  Error Count: ${toolMetrics.errorCount}`);
  
  console.log("\n🔧 Most Used Tools:");
  toolMetrics.mostUsedTools.forEach((tool, i) => {
    console.log(`  ${i + 1}. ${tool.name} (${tool.count} calls, ${tool.avgDuration.toFixed(0)}ms avg)`);
  });

  // Test 3: Agent-specific metrics
  console.log("\n=== Test 3: Agent Metrics ===\n");
  
  const agentMetrics = await analytics.getAgentMetrics('file');
  console.log("📊 File Agent Metrics:");
  console.log(`  Total Sessions: ${agentMetrics.totalSessions}`);
  console.log(`  Total Executions: ${agentMetrics.totalExecutions}`);
  console.log(`  Avg Tools/Session: ${agentMetrics.averageToolsPerSession.toFixed(2)}`);
  console.log(`  Success Rate: ${agentMetrics.successRate.toFixed(2)}%`);
  console.log(`  Avg Duration: ${agentMetrics.averageDuration.toFixed(0)}ms`);

  // Test 4: Top tools
  console.log("\n=== Test 4: Top Tools ===\n");
  
  const topTools = await analytics.getTopTools(5);
  topTools.forEach((tool, i) => {
    console.log(`  ${i + 1}. ${tool.name}: ${tool.count} calls, ${tool.successRate.toFixed(0)}% success`);
  });

  // Test 5: Recent executions
  console.log("\n=== Test 5: Recent Executions ===\n");
  
  const recentExecutions = await analytics.getRecentExecutions(10);
  console.log(`📋 Last ${recentExecutions.length} tool executions:`);
  recentExecutions.forEach((exec: any) => {
    const status = exec.status === 'success' ? '✅' : '❌';
    console.log(`  ${status} ${exec.tool_name} (${exec.agent_key}) - ${exec.duration_ms}ms`);
  });

  console.log("\n🎉 Analytics test complete!");
}

testAnalytics().catch(console.error);
