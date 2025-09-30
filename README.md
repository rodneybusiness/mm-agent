# 🤖 MM-Agent

An intelligent multi-agent orchestration system powered by Claude Sonnet 4, featuring specialized agents for file management, web research, code analysis, task planning, and data processing.

## ✨ Features

### 🎯 **Intelligent Agent Orchestration**
- **Smart Agent Selection**: Claude automatically determines which agents to use based on your request
- **Execution Strategies**: Sequential, parallel, or conditional agent execution
- **Task Dependency Management**: Complex workflows with intelligent step coordination

### 🤖 **Five Specialized Agents**

| Agent | Capabilities |
|-------|-------------|
| **📁 File Management** | Read/write files, analyze directory structures, file metadata extraction |
| **🌐 Web Research** | Web scraping, API calls, search functionality, link extraction |  
| **🔍 Code Analysis** | Code quality analysis, security scanning, documentation generation |
| **📋 Task Planning** | Complex task breakdown, execution planning, dependency management |
| **📊 Data Processing** | CSV/JSON/PDF processing, data transformation, statistical analysis |

### 🏗️ **Production-Ready Architecture**
- **Type-Safe**: Complete TypeScript implementation with Zod validation
- **Error Handling**: Comprehensive error recovery and user feedback
- **Logging**: Color-coded console output with performance tracking
- **Health Monitoring**: Real-time agent status and connectivity checks
- **Rate Limiting**: Built-in protection for web requests

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Anthropic API key

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/rodneybusiness/mm-agent.git
cd mm-agent
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
```bash
cp .env.example .env
# Edit .env and add your Anthropic API key
ANTHROPIC_API_KEY=your-actual-api-key-here
```

4. **Run the system:**
```bash
# Demo mode with example requests
npx tsx index.ts

# Interactive mode
npx tsx index.ts --interactive
```

## 📖 Usage Examples

### Basic Commands
```bash
# File operations
"Analyze the current directory structure"
"Read and summarize the package.json file"

# Web research  
"Search for TypeScript best practices"
"Scrape the latest news from example.com"

# Code analysis
"Analyze code quality in the src directory"
"Generate documentation for my TypeScript project"

# Data processing
"Process data.csv and generate summary statistics"
"Convert users.json to CSV format"

# Task planning
"Create a plan to refactor the authentication system"
"Plan a task to organize project documentation"
```

### Interactive Mode
```bash
npx tsx index.ts -i
> Analyze my project's dependencies and suggest improvements
> Create a CSV file with sample user data
> Search for React performance optimization techniques
> exit
```

## 🏗️ Architecture

### Core Components

```
src/
├── agents/           # Specialized agent implementations
│   ├── fileAgent.ts     # File operations
│   ├── webAgent.ts      # Web research  
│   ├── codeAgent.ts     # Code analysis
│   ├── taskAgent.ts     # Task planning
│   └── dataAgent.ts     # Data processing
├── core/            # Core orchestration system
│   ├── orchestrator.ts  # Main orchestration logic
│   └── logger.ts        # Logging and monitoring
├── types/           # TypeScript definitions
│   └── index.ts         # Schemas and interfaces
└── index.ts         # Main entry point and exports
```

### Agent Communication Flow

1. **Request Analysis**: Claude analyzes user input to determine required agents
2. **Execution Planning**: Strategy selection (sequential/parallel/conditional)
3. **Agent Execution**: Coordinated execution with dependency management
4. **Response Generation**: Claude synthesizes agent results into user-friendly response

## 🛠️ Development

### Adding New Agents

1. **Create agent class** implementing the `Agent` interface
2. **Define tools** with Zod schemas for validation
3. **Register agent** in the orchestrator
4. **Add type definitions** for new schemas

Example agent structure:
```typescript
export class CustomAgent implements Agent {
  name = 'Custom Agent';
  description = 'Agent description';
  tools: Tool[] = [/* tool definitions */];
  
  async execute(input: string): Promise<AgentResponse> {
    // Implementation
  }
}
```

### Configuration

The orchestrator supports various configuration options:

```typescript
const orchestrator = new AgentOrchestrator({
  anthropicApiKey: 'your-key',
  model: 'claude-sonnet-4-20250514',  // Claude model
  maxTokens: 1500,                    // Response length
  temperature: 0.7,                   // Creativity level
  enableLogging: true                 // Debug logging
});
```

## 🔧 API Reference

### Main Classes

- **`AgentOrchestrator`**: Central coordination system
- **`Logger`**: Logging and performance tracking
- **Individual Agents**: Specialized functionality modules

### Key Methods

```typescript
// Process natural language requests
await orchestrator.processRequest("your request here");

// Execute specific agent
await orchestrator.executeSpecificAgent("file", "analyze directory");

// Health monitoring
const status = await orchestrator.health();

// Get available agents
const agents = orchestrator.getAvailableAgents();
```

## 📊 Monitoring & Debugging

### Health Check
```bash
# The system includes built-in health monitoring
Status: healthy
Claude Connection: connected  
Agents Online: 5/5
```

### Logging Levels
- **DEBUG**: Detailed execution flow
- **INFO**: General operations  
- **WARN**: Non-critical issues
- **ERROR**: Failures and exceptions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes with tests
4. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Repository**: [github.com/rodneybusiness/mm-agent](https://github.com/rodneybusiness/mm-agent)
- **Issues**: [Report bugs and request features](https://github.com/rodneybusiness/mm-agent/issues)
- **Anthropic Claude**: [Official Documentation](https://docs.anthropic.com/)

## 💡 Roadmap

- [ ] Additional agent types (Email, Database, API)
- [ ] Web-based dashboard interface  
- [ ] Plugin system for custom agents
- [ ] Advanced workflow templates
- [ ] Multi-language support