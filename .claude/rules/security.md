# Security Conventions

- **Never commit ANTHROPIC_API_KEY**: Use .env (gitignored)
- **Tool execution is dangerous**: Validate all tool inputs before execution
- **File operations need sandboxing**: Don't let agent write anywhere
- **Audit tool definitions**: Each tool is an attack surface
