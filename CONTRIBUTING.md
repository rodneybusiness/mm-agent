# Contributing to MM-Agent

Thank you for your interest in contributing to MM-Agent! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn package manager
- Git for version control
- Anthropic API key for testing

### Development Setup

1. **Fork and clone the repository:**
```bash
git clone https://github.com/your-username/mm-agent.git
cd mm-agent
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment:**
```bash
cp .env.example .env
# Add your Anthropic API key to .env
```

4. **Run the development version:**
```bash
npx tsx index.ts
```

## 🏗️ Architecture Overview

MM-Agent follows a modular architecture with these key components:

### Core Components
- **`AgentOrchestrator`**: Central coordination system
- **`Logger`**: Logging and performance tracking
- **Individual Agents**: Specialized functionality modules

### Agent Structure
Each agent implements the `Agent` interface:
```typescript
export interface Agent {
  name: string;
  description: string;
  tools: Tool[];
  execute(input: string): Promise<AgentResponse>;
}
```

### Tool System
Tools define specific capabilities within agents:
```typescript
export interface Tool {
  name: string;
  description: string;
  schema: z.ZodSchema;
  execute: (params: any) => Promise<any>;
}
```

## 🔧 Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow existing naming conventions
- Use Zod schemas for input validation
- Include comprehensive error handling
- Add logging for debugging purposes

### Adding New Agents

1. **Create the agent file** in `src/agents/`:
```typescript
// src/agents/myAgent.ts
import { Agent, Tool, AgentResponse } from '../types';

export class MyAgent implements Agent {
  name = 'My Agent';
  description = 'Description of what this agent does';
  
  tools: Tool[] = [
    // Define your tools here
  ];
  
  async execute(input: string): Promise<AgentResponse> {
    // Implementation
  }
}
```

2. **Register the agent** in `src/core/orchestrator.ts`:
```typescript
import { MyAgent } from '../agents/myAgent';

// In the constructor:
this.agents.set('my', new MyAgent());
```

3. **Add type definitions** if needed in `src/types/index.ts`

4. **Export the agent** in `src/index.ts`

### Adding New Tools

1. **Define the schema** in `src/types/index.ts`:
```typescript
export const MyToolSchema = z.object({
  param1: z.string(),
  param2: z.number().optional()
});
```

2. **Implement the tool** in your agent:
```typescript
{
  name: 'my_tool',
  description: 'What this tool does',
  schema: MyToolSchema,
  execute: this.myToolFunction.bind(this)
}
```

3. **Add the tool method**:
```typescript
async myToolFunction(params: any): Promise<any> {
  const { param1, param2 } = MyToolSchema.parse(params);
  // Implementation
  return result;
}
```

### Testing Guidelines

- Test new agents with various input types
- Verify error handling for edge cases
- Test integration with the orchestrator
- Check logging output for debugging information

### Documentation Requirements

- Update README.md for significant changes
- Add JSDoc comments for public methods
- Update CHANGELOG.md with your changes
- Include usage examples for new features

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Clear description** of the issue
2. **Steps to reproduce** the problem
3. **Expected vs actual behavior**
4. **Environment information** (Node.js version, OS, etc.)
5. **Log output** if available
6. **Code samples** that demonstrate the issue

Use the GitHub issue template:
```markdown
**Bug Description:**
Brief description of the bug

**Steps to Reproduce:**
1. Run command X
2. Input Y
3. Observe Z

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Environment:**
- Node.js version:
- OS:
- MM-Agent version:

**Logs:**
```
Include relevant log output
```

## ✨ Feature Requests

For new features:

1. **Check existing issues** to avoid duplicates
2. **Describe the use case** clearly
3. **Explain the benefit** to users
4. **Provide examples** of how it would work
5. **Consider implementation** complexity

## 📝 Pull Request Process

### Before Submitting

1. **Test your changes** thoroughly
2. **Update documentation** as needed
3. **Follow code style** guidelines
4. **Add appropriate logging**
5. **Check for TypeScript errors**

### Pull Request Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review of changes completed
- [ ] Documentation updated if needed
- [ ] Changes tested with multiple scenarios
- [ ] No TypeScript compilation errors
- [ ] Logging added for debugging
- [ ] CHANGELOG.md updated

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature  
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested with demo mode
- [ ] Tested with interactive mode
- [ ] Tested edge cases
- [ ] All agents still functional

## Documentation
- [ ] README updated
- [ ] Code comments added
- [ ] Examples provided
- [ ] CHANGELOG updated
```

## 🔍 Code Review Process

All submissions require review before merging:

1. **Automated checks** must pass
2. **Manual review** by maintainers
3. **Testing** of new functionality  
4. **Documentation** review
5. **Integration** testing

## 🏷️ Versioning

We use [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backward-compatible functionality
- **PATCH** version for backward-compatible bug fixes

## 📞 Getting Help

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Documentation**: Check README.md and code comments

## 🙏 Recognition

Contributors will be recognized in:
- CHANGELOG.md for their specific contributions
- README.md contributors section (planned)
- GitHub contributors page

Thank you for contributing to MM-Agent! 🤖