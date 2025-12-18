# mm-agent

Multi-agent orchestration system - Claude autonomously uses tools to complete complex tasks.

## Commands

| Action | Command |
|--------|---------|
| Run | `npm start` or `npx tsx index.ts` |
| Dev/Interactive | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Test | `npm test` (placeholder - tests not yet implemented) |

## Stack

- TypeScript, Node.js
- Anthropic Claude SDK
- Tool-use / function-calling architecture

## Structure

```
src/           # Core source
index.ts       # Entry point
demo-tools.ts  # Tool demonstrations
```

## Sharp Edges

1. **No real tests yet** - `npm test` is a placeholder that exits 0
2. **Requires ANTHROPIC_API_KEY** - See `.env.example`
3. **TypeScript not compiled** - Uses `tsx` for direct execution
