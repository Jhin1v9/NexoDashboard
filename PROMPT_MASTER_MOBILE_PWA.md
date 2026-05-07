# 🎯 PROMPT MASTER — Dashboard Responsivo + PWA Mobile

> **Objetivo:** Transformar o NEXO Dashboard PRO em uma aplicação 100% responsiva para iPhone 11 e iPhone 15, e convertê-la em PWA instalável.
> 
> **Data:** 2026-05-01
> **De:** Luna (CTO Virtual)
> **Para:** Kimi Code / Implementador

---

## 📱 DISPOSITIVOS ALVO

| Modelo | Viewport | Resolução | PPI | Características |
|--------|----------|-----------|-----|-----------------|
| **iPhone 11** | 414×896 | 828×1792 | 326 | LCD, notch, sem dynamic island |
| **iPhone 15** | 393×852 | 1179×2556 | 460 | OLED, dynamic island, sempre melhor contraste |
| **iPhone 15 Plus** | 430×932 | 1290×2796 | 460 | OLED, tela maior |

**Regra:** Design para o menor viewport (393×852) e escala para cima.

---

## 🎨 MELHORES PRÁTICAS DE RESPONSIVIDADE (Pesquisa 2026)

### 1. Mobile-First (Tailwind já faz isso!)
- Começar com estilos mobile (`text-sm`, `p-4`)
- Escalar para desktop (`md:text-base`, `lg:p-8`)
- Nunca o contrário (desktop-first quebra mobile)

### 2. Touch Targets
- **Mínimo:** 48×48px (WCAG 2.1)
- **Ideal:** 44×44px para iOS
- **Botões:** min-h-[48px] min-w-[48px]
- **Links:** padding generoso (p-3 ou mais)

### 3. Viewport Meta Tag
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
```
- `viewport-fit=cover` = ocupa toda tela incluindo notch
- `maximum-scale=1` = previne zoom acidental em inputs

### 4. Safe Areas (Notch / Dynamic Island)
```css
/* Para iPhone com notch/dynamic island */
.safe-area-top {
  padding-top: env(safe-area-inset-top, 48px);
}
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 34px);
}
/* Valores fallback para simulador/browser */
```

### 5. Fluid Typography
- Usar `clamp()` para textos:
```css
h1 { font-size: clamp(1.25rem, 4vw, 2rem); }
p { font-size: clamp(0.875rem, 2.5vw, 1rem); }
```

### 6. Layout Flexível
- **Grid:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- **Cards:** largura full no mobile, metade no tablet, terço no desktop
- **Tabelas:** horizontal scroll ou cards no mobile
- **Sidebar:** transformar em bottom sheet ou hamburger no mobile

### 7. Imagens Responsivas
```html
<img srcset="img-400.jpg 400w, img-800.jpg 800w" 
     sizes="(max-width: 600px) 400px, 800px">
```

---

## 📲 PWA — PROGRESSIVE WEB APP

### O que funciona no iOS (2026):
✅ Add to Home Screen (WebClip)  
✅ Ícone personalizado  
✅ Tela de splash  
✅ Theme color na status bar  
✅ Standalone mode (sem Safari UI)  
✅ Cache básico  

### O que NÃO funciona no iOS:
❌ Service Worker persistente (7-day cache limit)  
❌ Push notifications  
❌ Background sync  
❌ Badges  
❌ Bluetooth/NFC  

### Estratégia iOS: "WebClip otimizado"
> Não é PWA full, mas uma experiência app-like via WebClip

---

## 🔧 CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Responsividade (CRÍTICO)

#### A. Meta Tags no HTML
```html
<head>
  <!-- Viewport -->
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  
  <!-- iOS WebClip -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="NEXO Dashboard">
  <meta name="theme-color" content="#0f172a">
  
  <!-- Ícones iOS -->
  <link rel="apple-touch-icon" href="/icons/icon-192.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png">
  
  <!-- PWA Manifest -->
  <link rel="manifest" href="/manifest.json">
</head>
```

#### B. CSS Global (Safe Areas + Base)
```css
/* Reset para mobile */
html {
  -webkit-text-size-adjust: 100%;
  touch-action: manipulation;
}

body {
  /* Previne scroll horizontal */
  overflow-x: hidden;
  /* Smooth scrolling */
  -webkit-overflow-scrolling: touch;
}

/* Safe areas para notch/dynamic island */
.safe-area-inset-top {
  padding-top: max(env(safe-area-inset-top, 0px), 48px);
}

.safe-area-inset-bottom {
  padding-bottom: max(env(safe-area-inset-bottom, 0px), 34px);
}

/* Touch targets */
.btn-touch {
  min-height: 48px;
  min-width: 48px;
}

/* Fluid typography */
.fluid-h1 {
  font-size: clamp(1.25rem, 5vw, 2rem);
}

.fluid-body {
  font-size: clamp(0.875rem, 2.5vw, 1rem);
}
```

#### C. Layout Mobile
- **Header:** fixo no topo, altura reduzida (56px), com safe-area-inset-top
- **Sidebar:** converter para drawer/bottom sheet no mobile
- **Cards:** largura 100% no mobile, scroll horizontal se necessário
- **Tabelas:** cards no mobile (não tabela), ou scroll horizontal
- **Botões:** stack vertical no mobile, horizontal no desktop
- **Formulários:** inputs full-width, labels acima (não ao lado)

#### D. Breakpoints Tailwind
```
sm: 640px   (iPhone 11/15 landscape)
md: 768px   (iPad mini)
lg: 1024px  (iPad)
xl: 1280px  (Desktop)
```

### Fase 2: PWA / WebClip

#### A. Manifest.json
```json
{
  "name": "NEXO Dashboard PRO",
  "short_name": "NEXO",
  "description": "Dashboard de gestão NEXO Digital",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-72.png", "sizes": "72x72", "type": "image/png" },
    { "src": "/icons/icon-96.png", "sizes": "96x96", "type": "image/png" },
    { "src": "/icons/icon-128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-144.png", "sizes": "144x144", "type": "image/png" },
    { "src": "/icons/icon-152.png", "sizes": "152x152", "type": "image/png" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "screenshots": [
    { "src": "/screenshots/mobile.png", "sizes": "393x852", "type": "image/png", "form_factor": "narrow" },
    { "src": "/screenshots/desktop.png", "sizes": "1280x720", "type": "image/png", "form_factor": "wide" }
  ]
}
```

#### B. Service Worker (Cache básico para offline)
```javascript
// sw.js
const CACHE_NAME = 'nexo-dashboard-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // CSS e JS serão adicionados pelo build
];

// Install: cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache-first para static, network-first para API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Não cacheia API
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Static assets: cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        // Opcional: cacheia novos assets
        return response;
      });
    })
  );
});
```

#### C. Registro do Service Worker
```javascript
// main.jsx ou App.jsx
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registrado:', registration.scope);
      })
      .catch((error) => {
        console.log('SW falhou:', error);
      });
  });
}
```

#### D. Ícones necessários
- `/public/icons/icon-72.png` a `icon-512.png`
- `/public/icons/icon-180.png` (apple-touch-icon)
- `/public/icons/icon-maskable.png` (Android adaptativo)
- Gerar a partir do logo NEXO (SVG ou PNG)

### Fase 3: Componentes Mobile

#### A. Header Mobile
```jsx
<header className="fixed top-0 left-0 right-0 z-50 h-14 safe-area-inset-top bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4">
  {/* Logo pequeno */}
  <img src="/logo-icon.svg" className="h-8 w-8" />
  
  {/* Título truncado */}
  <h1 className="text-sm font-semibold truncate max-w-[150px]">NEXO Dashboard</h1>
  
  {/* Menu hamburger */}
  <button className="btn-touch p-2 rounded-lg hover:bg-slate-800">
    <MenuIcon className="h-6 w-6" />
  </button>
</header>
```

#### B. Bottom Navigation (iOS style)
```jsx
<nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 safe-area-inset-bottom pb-[env(safe-area-inset-bottom,0px)]">
  <div className="flex justify-around items-center h-16">
    <NavButton icon={HomeIcon} label="Home" to="/" />
    <NavButton icon={WalletIcon} label="Caixa" to="/financeiro" />
    <NavButton icon={UsersIcon} label="Clientes" to="/clientes" />
    <NavButton icon={SettingsIcon} label="Config" to="/config" />
  </div>
</nav>
```

#### C. Cards Mobile
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
  {cards.map(card => (
    <div key={card.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
      {/* Ícone + Título na mesma linha */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <Icon className="h-5 w-5 text-emerald-400" />
        </div>
        <h3 className="text-sm font-medium text-slate-200">{card.title}</h3>
      </div>
      {/* Valor grande */}
      <p className="text-2xl font-bold text-white">{card.value}</p>
      {/* Badge pequena */}
      <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">
        {card.status}
      </span>
    </div>
  ))}
</div>
```

#### D. Tabela → Cards (Mobile)
```jsx
// Mobile: cards
<div className="block sm:hidden space-y-3">
  {items.map(item => (
    <div key={item.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-sm">{item.name}</h4>
        <span className="text-xs text-slate-400">{item.date}</span>
      </div>
      <p className="text-lg font-semibold">{item.value}</p>
      <div className="mt-2 flex gap-2">
        <button className="btn-touch flex-1 py-2 bg-emerald-600 rounded-lg text-sm">Pagar</button>
        <button className="btn-touch flex-1 py-2 bg-slate-700 rounded-lg text-sm">Detalhes</button>
      </div>
    </div>
  ))}
</div>

// Desktop: tabela normal
<div className="hidden sm:block">
  <table>...</table>
</div>
```

#### E. Sidebar → Drawer
```jsx
// Overlay escuro
<div className={`fixed inset-0 z-[60] bg-black/50 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
     onClick={() => setIsOpen(false)} />

// Drawer lateral
<div className={`fixed top-0 left-0 bottom-0 z-[70] w-[280px] bg-slate-900 border-r border-slate-800 transform transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
  <div className="safe-area-inset-top p-4">
    {/* Conteúdo do menu */}
  </div>
</div>
```

#### F. Inputs Mobile
```jsx
<div className="space-y-4">
  <div>
    <label className="block text-sm font-medium text-slate-300 mb-1.5">Nome</label>
    <input 
      type="text"
      className="w-full h-12 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      placeholder="Digite o nome"
    />
  </div>
</div>
```
- Inputs com altura 48px (touch)
- Fonte 16px (previne zoom no iOS)
- Bordas arredondadas (iOS style)
- Full width no mobile

---

## 📋 PÁGINAS A MODIFICAR

1. **Home.jsx** — Cards responsivos, gráficos adaptáveis
2. **Financeiro.jsx** — Tabela → cards no mobile
3. **Clientes.jsx** — Grid responsivo, cards full-width
4. **Tarefas.jsx** — Lista com checkboxes grandes
5. **Operacoes.jsx** — Bottom sheet para ações
6. **Configuracoes.jsx** — Seções em accordion
7. **App.jsx** — Header + bottom nav + safe areas
8. **index.html** — Meta tags PWA

---

## 🧪 TESTES

### Checklist de Teste Mobile
- [ ] Abrir no iPhone 11 (simulador ou real)
- [ ] Abrir no iPhone 15 (simulador ou real)
- [ ] Testar landscape e portrait
- [ ] Verificar touch targets (48px)
- [ ] Testar scroll em todas as páginas
- [ ] Verificar safe areas (notch/dynamic island)
- [ ] Testar inputs (zoom não deve ocorrer)
- [ ] Verificar velocidade (Lighthouse > 90)
- [ ] Testar "Add to Home Screen"
- [ ] Verificar se abre em standalone mode

### Ferramentas
- Chrome DevTools → Device Mode → iPhone 11/15
- Safari Web Inspector (iOS)
- Lighthouse → Mobile audit
- PageSpeed Insights

---

## 🎨 DESIGN TOKENS MOBILE

```css
:root {
  /* Espaçamento */
  --space-xs: 0.25rem;  /* 4px */
  --space-sm: 0.5rem;   /* 8px */
  --space-md: 1rem;     /* 16px */
  --space-lg: 1.5rem;   /* 24px */
  --space-xl: 2rem;     /* 32px */
  
  /* Touch */
  --touch-min: 48px;
  --touch-target: 44px;
  
  /* Border radius iOS */
  --radius-sm: 0.5rem;   /* 8px */
  --radius-md: 0.75rem;  /* 12px */
  --radius-lg: 1rem;     /* 16px */
  --radius-xl: 1.25rem;  /* 20px */
  
  /* Tipografia fluida */
  --text-xs: clamp(0.625rem, 1.5vw, 0.75rem);
  --text-sm: clamp(0.75rem, 2vw, 0.875rem);
  --text-base: clamp(0.875rem, 2.5vw, 1rem);
  --text-lg: clamp(1rem, 3vw, 1.125rem);
  --text-xl: clamp(1.125rem, 4vw, 1.25rem);
  --text-2xl: clamp(1.25rem, 5vw, 1.5rem);
  --text-3xl: clamp(1.5rem, 6vw, 2rem);
}
```

---

## 🚀 INSTRUÇÕES DE DEPLOY

### Build com PWA
```bash
# Build o frontend
npm run build

# Copiar manifest e sw para dist/
cp public/manifest.json dist/
cp public/sw.js dist/
cp -r public/icons dist/

# Deploy na Vercel
cd dist && vercel --prod
```

### Verificar PWA
1. Chrome DevTools → Application → Manifest (deve mostrar válido)
2. Chrome DevTools → Application → Service Workers (deve mostrar registrado)
3. Lighthouse → PWA audit → Score > 90

---

## 📚 RECURSOS

- [Tailwind CSS Mobile-First](https://tailwindcss.com/docs/responsive-design)
- [iOS Safe Areas](https://developer.apple.com/documentation/uikit/uiview/positioning_content_relative_to_the_safe_area)
- [PWA iOS Limitations 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

---

*"Funciona > Perfeito > Bonito > Nada"*

🌙 *Luna — CTO Virtual — NEXO Digital*
