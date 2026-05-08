# Skill: Criar Nova Pagina no Dashboard

## Quando Usar
Quando adicionando uma nova secao/funcionalidade ao Dashboard.

## Passos

1. **Crie o componente da pagina**
   ```bash
   frontend/src/pages/NomePagina.jsx
   ```

2. **Adicione a rota em `App.jsx`**
   ```jsx
   import NomePagina from './pages/NomePagina'
   // ...
   <Route path="/nome-pagina" element={<NomePagina />} />
   ```

3. **Adicione o link na Sidebar**
   ```jsx
   import { SomeIcon } from 'lucide-react'
   const navItems = [
     // ...existing
     { path: '/nome-pagina', icon: SomeIcon, label: 'Nome Pagina' },
   ]
   ```

4. **Crie a pagina seguindo o padrao**
   ```jsx
   export default function NomePagina() {
     return (
       <div className="max-w-6xl mx-auto">
         <h1 className="text-2xl font-bold mb-6">Titulo</h1>
         {/* conteudo */}
       </div>
     )
   }
   ```

5. **Build e teste**
   ```bash
   cd frontend && npm run build
   ```

## Padrao de Pagina
- Wrapper: `max-w-6xl mx-auto` para centralizar
- Titulo: `text-2xl font-bold mb-6`
- Cards: `bg-nexo-card border border-nexo-border rounded-xl p-5`
- Loading: spinner animado
- Empty state: icone + mensagem amigavel
