# Luna + Kimi: Login Persistente

## 1. Objetivo
Fazer com que o Kimi (provider `kimi`) nunca peça login dentro da automação do Luna, reusando uma sessão previamente autenticada.

## 2. Arquitetura escolhida (v11.0)
- O Luna inicia **seu próprio Chrome/Chromium** via CDP (`--remote-debugging-port=9222`).
- Esse Chrome usa um **perfil isolado e persistente** em `~/.luna-kernel/chrome-profile`.
- O usuário faz login no Kimi **uma única vez** dentro dessa janela do Chrome do Luna.
- A partir daí, cookies, `localStorage`, `sessionStorage` e tokens ficam salvos nesse perfil.
- A cada reinício do `luna-server`, o mesmo `user-data-dir` é reusado, então a sessão continua válida.

## 3. Por que não copiar o perfil do usuário?
Tentativas anteriores copiavam arquivos de `~/.config/google-chrome` para `~/.luna-kernel/chrome-profile`. Isso falhou porque:
- O Kimi usa tokens vinculados a `device_id` e fingerprint do navegador.
- Cookies `HttpOnly` + `SameSite=Strict` são rejeitados quando o contexto muda.
- O Kimi limpa `localStorage` tokens (`access_token`, `refresh_token`) quando detecta inconsistência de sessão.
- Resultado: a página mostrava o botão **Log In** mesmo com os cookies copiados.

## 4. Arquivos envolvidos
| Arquivo | Função |
|---------|--------|
| `~/.luna-kernel/kimi-bridge.cjs` | Gerencia o Chrome CDP, perfil persistente e estado de login do Kimi. |
| `~/.luna-kernel/config/luna-config` | Configurações de portas, perfis e timeouts. |
| `~/.luna-kernel/chrome-profile` | Perfil isolado do Chrome usado pelo Luna. |
| `~/.luna-kernel/chrome-profile.bak.*` | Backups antigos do perfil (criados antes de reset). |
| `NEXO_DASHBOARD_PRO/backend/luna-server.js` | Servidor web na porta `3458` que expõe `/api/chat` e outras rotas. |
| `NEXO_DASHBOARD_PRO/backend/luna-chat-routes.js` | Rotas de chat, sessões e ferramentas. |

## 5. Como reiniciar/resetar o perfil (procedimento operacional)
```bash
# 1. Parar o servidor
pm2 stop luna-server

# 2. Matar o Chrome CDP do Luna
pkill -f 'chrom.*remote-debugging-port=9222'

# 3. Fazer backup do perfil atual (opcional)
mv ~/.luna-kernel/chrome-profile ~/.luna-kernel/chrome-profile.bak.$(date +%Y%m%d-%H%M%S)

# 4. Criar perfil vazio
mkdir -p ~/.luna-kernel/chrome-profile

# 5. Reiniciar
pm2 restart luna-server --update-env && pm2 save
```

## 6. Como verificar se está logado
```bash
curl -s http://127.0.0.1:9222/json/version
```
Depois, abrir o Kimi na janela do Chrome do Luna e confirmar que o avatar/nome do usuário aparece no canto inferior esquerdo (ex: `nexodigi...`) e que não há botão **Log In**.

## 7. APIs de chat relevantes
- `POST /api/chat` — envia mensagem; retorna `{ ok, sessionId, status: 'processing' }`.
- `GET /api/chat/sessions` — lista sessões.
- `GET /api/chat/session/:id/messages` — lê mensagens de uma sessão.
- `POST /api/luna/execute` — executa uma tool do Luna diretamente.

## 8. Provedor padrão
- O provider `kimi` é o padrão para web chat.
- Pode ser alterado via configuração ou pelo parâmetro `provider` no processamento.

## 9. Cuidados
- **Nunca matar o Chrome do usuário** (`~/.config/google-chrome`). Sempre operar no perfil do Luna.
- Não tentar copiar `Cookies`, `Login Data`, `Local State` do perfil do usuário para o perfil do Luna — isso invalida a sessão.
- Se o Kimi pedir login novamente, repetir o procedimento da seção 5.

## 10. Histórico de mudanças
| Versão | Data | Mudança |
|--------|------|---------|
| v10.37 | 2026-07-03 | Tentativa de copiar perfil do usuário (falhou). |
| v11.0 | 2026-07-04 | Perfil isolado do Luna com login direto do usuário. |
