# 🌙 LUNA — Regras de Operação v10.2

## REGRAS DEFINITIVAS DE ENVIO

### 1. SCAN (a cada 10 minutos)
- Extrai mensagens dos grupos monitorados
- Compara com checkpoint (hashes conhecidos)
- Se há novidades → guarda no buffer, **NÃO ENVIA NADA**
- Se não há novidades → silêncio, apenas atualiza dados internos

### 2. RELATÓRIO (a cada 30 minutos)
- Verifica o buffer de novidades acumuladas
- Se há novidades no buffer → envia **RELATÓRIO COMPLETO** no grupo
- Se não há novidades → verifica histórico:
  - Se último relatório teve novidades → envia 1x "sem novidades"
  - Se já enviou "sem novidades" antes → **SILÊNCIO TOTAL**

### 3. DESTINO
- **SÓ** grupo 🏆Production - 2026🙏
- **NUNCA** chats pessoais, outros grupos, números individuais

### 4. FLUXO VISUAL

```
SCAN 10min ──► Extrai msgs ──► Novas? ──► Sim ──► Guarda no buffer ──► FIM
                              │                    (não envia nada)
                              └── Não ──► Atualiza checkpoint ──► FIM

RELATÓRIO 30min ──► Buffer cheio? ──► Sim ──► Envia relatório completo ──► Limpa buffer
                   │                           no grupo Production
                   └── Não ──► Último tinha novidades? ──► Sim ──► Envia 1x "sem novidades"
                                              │
                                              └── Não ──► SILÊNCIO TOTAL
```

### 5. REGRA DE SILÊNCIO
- Após enviar "sem novidades", fica em silêncio até detectar novas mensagens
- Só volta a enviar quando houver novidade real
- Não spama o grupo com relatórios vazios

### 6. GRUPOS MONITORADOS
- 🏆Production - 2026🙏 (interno)
- 👤 Paulo (web) (cliente)

### 7. MARCA LUNA
Todo relatório inclui:
- 🌙 Luna — CTO Virtual NEXO Digital
- Data/hora (timezone Europe/Madrid)
- Versão
- Split financeiro: 25% cada (Abner/Nonoke/Elias/NEXO)
