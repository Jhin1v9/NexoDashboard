# Skill: Refatorar Codigo

## Quando Usar
Quando codigo funciona mas precisa de melhorias: legibilidade, performance, organizacao.

## Regras
- NUNCA refatore e adicione feature no mesmo commit
- SEMPRE teste antes e depois da refatoracao
- Prefira mudancas pequenas e atomicas
- Mantenha comportamento identico (se possivel)

## Passos

1. **Identifique o problema**
   - Codigo duplicado? → Extraia para funcao/componente
   - Funcao muito grande? → Divida em funcoes menores
   - Nomenclatura confusa? → Renomeie
   - Performance ruim? → Otimize algoritmo

2. **Faca backup mental**
   - Entenda o que o codigo faz antes de mudar
   - Identifique todos os lugares que usam o codigo

3. **Refatore incrementalmente**
   - Uma mudanca por vez
   - Teste apos cada mudanca
   - Commit a cada etapa se desejar

4. **Valide**
   - Build passa?
   - Funcionalidade identica?
   - Nenhum erro no console?

## Anti-Patterns para Refatorar
- Funcoes >50 linhas
- Nesting >3 niveis
- Nomes genericos (`data`, `item`, `temp`)
- Codigo duplicado (>3x)
- Imports nao usados
- Comentarios desatualizados
