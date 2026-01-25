# {{serviceName}}

{{#if description}}{{description}}{{/if}}

## Commands

```bash
{{packageManager}} install
{{packageManager}} dev
{{packageManager}} build
```

## Key Files

- `src/index.ts` - Main entry point
- `package.json` - Dependencies and scripts
{{#if runtime}}

## Runtime

{{runtime}}
{{/if}}
