# Changelog

All notable changes to the MM-Agent project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-09-30

### 🎉 Major Features: SDK Agent Control

#### Agentic Tool Orchestration
- **Full Anthropic SDK Integration**: Agents now use Anthropic's native tool use (function calling) API
- **Autonomous Tool Execution**: Claude autonomously decides which tools to use, when, and how many times
- **Tool Execution Loop**: Automatic handling of tool_use and tool_result message cycles
- **Multi-turn Tool Conversations**: Claude can call multiple tools in sequence to complete complex tasks

#### Conversation History & Context Management
- **Session-based History**: Conversation context maintained per session ID
- **Multi-turn Interactions**: Follow-up questions that reference previous context
- **History Management**: Configurable history limits with `trimConversationHistory()`
- **Context Preservation**: Full message history preserved across tool executions
- **Session Control**: `clearConversation(sessionId)` for managing conversation state

### 🔧 Technical Improvements

#### New Core Methods
- `executeAgentWithTools(agentKey, input, sessionId)`: Primary method for agentic tool control
- `getConversationContext(sessionId)`: Retrieve conversation history for a session
- `clearConversation(sessionId)`: Clear history for a specific session
- `trimConversationHistory(context)`: Automatic history management

#### Agent Interface Updates
All agents now implement:
- **`getAnthropicTools(): AnthropicTool[]`**: Export Anthropic-compatible tool schemas
- **Automatic Schema Conversion**: Zod schemas → JSON Schema via `zod-to-json-schema`
- **Proper Tool Formatting**: Ensures `type: 'object'` requirement for Anthropic API

#### Type System Enhancements
- Added `AnthropicTool` interface for tool definitions
- Added `ConversationMessage` type (alias for Anthropic's `MessageParam`)
- Added `ConversationContext` interface for session management
- Imported Anthropic SDK types: `MessageParam`, `TextBlock`, `ToolUseBlock`

### 📦 Dependencies

#### Added
- `zod-to-json-schema@^3.24.6`: Convert Zod schemas to JSON Schema format
- `typescript@^5.9.2` (dev): TypeScript compiler
- `@types/node@^24.6.0` (dev): Node.js type definitions

### 🎯 Behavioral Changes

**Before (v1.0.0): Keyword-based execution**
```typescript
// Agent parses string and guesses which tool to use
await orchestrator.executeSpecificAgent('file', 'analyze directory');
```

**After (v1.1.0): Autonomous tool orchestration**
```typescript
// Claude autonomously orchestrates multiple tools
await orchestrator.executeAgentWithTools(
  'file',
  'List TypeScript files, find the largest, and show me package.json'
);
// Claude automatically: list_files (2x), analyze_file (1x), read_file (1x)
// Then synthesizes comprehensive answer
```

### 📝 Examples & Documentation

#### New Demo Files
- **`demo-tools.ts`**: Comprehensive showcase of autonomous tool usage
  - File Agent: Multi-tool directory analysis
  - Data Agent: CSV generation with tool orchestration
  - Code Agent: File analysis with autonomous tool selection

#### Updated Files
- **`index.ts`**: Enhanced with better usage examples
- **`README.md`**: Complete overhaul with SDK agent control documentation
  - Added "Agentic Tool Control" section with examples
  - Added "Current Status" showing v1.1.0 features
  - Updated API reference with new methods
  - Added roadmap for future tool enhancements

### 🐛 Bug Fixes
- Fixed tool schema generation to include `type: 'object'` for Anthropic API compliance
- Fixed conversation context issues causing "unexpected tool_use_id" errors
- Resolved peer dependency conflicts with Zod v4.x using `--legacy-peer-deps`
- Fixed context isolation between tool execution sessions

### 📊 Performance & Testing
- Verified autonomous tool orchestration with 3 agents
- File Agent: Successfully executed 6 tools in single conversation
- Average tool execution: 2-3 seconds per tool call
- Multi-tool workflows: 30-45 seconds for complex analyses

### ⚠️ Breaking Changes
**None** - All v1.0.0 functionality remains intact. New features are purely additive.

### 🔜 Next Steps (v1.2.0 Roadmap)
- Streaming support for real-time tool execution feedback
- Tool result caching for improved performance
- Enhanced error recovery in tool execution loops
- Multi-agent coordination with shared tool context
- Tool execution analytics and optimization

---

## [1.0.0] - 2025-01-30

### Added
- **Complete Multi-Agent Architecture**: Five specialized agents working in concert
  - 📁 File Management Agent: File operations, directory analysis, metadata extraction
  - 🌐 Web Research Agent: Web scraping, API calls, search functionality
  - 🔍 Code Analysis Agent: Code quality, security scanning, documentation generation  
  - 📋 Task Planning Agent: Complex task breakdown with dependency management
  - 📊 Data Processing Agent: CSV/JSON/PDF processing with statistical analysis

- **Intelligent Orchestration System**
  - Smart agent selection based on natural language analysis
  - Sequential, parallel, and conditional execution strategies
  - Task dependency management and workflow coordination
  - Claude Sonnet 4 integration for request interpretation

- **Production-Ready Features**
  - Complete TypeScript implementation with Zod validation
  - Comprehensive error handling and recovery mechanisms
  - Color-coded logging system with performance tracking
  - Real-time health monitoring for all agents
  - Rate limiting protection for web requests
  - Interactive and demo execution modes

- **Developer Experience**
  - Type-safe agent interfaces and tool definitions
  - Extensible architecture for adding new agents
  - Comprehensive API documentation and examples
  - Configuration management with environment variables
  - Development tools and debugging utilities

### Technical Specifications
- **Framework**: Node.js 18+ with TypeScript
- **AI Integration**: Anthropic Claude Sonnet 4 (claude-sonnet-4-20250514)
- **Validation**: Zod schema validation for type safety
- **Dependencies**: Axios, Cheerio, fast-csv, pdf-parse, fs-extra, glob
- **Architecture**: Modular agent system with centralized orchestration

### Usage Examples
```bash
# Demo mode
npx tsx index.ts

# Interactive mode  
npx tsx index.ts --interactive

# Example requests
"Analyze the current directory structure"
"Search for TypeScript best practices"
"Process data.csv and generate statistics"
"Create a plan to refactor authentication"
```

### Initial Release
This represents the complete initial release of the MM-Agent system, transitioning from a simple echo bot to a sophisticated multi-agent orchestration platform capable of handling complex, multi-step tasks across different domains.

## [0.1.0] - 2025-01-30

### Added
- Initial project setup with Anthropic SDK
- Basic Claude conversation functionality
- Environment variable configuration
- Simple echo tool demonstration
- TypeScript support with Zod validation

### Infrastructure
- Git repository initialization
- npm package configuration
- README documentation
- Environment setup instructions