# Coding Conventions — NEXO Dashboard PRO

## JavaScript / React

### Naming
```
Components:     PascalCase       (ChangelogCard, DashboardPage)
Hooks:          camelCase + use  (useChangelog, useTransactions)
Functions:      camelCase        (fetchData, handleSubmit)
Variables:      camelCase        (userName, isLoading)
Constants:      UPPER_SNAKE      (API_URL, MAX_RETRIES)
Files:          PascalCase.jsx   (componentes) | camelCase.js (util)
CSS Classes:    kebab-case       (nexo-card, bg-nexo-accent)
```

### Component Structure
```jsx
// 1. React imports
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

// 2. Third-party
import axios from 'axios'

// 3. Internal (absolute > relative)
import useChangelog from '../hooks/useChangelog'
import { formatDate } from '../utils/date'

// 4. Component
export default function ExampleComponent({ title, data }) {
  // Hooks first
  const [count, setCount] = useState(0)
  const { items, loading } = useChangelog()
  
  // Derived state
  const total = items.length
  
  // Handlers
  const handleClick = () => setCount(c => c + 1)
  
  // Effects
  useEffect(() => {
    // logic
    return () => { /* cleanup */ }
  }, [dependency])
  
  // Render
  return (
    <motion.div className="bg-nexo-card p-4 rounded-xl">
      <h2 className="text-lg font-bold">{title}</h2>
      <button onClick={handleClick}>Count: {count}</button>
    </motion.div>
  )
}
```

### Async Patterns
```javascript
// ✅ GOOD: async/await com try/catch
const fetchData = async () => {
  try {
    const res = await axios.get('/api/data')
    return res.data
  } catch (err) {
    console.error('Fetch failed:', err.message)
    throw err
  }
}

// ❌ BAD: Promise chains sem error handling
axios.get('/api/data')
  .then(res => res.data)
  .catch(err => console.log(err)) // silenciado!
```

## Backend (Express)

### Route Structure
```javascript
// ✅ GOOD: validacao, resposta padronizada, error handling
app.post('/api/resource', (req, res) => {
  const { name, value } = req.body
  if (!name || !value) {
    return res.status(400).json({ success: false, error: 'name and value required' })
  }
  try {
    const item = createItem({ name, value })
    res.status(201).json({ success: true, item })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})
```

### JSON Helpers
```javascript
const readJSON = (file) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch { return null }
}

const writeJSON = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}
```

## CSS / Tailwind

### Color System
```
Background:     bg-nexo-bg        (#0f0f1a)
Card:           bg-nexo-card      (#1a1a2e)
Border:         border-nexo-border (#2a2a3e)
Accent:         text-nexo-accent   (#6366f1)
Success:        text-green-400
Danger:         text-red-400
Warning:        text-yellow-400
```

### Spacing Scale
```
1 = 4px   |  2 = 8px   |  3 = 12px
4 = 16px  |  6 = 24px  |  8 = 32px
```

### Glassmorphism
```html
<div class="glass">           /* backdrop-blur + bg-white/5 */
<div class="glass-card">      /* glass + border + rounded */
```

## Git

### Commit Messages (Portugues)
```
[Modulo] Acao descritiva

- Correcao: [Modulo] Corrige bug X
- Feature: [Modulo] Adiciona funcionalidade Y
- Refactor: [Modulo] Melhora performance de Z
- Docs: Atualiza documentacao
```

### Branches
- `main` — producao (protegido)
- `feature/nome-descritivo` — novas features
- `fix/nome-do-bug` — correcoes
