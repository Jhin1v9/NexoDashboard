# Plano de Ação: Redesign Mobile do NEXO Dashboard Pro

## Resumo Executivo

O NEXO Dashboard Pro está **inutilizável em mobile**. A investigação revelou que o layout atual é desktop-first puro: sidebar fixa de ~240px, topbar densa com 6+ elementos, grids de 4 colunas, tabelas sem scroll horizontal, e **zero media queries `@media (max-width: ...)`** no CSS. O `MobileBottomNav` existe mas só esconde em `sm:hidden` e cobre apenas 5 rotas de 20+. O redesign exige uma arquitetura mobile-first com: sidebar drawer, topbar minimalista, bottom nav expandido, grids responsivos, tabelas scrolláveis, e touch targets ≥44px.

---

## Análise do Codebase

### Arquivos relevantes investigados:

| Arquivo | Relevância | Problema Identificado |
|---------|-----------|----------------------|
| `frontend/src/App.jsx` | **CRÍTICO** | Layout `flex h-screen` com `Sidebar` sempre visível. Não há lógica de colapso mobile. `MobileBottomNav` renderizado sempre mas sem controle de visibilidade condicional robusta. |
| `frontend/src/components/Sidebar.jsx` | **CRÍTICO** | Sidebar fixa à esquerda, ~240px de largura. Usa `sm:hidden` APENAS no `MobileBottomNav`, não no próprio sidebar. Não há drawer/collapse para mobile. |
| `frontend/src/components/TopBar.jsx` | **CRÍTICO** | Altura fixa 56px com 6 elementos: menu, busca, changelog, notificações, push, status, hora, usuário. Em 375px vira sardinha ou quebra linha feio. |
| `frontend/src/components/MobileBottomNav.jsx` | **ALTA** | Apenas 5 itens (Home, Caixa, Clientes, Tarefas, Ops). Faltam 15+ rotas. Sem drawer de "mais". Classes `mobile-nav-btn` e `active` não definidas no CSS. |
| `frontend/src/pages/Dashboard.jsx` | **CRÍTICO** | Grid de 4 colunas para stat cards (`grid-cols-4` implícito). Tabelas de lembretes, logs, etc. Gráficos Recharts sem `ResponsiveContainer` verificado. |
| `frontend/src/styles/index.css` | **CRÍTICO** | **ZERO media queries para mobile**. Apenas `@media print`. Não há classes utilitárias mobile. `mobile-nav-btn` e `active` mencionados no JSX mas NÃO DEFINIDOS no CSS. |
| `frontend/tailwind.config.js` | **MÉDIA** | Tema customizado com cores NEXO mas sem breakpoints customizados. Usa defaults do Tailwind (`sm:640px`, `md:768px`, `lg:1024px`). |
| `frontend/index.html` | **MÉDIA** | Viewport OK (`width=device-width, initial-scale=1.0`). Faltam `maximum-scale=1`, `user-scalable=no` para PWA feel. Faltam meta tags Apple (status-bar, fullscreen). |
| `frontend/src/components/ProtectedRoute.jsx` | **BAIXA** | Loading state OK. Sem impacto mobile. |

---

## Problemas Visuais Documentados (Screenshots)

Screenshots capturados em viewport **iPhone SE (375×667)**:

1. **Landing page**: 588×13338px — layout quebrado, provavelmente desktop não adaptado
2. **Login page**: 375×667px — 27.8 KB, possivelmente OK mas precisa verificar
3. **After login**: 375×667px — 51.4 KB, possivelmente redirecionando para login
4. **Dashboard**: 375×667px — 68.4 KB, **provavelmente sidebar cobrindo 60%+ da tela**
5. **Tarefas**: 375×667px — 66.6 KB, tabelas provavelmente cortadas
6. **Financeiro**: 375×667px — 64.0 KB, gráficos Recharts provavelmente overflow
7. **Caixa**: 375×667px — 67.2 KB, widgets provavelmente empilhados sem scroll

---

## Dependências e Impacto

### O que pode quebrar:
- **Sidebar**: Se esconder em mobile, rotas que dependem de submenu (Financeiro, Comunicação) precisam de navegação alternativa
- **TopBar**: Remover/buscar elementos pode afetar funcionalidades (CommandPalette trigger, notificações)
- **Grids**: Mudar `grid-cols-4` para `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` afeta todos os cards do dashboard
- **Tabelas**: Adicionar `overflow-x-auto` pode quebrar layouts que dependem de `w-full` sem scroll
- **LunaFloatingButton**: Pode cobrir o bottom nav em mobile — precisa reposicionar
- **CommandPalette**: Trigger `Ctrl+K` não funciona em mobile — precisa de botão alternativo

### O que precisa ser alterado junto:
- Todas as 20+ páginas em `src/pages/` precisam de padding mobile (`p-4` em vez de `p-6`)
- Componentes de tabela em `components/finance/`, `components/ideas/`, etc.
- Gráficos em `components/charts/` precisam de `ResponsiveContainer` com `width="100%"`
- Modais e drawers precisam de `max-w-full` e `mx-4` em mobile

---

## Passos de Implementação

### FASE 1 — Fundação Mobile (CSS + Layout)
1. **[index.html]**: Adicionar meta tags mobile (Apple status-bar, PWA, prevent zoom)
2. **[styles/index.css]**: Criar classes mobile: `.mobile-nav-btn`, `.mobile-nav-btn.active`, `.safe-area-bottom`, `.touch-target`. Adicionar media queries `@media (max-width: 640px)` para esconder sidebar, reduzir padding, ajustar fontes.
3. **[tailwind.config.js]**: Adicionar `screens` customizados se necessário, ou usar defaults. Verificar se `sm:hidden` está funcionando corretamente.
4. **[App.jsx]**: Implementar lógica de detecção mobile (`useMediaQuery` ou `window.innerWidth`). Em mobile: esconder `Sidebar` e `TopBar` (ou reduzir TopBar), mostrar `MobileBottomNav` com drawer expandido.

### FASE 2 — Componentes de Navegação Mobile
5. **[Sidebar.jsx]**: Em mobile, transformar em **drawer slide-in** da esquerda (`fixed inset-0 z-50`, overlay escuro, swipe-to-close). Manter desktop intacto.
6. **[TopBar.jsx]**: Em mobile, reduzir para: **botão hamburger** (abre sidebar drawer) + **título da página** + **avatar usuário** (dropdown). Remover: busca full, changelog badge, notificações, status, hora (mover para menu).
7. **[MobileBottomNav.jsx]**: Expandir para 5 primários + botão "Mais" (abre drawer com todas as rotas). Adicionar badges e active states. Implementar swipe gestures.
8. **[CommandPalette.jsx]**: Adicionar botão de busca no TopBar mobile (ícone de lupa) que abre o CommandPalette em fullscreen.

### FASE 3 — Páginas e Conteúdo
9. **[Dashboard.jsx]**: Grid stat cards: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. Tabelas: wrap em `overflow-x-auto`. Gráficos: verificar `ResponsiveContainer`. Cards de lembrete: empilhar verticalmente.
10. **[Tarefas.jsx]**: Tabela de tarefas → cards verticais em mobile (cada tarefa = card com título, status, prioridade, ações). Filtros: collapsible accordion.
11. **[Financeiro.jsx]**: Gráficos Recharts: garantir `ResponsiveContainer`. Tabela de transações: scroll horizontal ou cards. Cards de resumo: 2 colunas em mobile.
12. **[Caixa.jsx]**: Widgets empilhados. Gráfico de fluxo: altura reduzida em mobile. Tabela: scroll horizontal.
13. **[Leads.jsx]**, **[Clientes.jsx]**, **[Ideias.jsx]**, etc.: Aplicar mesmo padrão — tabelas viram cards ou scroll horizontal.
14. **[EmailHub.jsx]**: Layout de 3 painéis (sidebar + lista + reader) → mobile: lista fullscreen, tap abre reader, swipe back.

### FASE 4 — Touch e UX
15. **[LunaFloatingButton.jsx]**: Em mobile, reposicionar para **top-right** ou **acima do bottom nav** (margin-bottom: 80px). Aumentar touch target para 56px.
16. **[ToastContainer.jsx]**: Em mobile, toasts devem aparecer no **topo** (não bottom, onde o nav está). Largura `w-[calc(100%-2rem)] mx-4`.
17. **[NotificationCenter.jsx]**: Drawer slide-in da direita em mobile, não dropdown.
18. **Global**: Touch targets mínimo 44px (ideally 48px). Fontes mínimo 16px para inputs (prevenir zoom iOS). `overscroll-behavior: none` para evitar bounce.

### FASE 5 — Testes e Validação
19. **Screenshots**: Re-tirar screenshots em iPhone SE, iPhone 14 Pro, Pixel 7.
20. **Playwright E2E**: Adicionar testes mobile nos specs existentes (`e2e/specs/`).
21. **Build**: `npm run build` e verificar se não há erros de CSS/JS.

---

## Riscos Identificados

| Risco | Mitigação |
|-------|-----------|
| Sidebar drawer pode conflitar com gestos de navegação do browser (swipe back) | Usar `touch-action: pan-y` no drawer, overlay com `z-50` alto |
| Bottom nav pode cobrir conteúdo importante | Adicionar `pb-20` (padding-bottom) ao `<main>` quando mobile |
| Gráficos Recharts podem não redimensionar corretamente | Envolver em `ResponsiveContainer` com `width="100%" height={300}` |
| Tabelas com muitas colunas viram scroll horizontal feio | Limitar a 3-4 colunas visíveis em mobile, resto em expandable row |
| Performance em mobile (React + Framer Motion + Recharts) | Lazy load de componentes pesados, usar `will-change` com cuidado |
| Luna chat panel pode não caber em 375px | Transformar em bottom sheet em mobile |

---

## Critérios de Sucesso

- [ ] Sidebar não é visível em viewport < 640px (apenas drawer via hamburger)
- [ ] TopBar mobile tem ≤ 3 elementos visíveis
- [ ] BottomNav cobre todas as rotas principais (5 primárias + drawer "Mais")
- [ ] Dashboard renderiza sem scroll horizontal forçado em 375px
- [ ] Tarefas/Financeiro/Leads usam cards ou scroll horizontal controlado
- [ ] Touch targets ≥ 44px em todos os botões e links
- [ ] Inputs não causam zoom automático no iOS (font-size ≥ 16px)
- [ ] Screenshots mobile mostram interface funcional e legível
- [ ] Build passa sem erros
- [ ] E2E tests mobile passam

---

## Estimativa

| Fase | Passos | Arquivos | Complexidade | ~Tempo |
|------|--------|----------|-------------|--------|
| 1 — Fundação | 4 | 4 | Média | 2h |
| 2 — Navegação | 4 | 4 | Alta | 4h |
| 3 — Páginas | 6 | 15+ | Alta | 8h |
| 4 — Touch/UX | 4 | 6 | Média | 3h |
| 5 — Testes | 3 | — | Baixa | 2h |
| **Total** | **21** | **25+** | **Alta** | **~19h** |

---

## Screenshots de Referência

Salvos em: `/home/jhin/NEXO_DASHBOARD_PRO/mobile-screenshots/`
- `01-landing-mobile.png` — Landing page atual (quebrada)
- `02-login-mobile.png` — Login page
- `03-after-login-mobile.png` — Post-login
- `04-dashboard-mobile.png` — Dashboard (problema principal)
- `05-tarefas-mobile.png` — Tarefas
- `06-financeiro-mobile.png` — Financeiro
- `07-caixa-mobile.png` — Caixa

---

*Plano gerado por Luna em modo Detetive — 2026-06-01*
*Aguardando aprovação de Abner para execução.*
