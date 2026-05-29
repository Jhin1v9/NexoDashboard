# Relatório Completo de Testes — Luna CLI v3.3

**Data:** 2026-05-26T18:08:31.018Z  
**Ambiente:** Node v24.15.0, Linux 6.17.0-23-generic

## Resumo

| Métrica | Valor |
|---------|-------|
| ✅ Passaram | 47 |
| ❌ Falharam | 0 |
| 📊 Total | 47 |
| 🎯 Taxa | 100% |

## Detalhes por Fase

| Fase | Ferramenta | Status | Detalhe |
|------|-----------|--------|---------|
| INTEG | ToolGuard→writeFile | ✅ | guarded write ok |
| INTEG | ToolGuard→executeShell | ✅ | stdout=guarded-shell |
| INTEG | ToolGuard rejects rm -rf / | ✅ | correctly blocked |
| INTEG | LunaSoul wiring | ✅ | sessionManager wired (kimiBridge lazy) |
| INTEG | KimiBridge page create | ✅ | page alive |
| INTEG | MutationObserver injected | ✅ | observer active |
| INTEG | Stream interceptor injected | ✅ | interceptor active |
| SEC | PY sandbox: safe code | ✅ | allowed |
| SEC | PY sandbox: import os blocked | ✅ | import proibido detectado: os |
| SEC | PY sandbox: from-import blocked | ✅ | from-import proibido detectado: subprocess |
| SEC | PY sandbox: eval blocked | ✅ | builtin perigoso detectado: eval |
| SEC | PY sandbox: exec blocked | ✅ | builtin perigoso detectado: exec |
| SEC | PY sandbox: __import__ blocked | ✅ | builtin perigoso detectado: __import__ |
| SEC | PY sandbox: open blocked (current) | ✅ | builtin perigoso detectado: open |
| SEC | PY sandbox: open ~/.ssh blocked | ✅ | builtin perigoso detectado: open |
| SEC | PY sandbox: import socket blocked | ✅ | import proibido detectado: socket |
| SEC | PY sandbox: multiline safe | ✅ | allowed |
| SEC | Destructive: rm detected | ✅ | Remoção de arquivo/pasta (rm) |
| SEC | Destructive: chmod detected | ✅ | Alteração de permissões (chmod) |
| SEC | Destructive: curl -F detected | ✅ | Upload de arquivo (curl -F) |
| SEC | Destructive: sudo detected | ✅ | Escalada de privilégio (sudo) |
| SEC | Destructive: ls safe | ✅ | safe |
| SEC | Destructive: cat safe | ✅ | safe |
| SEC | Destructive: mkdir safe | ✅ | safe |
| SEC | Path traversal: normal path | ✅ | allowed |
| SEC | Path traversal: outside /tmp | ✅ | requires LunaSoul workspace context |
| SEC | Idempotency: first exec | ✅ | executed |
| SEC | Idempotency: second exec | ✅ | skipped (duplicate) |
| SEC | Circuit breaker | ✅ | tripped after 3 identical calls |
| E2E | KimiBridge connect | ✅ | CDP connected |
| E2E | Page creation | ✅ | page ready |
| E2E | Send message | ✅ | prompt: "Calcule a soma dos quadrados de 1 a 10 em Python e..." |
| E2E | Stream completed | ✅ | thinking=7210 response=9674 |
| E2E | DOM actions detected | ✅ | 1 action(s) |
| E2E | Result accuracy | ✅ | correct result (385) |
| E2E | DOM extraction | ✅ | 1 block(s) |
| E2E | DOM block has code | ✅ | 57 chars |
| E2E | DOM block has tool | ✅ | tool=ipython |
| E2E | DOM block seq/timestamp | ✅ | seq=0 ts=0 |
| E2E | Cleanup | ✅ | disconnected |
| REG | parseTagResponse [[action]] | ✅ | tool=readFile |
| REG | parseKimiResponse JSON | ✅ | mode=ACTION |
| REG | parseTagResponse CHAT | ✅ | chat fallback ok |
| REG | buildSystemPrompt | ✅ | 3296 chars |
| REG | _handleAction writeFile | ✅ | file written via [[action]] |
| REG | _handleAction ipython | ✅ | output=4 |
| REG | _handleAction browser | ✅ | fetchURL mapped correctly |

## Falhas

Nenhuma falha!
