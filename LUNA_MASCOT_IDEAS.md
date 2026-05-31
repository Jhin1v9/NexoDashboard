🌙 **LUNA MASCOTE v2.0 — CONCEITO ICÔNICO**

Aqui está o plano completo para transformar o mascote em algo memorável. Dividi em 5 camadas de sofisticação:

---

## 1. 🎨 CONCEITO VISUAL: "A Lua Viva"

**Identidade visual única:**
- Forma: Disco lunar com face expressiva (estilo Kawaii + Sci-fi)
- Paleta: Azul neon (#4ECDC4), Roxo profundo (#2D1B4E), Dourado (#FFD93D) para estados especiais
- Acessórios por estado:
  - **sleep**: Gorro de dormir + zzz flutuantes
  - **idle**: Sorriso suave + brilho sutil
  - **thinking**: Óculos de nerd aparecem + luz de lâmpada acima
  - **working**: Fones de ouvido + linhas de código flutuando
  - **error**: Expressão triste + lágrima única + tom avermelhado

---

## 2. 🌀 CSS AVANÇADO — ANIMAÇÕES ORGÂNICAS

```css
/* ===== CONTAINER PRINCIPAL ===== */
.luna-mascot-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 120px;
  height: 120px;
  z-index: 9999;
  cursor: pointer;
  filter: drop-shadow(0 8px 32px rgba(78, 205, 196, 0.3));
  transition: filter 0.4s ease;
}

.luna-mascot-container:hover {
  filter: drop-shadow(0 12px 40px rgba(78, 205, 196, 0.5));
}

/* ===== RESPIRAÇÃO ORGÂNICA (Idle) ===== */
@keyframes luna-breathe {
  0%, 100% { transform: scale(1) translateY(0); }
  25% { transform: scale(1.02) translateY(-2px); }
  50% { transform: scale(1.01) translateY(-1px); }
  75% { transform: scale(1.03) translateY(-3px); }
}

.luna-body {
  animation: luna-breathe 4s ease-in-out infinite;
  transform-origin: center bottom;
}

/* ===== FLUTUAÇÃO (todos os estados, intensidade varia) ===== */
@keyframes luna-float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  33% { transform: translateY(-6px) rotate(1deg); }
  66% { transform: translateY(-3px) rotate(-0.5deg); }
}

.luna-mascot-container[data-state="idle"] .luna-body {
  animation: luna-breathe 4s ease-in-out infinite, luna-float 6s ease-in-out infinite;
}

.luna-mascot-container[data-state="thinking"] .luna-body {
  animation: luna-float 3s ease-in-out infinite; /* Mais agitado */
}

.luna-mascot-container[data-state="working"] .luna-body {
  animation: luna-float 2s ease-in-out infinite; /* Muito agitado */
}

/* ===== GLOW DINÂMICO POR ESTADO ===== */
.luna-mascot-container::before {
  content: '';
  position: absolute;
  inset: -20px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--glow-color, rgba(78, 205, 196, 0.2)) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.6s ease, background 0.6s ease;
  pointer-events: none;
  z-index: -1;
}

.luna-mascot-container[data-state="idle"]::before {
  --glow-color: rgba(78, 205, 196, 0.2);
  opacity: 1;
  animation: glow-pulse 3s ease-in-out infinite;
}

.luna-mascot-container[data-state="thinking"]::before {
  --glow-color: rgba(255, 217, 61, 0.3);
  opacity: 1;
  animation: glow-pulse 1.5s ease-in-out infinite;
}

.luna-mascot-container[data-state="working"]::before {
  --glow-color: rgba(155, 89, 182, 0.25);
  opacity: 1;
  animation: glow-pulse 0.8s ease-in-out infinite;
}

.luna-mascot-container[data-state="sleep"]::before {
  --glow-color: rgba(100, 149, 237, 0.15);
  opacity: 0.5;
}

.luna-mascot-container[data-state="error"]::before {
  --glow-color: rgba(231, 76, 60, 0.3);
  opacity: 1;
  animation: glow-pulse 0.5s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.1); opacity: 1; }
}

/* ===== TRANSIZÃO DE COR DO CORPO ===== */
.luna-face {
  transition: fill 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.luna-mascot-container[data-state="idle"] .luna-face { fill: #4ECDC4; }
.luna-mascot-container[data-state="thinking"] .luna-face { fill: #FFD93D; }
.luna-mascot-container[data-state="working"] .luna-face { fill: #9B59B6; }
.luna-mascot-container[data-state="sleep"] .luna-face { fill: #5D8AA8; }
.luna-mascot-container[data-state="error"] .luna-face { fill: #E74C3C; }

/* ===== ACESSÓRIOS COM ENTRADA/SAÍDA SUAVE ===== */
.luna-accessory {
  opacity: 0;
  transform: scale(0) translateY(10px);
  transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  transform-origin: center;
}

.luna-mascot-container[data-state="sleep"] .luna-accessory-sleepcap { opacity: 1; transform: scale(1) translateY(0); }
.luna-mascot-container[data-state="thinking"] .luna-accessory-glasses { opacity: 1; transform: scale(1) translateY(0); }
.luna-mascot-container[data-state="working"] .luna-accessory-headphones { opacity: 1; transform: scale(1) translateY(0); }
.luna-mascot-container[data-state="error"] .luna-accessory-tear { opacity: 1; transform: scale(1) translateY(0); }

/* ===== EXPRESSÕES FACIAIS ===== */
.luna-mouth {
  transition: d 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Boca sorridente (idle) */
.luna-mascot-container[data-state="idle"] .luna-mouth {
  d: path("M 45 65 Q 60 75 75 65");
}

/* Boca pensativa (thinking) */
.luna-mascot-container[data-state="thinking"] .luna-mouth {
  d: path("M 50 70 Q 60 68 70 70");
}

/* Boca focada (working) */
.luna-mascot-container[data-state="working"] .luna-mouth {
  d: path("M 52 70 L 68 70");
}

/* Boca dormindo (sleep) */
.luna-mascot-container[data-state="sleep"] .luna-mouth {
  d: path("M 55 72 Q 60 68 65 72 Q 60 76 55 72");
}

/* Boca triste (error) */
.luna-mascot-container[data-state="error"] .luna-mouth {
  d: path("M 48 72 Q 60 65 72 72");
}

/* ===== OLHOS COM EXPRESSÃO ===== */
.luna-eye {
  transition: ry 0.3s ease, rx 0.3s ease;
}

.luna-mascot-container[data-state="sleep"] .luna-eye {
  ry: 1; /* Olhos fechados */
  rx: 8;
}

.luna-mascot-container[data-state="thinking"] .luna-eye {
  rx: 7; /* Olhos mais arregalados */
  ry: 9;
}

.luna-mascot-container[data-state="error"] .luna-eye {
  ry: 6; /* Olhos tristes */
  rx: 6;
}

/* ===== PISCAR MELHORADO ===== */
@keyframes luna-blink {
  0%, 90%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.1); }
}

.luna-eye-group {
  animation: luna-blink 4s ease-in-out infinite;
  transform-origin: center;
}

.luna-mascot-container[data-state="sleep"] .luna-eye-group {
  animation: none; /* Não pisca quando dorme */
}

/* ===== HOVER INTERATIVO ===== */
.luna-mascot-container:hover .luna-body {
  animation: luna-excited 0.6s ease-in-out;
}

@keyframes luna-excited {
  0%, 100% { transform: scale(1) rotate(0deg); }
  25% { transform: scale(1.1) rotate(-5deg); }
  50% { transform: scale(1.15) rotate(5deg); }
  75% { transform: scale(1.1) rotate(-3deg); }
}

/* ===== CLIQUE (EFEITO DE ONDA) ===== */
.luna-mascot-container:active .luna-body {
  transform: scale(0.95);
}

.luna-ripple {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(78, 205, 196, 0.5);
  opacity: 0;
  pointer-events: none;
}

.luna-mascot-container.clicked .luna-ripple {
  animation: ripple-out 0.6s ease-out;
}

@keyframes ripple-out {
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(1.5); opacity: 0; }
}

/* ===== SPEECH BUBBLE APRIMORADO ===== */
.luna-speech-bubble {
  position: absolute;
  bottom: 130px;
  right: 0;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(78, 205, 196, 0.3);
  border-radius: 16px 16px 4px 16px;
  padding: 12px 16px;
  max-width: 220px;
  color: #fff;
  font-size: 13px;
  font-family: 'Inter', system-ui, sans-serif;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(78, 205, 196, 0.1);
  opacity: 0;
  transform: translateY(10px) scale(0.95);
  transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  pointer-events: none;
}

.luna-speech-bubble.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.luna-speech-bubble::after {
  content: '';
  position: absolute;
  bottom: -8px;
  right: 20px;
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid #16213e;
}

/* ===== INDICADOR DE ESTADO (MINI DOT) ===== */
.luna-status-dot {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #0f0f1e;
  transition: background-color 0.4s ease, box-shadow 0.4s ease;
}

.luna-mascot-container[data-state="idle"] .luna-status-dot {
  background: #4ECDC4;
  box-shadow: 0 0 8px rgba(78, 205, 196, 0.6);
}

.luna-mascot-container[data-state="thinking"] .luna-status-dot {
  background: #FFD93D;
  box-shadow: 0 0 8px rgba(255, 217, 61, 0.6);
  animation: status-blink 1s ease-in-out infinite;
}

.luna-mascot-container[data-state="working"] .luna-status-dot {
  background: #9B59B6;
  box-shadow: 0 0 8px rgba(155, 89, 182, 0.6);
  animation: status-blink 0.5s ease-in-out infinite;
}

.luna-mascot-container[data-state="sleep"] .luna-status-dot {
  background: #5D8AA8;
  box-shadow: none;
}

.luna-mascot-container[data-state="error"] .luna-status-dot {
  background: #E74C3C;
  box-shadow: 0 0 8px rgba(231, 76, 60, 0.6);
}

@keyframes status-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

---

## 3. 🎭 SVG COMPLETO — LUNA v2.0

```svg
<svg viewBox="0 0 120 120" class="luna-svg" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Gradiente do corpo -->
    <radialGradient id="luna-body-gradient" cx="40%" cy="30%" r="60%">
      <stop offset="0%" stop-color="#6EE7D8" class="luna-gradient-light"/>
      <stop offset="50%" stop-color="#4ECDC4" class="luna-gradient-mid"/>
      <stop offset="100%" stop-color="#2A9D8F" class="luna-gradient-dark"/>
    </radialGradient>
    
    <!-- Gradiente das bochechas -->
    <radialGradient id="luna-blush" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FF6B9D" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#FF6B9D" stop-opacity="0"/>
    </radialGradient>
    
    <!-- Filtro de brilho -->
    <filter id="luna-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    
    <!-- Clip path para pupilas -->
    <clipPath id="eye-clip-left">
      <ellipse cx="42" cy="52" rx="10" ry="12"/>
    </clipPath>
    <clipPath id="eye-clip-right">
      <ellipse cx="78" cy="52" rx="10" ry="12"/>
    </clipPath>
  </defs>
  
  <!-- Onda de clique -->
  <circle class="luna-ripple" cx="60" cy="60" r="55" fill="none"/>
  
  <!-- Grupo do corpo com animação -->
  <g class="luna-body">
    <!-- Corpo principal (lua) -->
    <circle cx="60" cy="60" r="50" fill="url(#luna-body-gradient)" class="luna-face"/>
    
    <!-- Textura de cratera sutil -->
    <circle cx="35" cy="40" r="4" fill="rgba(0,0,0,0.06)"/>
    <circle cx="80" cy="35" r="3" fill="rgba(0,0,0,0.05)"/>
    <circle cx="70" cy="75" r="5" fill="rgba(0,0,0,0.04)"/>
    <circle cx="40" cy="80" r="3" fill="rgba(0,0,0,0.05)"/>
    
    <!-- Brilho de reflexo -->
    <ellipse cx="45" cy="38" rx="12" ry="8" fill="rgba(255,255,255,0.2)" transform="rotate(-20 45 38)"/>
    
    <!-- Bochechas -->
    <circle cx="32" cy="62" r="8" fill="url(#luna-blush)"/>
    <circle cx="88" cy="62" r="8" fill="url(#luna-blush)"/>
    
    <!-- Olhos -->
    <g class="luna-eye-group">
      <!-- Olho esquerdo -->
      <g clip-path="url(#eye-clip-left)">
        <ellipse cx="42" cy="52" rx="10" ry="12" fill="#1a1a2e" class="luna-eye"/>
        <circle class="luna-pupil-left" cx="42" cy="52" r="5" fill="#0f0f1e"/>
        <circle class="luna-pupil-highlight-left" cx="44" cy="50" r="2.5" fill="white" opacity="0.8"/>
        <circle cx="40" cy="54" r="1" fill="white" opacity="0.4"/>
      </g>
      
      <!-- Olho direito -->
      <g clip-path="url(#eye-clip-right)">
        <ellipse cx="78" cy="52" rx="10" ry="12" fill="#1a1a2e" class="luna-eye"/>
        <circle class="luna-pupil-right" cx="78" cy="52" r="5" fill="#0f0f1e"/>
        <circle class="luna-pupil-highlight-right" cx="80" cy="50" r="2.5" fill="white" opacity="0.8"/>
        <circle cx="76" cy="54" r="1" fill="white" opacity="0.4"/>
      </g>
    </g>
    
    <!-- Boca -->
    <path class="luna-mouth" d="M 45 65 Q 60 75 75 65" stroke="#1a1a2e" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    
    <!-- ===== ACESSÓRIOS ===== -->
    
    <!-- Gorro de dormir (sleep) -->
    <g class="luna-accessory luna-accessory-sleepcap">
      <path d="M 35 25 Q 60 5 85 25" fill="#5D8AA8" stroke="#4A708B" stroke-width="2"/>
      <circle cx="60" cy="8" r="6" fill="#FFD93D"/>
      <circle cx="60" cy="8" r="3" fill="#FFA500"/>
    </g>
    
    <!-- Óculos (thinking) -->
    <g class="luna-accessory luna-accessory-glasses">
      <circle cx="42" cy="52" r="14" fill="none" stroke="#333" stroke-width="2.5" opacity="0.8"/>
      <circle cx="78" cy="52" r="14" fill="none" stroke="#333" stroke-width="2.5" opacity="0.8"/>
      <line x1="56" y1="52" x2="64" y2="52" stroke="#333" stroke-width="2" opacity="0.8"/>
      <line x1="28" y1="52" x2="20" y2="48" stroke="#333" stroke-width="2" opacity="0.6"/>
      <line x1="92" y1="52" x2="100" y2="48" stroke="#333" stroke-width="2" opacity="0.6"/>
      <!-- Brilho nos óculos -->
      <line x1="36" y1="46" x2="40" y2="50" stroke="white" stroke-width="1.5" opacity="0.5"/>
      <line x1="72" y1="46" x2="76" y2="50" stroke="white" stroke-width="1.5" opacity="0.5"/>
    </g>
    
    <!-- Fones (working) -->
    <g class="luna-accessory luna-accessory-headphones">
      <path d="M 20 55 Q 20 20 60 15 Q 100 20 100 55" fill="none" stroke="#333" stroke-width="3"/>
      <rect x="15" y="50" width="12" height="18" rx="4" fill="#2c3e50"/>
      <rect x="93" y="50" width="12" height="18" rx="4" fill="#2c3e50"/>
      <!-- LED dos fones -->
      <circle cx="21" cy="58" r="2" fill="#4ECDC4">
        <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite"/>
      </circle>
      <circle cx="99" cy="58" r="2" fill="#4ECDC4">
        <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite"/>
      </circle>
    </g>
    
    <!-- Lágrima (error) -->
    <g class="luna-accessory luna-accessory-tear">
      <path d="M 85 58 Q 88 65 85 72 Q 82 65 85 58" fill="#4ECDC4" opacity="0.7">
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,8; 0,0" dur="2s" repeatCount="indefinite"/>
      </path>
    </g>
  </g>
  
  <!-- Status dot -->
  <circle class="luna-status-dot" cx="105" cy="15" r="6"/>
</svg>
```

---

## 4. ⚡ JAVASCRIPT — COMPORTAMENTOS INTERATIVOS

```javascript
class LunaMascotV2 {
  constructor(container) {
    this.container = container;
    this.svg = container.querySelector('.luna-svg');
    this.pupilLeft = container.querySelector('.luna-pupil-left');
    this.pupilRight = container.querySelector('.luna-pupil-right');
    this.highlightLeft = container.querySelector('.luna-pupil-highlight-left');
    this.highlightRight = container.querySelector('.luna-pupil-highlight-right');
    this.bubble = container.querySelector('.luna-speech-bubble');
    
    this.currentState = 'idle';
    this.mouseX = 0;
    this.mouseY = 0;
    this.isHovering = false;
    
    this.init();
  }
  
  init() {
    this.setupEyeTracking();
    this.setupHoverEffects();
    this.setupClickEffects();
    this.setupParticles();
    this.startIdleBehaviors();
  }
  
  // ===== EYE TRACKING MELHORADO =====
  setupEyeTracking() {
    document.addEventListener('mousemove', (e) => {
      const rect = this.container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Ângulo e distância
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      const distance = Math.min(
        Math.hypot(e.clientX - centerX, e.clientY - centerY) / 20,
        4 // Limite máximo de movimento
      );
      
      // Movimento suave das pupilas
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      
      this.pupilLeft.style.transform = `translate(${x}px, ${y}px)`;
      this.pupilRight.style.transform = `translate(${x}px, ${y}px)`;
      
      // Highlights movem um pouco menos (efeito de profundidade)
      this.highlightLeft.style.transform = `translate(${x * 0.5}px, ${y * 0.5}px)`;
      this.highlightRight.style.transform = `translate(${x * 0.5}px, ${y * 0.5}px)`;
    });
  }
  
  // ===== HOVER EFFECTS =====
  setupHoverEffects() {
    this.container.addEventListener('mouseenter', () => {
      this.isHovering = true;
      this.showBubble('Oi! Precisa de ajuda? 👋');
      this.spawnHeartParticles();
    });
    
    this.container.addEventListener('mouseleave', () => {
      this.isHovering = false;
      this.hideBubble();
    });
  }
  
  // ===== CLICK EFFECTS =====
  setupClickEffects() {
    this.container.addEventListener('click', (e) => {
      // Efeito de onda
      this.container.classList.add('clicked');
      setTimeout(() => this.container.classList.remove('clicked'), 600);
      
      // Reação emocional aleatória
      const reactions = [
        'Hehe! Isso faz cócegas! 😄',
        'Opa! Cuidado com a lua! 🌙',
        'Você é muito curioso! 🤔',
        'Pronta para ajudar! 💪',
        'Ei! Estou trabalhando aqui! 😤'
      ];
      this.showBubble(reactions[Math.floor(Math.random() * reactions.length)]);
      
      // Partículas de estrela
      this.spawnStarParticles(e.clientX, e.clientY);
      
      // Pequeno pulo
      this.jump();
    });
  }
  
  jump() {
    const body = this.container.querySelector('.luna-body');
    body.style.animation = 'none';
    body.offsetHeight; // Trigger reflow
    body.style.animation = 'luna-excited 0.6s ease-in-out';
    setTimeout(() => {
      body.style.animation = '';
    }, 600);
  }
  
  // ===== SISTEMA DE PARTÍCULAS =====
  setupParticles() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:-30px;pointer-events:none;z-index:-1;';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getBoundingClientRect();
    this.canvas.width = 180;
    this.canvas.height = 180;
    this.particles = [];
    this.animateParticles();
  }
  
  animateParticles() {
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, 180, 180);
    
    // Spawn particles baseado no estado
    if (this.currentState === 'sleep' && Math.random() < 0.03) {
      this.particles.push(this.createZzzParticle());
    } else if (this.currentState === 'thinking' && Math.random() < 0.05) {
      this.particles.push(this.createSparkParticle());
    } else if (this.currentState === 'working' && Math.random() < 0.08) {
      this.particles.push(this.createCodeParticle());
    }
    
    // Update e draw
    this.particles = this.particles.filter(p => {
      p.update();
      p.draw(ctx);
      return p.life > 0;
    });
    
    requestAnimationFrame(() => this.animateParticles());
  }
  
  createZzzParticle() {
    return {
      x: 90 + (Math.random() - 0.5) * 40,
      y: 60,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -0.5 - Math.random() * 0.5,
      life: 1,
      size: 12,
      text: 'Z',
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.008;
        this.size += 0.1;
      },
      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.font = `${this.size}px sans-serif`;
        ctx.fillStyle = '#5D8AA8';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
      }
    };
  }
  
  createSparkParticle() {
    return {
      x: 90,
      y: 30,
      vx: (Math.random() - 0.5) * 2,
      vy: -1 - Math.random(),
      life: 1,
      size: 2 + Math.random() * 3,
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.02;
      },
      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = '#FFD93D';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        // Glow
        ctx.shadowColor = '#FFD93D';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
      }
    };
  }
  
  createCodeParticle() {
    const symbols = ['{ }', '</>', '01', '++', '=>'];
    return {
      x: 90 + (Math.random() - 0.5) * 60,
      y: 90,
      vy: -0.3 - Math.random() * 0.5,
      life: 1,
      size: 10,
      text: symbols[Math.floor(Math.random() * symbols.length)],
      update() {
        this.y += this.vy;
        this.life -= 0.01;
      },
      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life * 0.5;
        ctx.font = '10px monospace';
        ctx.fillStyle = '#9B59B6';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
      }
    };
  }
  
  spawnHeartParticles() {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.particles.push({
          x: 90,
          y: 60,
          vx: (Math.random() - 0.5) * 3,
          vy: -2 - Math.random() * 2,
          life: 1,
          size: 8 + Math.random() * 8,
          update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.05; // Gravidade
            this.life -= 0.015;
          },
          draw(ctx) {
            ctx.save();
            ctx.globalAlpha = this.life;
            ctx.fillStyle = '#FF6B9D';
            ctx.font = `${this.size}px sans-serif`;
            ctx.fillText('❤', this.x, this.y);
            ctx.restore();
          }
        });
      }, i * 100);
    }
  }
  
  spawnStarParticles(x, y) {
    const rect = this.container.getBoundingClientRect();
    const localX = x - rect.left + 30;
    const localY = y - rect.top + 30;
    
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 / 8) * i;
      this.particles.push({
        x: localX,
        y: localY,
        vx: Math.cos(angle) * 3,
        vy: Math.sin(angle) * 3,
        life: 1,
        size: 3 + Math.random() * 3,
        update() {
          this.x += this.vx;
          this.y += this.vy;
          this.vx *= 0.95;
          this.vy *= 0.95;
          this.life -= 0.02;
        },
        draw(ctx) {
          ctx.save();
          ctx.globalAlpha = this.life;
          ctx.fillStyle = '#FFD93D';
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }
  }
  
  // ===== SPEECH BUBBLE =====
  showBubble(text) {
    this.bubble.textContent = text;
    this.bubble.classList.add('visible');
    
    if (this.bubbleTimeout) clearTimeout(this.bubbleTimeout);
    this.bubbleTimeout = setTimeout(() => this.hideBubble(), 4000);
  }
  
  hideBubble() {
    this.bubble.classList.remove('visible');
  }
  
  // ===== STATE MANAGEMENT =====
  setState(newState) {
    if (this.currentState === newState) return;
    
    const oldState = this.currentState;
    this.currentState = newState;
    this.container.setAttribute('data-state', newState);
    
    // Mensagens por estado
    const messages = {
      idle: ['Pronta para ajudar! ✨', 'O que precisa?', 'Luna online! 🌙'],
      thinking: ['Hmm... deixa eu pensar... 🤔', 'Processando... ⚡', 'Analisando... 🔍'],
      working: ['Executando! 💪', 'Trabalhando nisso... 🛠️', 'Quase pronto! ⏳'],
      sleep: ['Zzz... descansando... 😴', 'Modo standby... 💤'],
      error: ['Ops! Algo deu errado... 😰', 'Vamos tentar de novo? 🤞']
    };
    
    const msgs = messages[newState] || messages.idle;
    this.showBubble(msgs[Math.floor(Math.random() * msgs.length)]);
    
    // Efeito de transição
    this.transitionEffect(oldState, newState);
  }
  
  transitionEffect(from, to) {
    // Flash sutil no container
    this.container.style.filter = 'brightness(1.3)';
    setTimeout(() => {
      this.container.style.filter = '';
    }, 200);
  }
  
  // ===== IDLE BEHAVIORS =====
  startIdleBehaviors() {
    // Olhar para direções aleatórias ocasionalmente
    setInterval(() => {
      if (this.currentState === 'idle' && !this.isHovering) {
        const randomAngle = Math.random() * Math.PI * 2;
        const x = Math.cos(randomAngle) * 2;
        const y = Math.sin(randomAngle) * 2;
        
        this.pupilLeft.style.transition = 'transform 0.5s ease';
        this.pupilRight.style.transition = 'transform 0.5s ease';
        this.pupilLeft.style.transform = `translate(${x}px, ${y}px)`;
        this.pupilRight.style.transform = `translate(${x}px, ${y}px)`;
        
        setTimeout(() => {
          this.pupilLeft.style.transition = '';
          this.pupilRight.style.transition = '';
        }, 500);
      }
    }, 5000);
    
    // Piscar extra ocasionalmente
    setInterval(() => {
      if (Math.random() < 0.3 && this.currentState !== 'sleep') {
        const eyeGroup = this.container.querySelector('.luna-eye-group');
        eyeGroup.style.animation = 'none';
        eyeGroup.offsetHeight;
        eyeGroup.style.animation = 'luna-blink 0.3s ease-in-out';
      }
    }, 3000);
  }
}

// Uso:
// const luna = new LunaMascotV2(document.querySelector('.luna-mascot-container'));
// luna.setState('thinking');
```

---

## 5. 🚀 ROADMAP PARA RIVE (FUTURO)

Quando migrar para Rive, estruture assim:

```
Luna.riv
├── Artboard: "Main"
│   ├── State Machine: "LunaBehavior"
│   │   ├── Input: "state" (number: 0=idle, 1=thinking, 2=working, 3=sleep, 4=error)
│   │   ├── Input: "mouseX" (number)
│   │   ├── Input: "mouseY" (number)
│   │   ├── Input: "isHovered" (boolean)
│   │   ├── Input: "isClicked" (trigger)
│   │   └── Input: "talking" (boolean)
│   │
│   ├── Animations:
│   │   ├── "idle_breathe" (loop, 4s)
│   │   ├── "idle_float" (loop, 6s)
│   │   ├── "thinking_scratch" (one-shot)
│   │   ├── "working_type" (loop, 1s)
│   │   ├── "sleep_snore" (loop, 3s)
│   │   ├── "error_cry" (one-shot)
│   │   ├── "transition_flash" (one-shot, 0.3s)
│   │   ├── "eye_track" (blend, driven by mouseX/Y)
│   │   ├── "blink" (one-shot, 0.2s)
│   │   └── "excited_jump" (one-shot, 0.6s)
│   │
│   └── Layers:
│       ├── "body" (forma lunar com gradiente)
│       ├── "face" (olhos, boca — com constraints para morphing)
│       ├── "accessories" (gorro, óculos, fones — com visibility driven by state)
│       ├── "particles" (sistema de partículas nativo do Rive)
│       └── "glow" (efeito de bloom)
```

**Vantagens do Rive:**
- Animações 60fps com interpolação suave
- State machine visual (sem código complexo)
- Partículas nativas (mais performáticas)
- Interactive rigging (ossos para deformação orgânica)
- Runtime leve (~50KB)

**Integração com seu engine atual:**
```javascript
// Quando usar Rive no futuro, substitua apenas o render:
// SVG → Canvas (Rive)
// Mantenha toda a lógica de state machine, SSE, eye tracking
// O Rive recebe apenas: state, mouseX, mouseY, triggers
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

1. ✅ Copiar CSS para seu arquivo de estilos do mascote
2. ✅ Substituir o SVG atual pelo novo SVG completo
3. ✅ Substituir a classe JavaScript pelo `LunaMascotV2`
4. ✅ Ajustar seletores se sua estrutura HTML for diferente
5. ✅ Testar cada estado: idle → thinking → working → sleep → error
6. ✅ Verificar responsividade em mobile (reduzir para 80px em telas pequenas)
7. 🔄 Futuro: Exportar animações para Rive quando o design estiver finalizado

---

**Resultado esperado:** Um mascote que respira, flutua, reage ao mouse, pisca de forma orgânica, muda de cor suavemente por estado, mostra acessórios animados, emite partículas contextuais, e tem personalidade própria ao interagir. **Icnico e memorável.** 🌙✨

Quer que eu gere os arquivos completos no teu PC para testar?