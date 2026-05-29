# Template de Prompt para Kimi Web — Engenharia

## CHECKLIST obrigatória antes de enviar:
- [ ] Especificar formato de saída (JS/CJS/ESM/TS)
- [ ] Especificar runtime (Node.js v24, não Deno/Bun)
- [ ] Especificar se usa módulos (`require` vs `import`)
- [ ] Especificar convenções de nomes do projeto
- [ ] Pedir código de produção, não pseudocódigo
- [ ] Pedir para NÃO usar classes se o projeto usa funções
- [ ] Especificar se deve incluir testes e em qual formato

## Exemplo de prompt bem formulado:

```
Sou engenheiro no Luna CLI v3.3 — projeto Node.js v24, CommonJS (.cjs),
sem TypeScript, sem Babel.

Formato obrigatório:
- JavaScript puro (ES2024)
- `module.exports = { ... }`
- `const { x } = require('./file.cjs')`
- NÃO usar classes, usar funções e objetos
- NÃO usar TypeScript (sem tipos, sem interfaces, sem enums)
- NÃO usar ESM `import/export`

Gere o código de produção completo para [FEATURE].
```
