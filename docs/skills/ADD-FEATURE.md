# Skill: Adicionar Nova Feature

## Quando Usar
Quando implementando funcionalidade nova no Dashboard.

## Passos

1. **Entenda o requisito**
   - Leia a descricao completa
   - Pergunte se algo nao estiver claro
   - Identifique se eh breaking change

2. **Analise o impacto**
   - Quantos arquivos serao afetados?
   - Precisa de nova API? Nova pagina? Novo componente?
   - Ha dependencias externas (GitHub, Vercel, WhatsApp)?

3. **Planeje a implementacao**
   - Para >3 arquivos: escreva plano bullet-point
   - Para >5 arquivos: peca confirmacao antes
   - Identifique arquivos existentes para reusar

4. **Implemente por camadas**
   - Backend primeiro (API, dados)
   - Frontend depois (pagina, componente, hook)
   - Integracao por ultimo (conectar frontend ao backend)

5. **Valide e entregue**
   - Build passa?
   - Funcionalidade testada?
   - Nao quebrou outras funcionalidades?
   - Commit e (com confirmacao) push

## Checklist
- [ ] Backend: API criada/testada
- [ ] Frontend: pagina/componente criado
- [ ] Rotas: App.jsx atualizado
- [ ] Sidebar: novo item adicionado
- [ ] Build: passa sem erros
- [ ] Teste: funcionalidade verificada
- [ ] Commit: mensagem descritiva
