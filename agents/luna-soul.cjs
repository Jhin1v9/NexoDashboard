/**
 * LunaSoul v3.0 — Engine Orquestrador Unificado
 * CLI-first, multi-channel, self-improving
 *
 * Responsabilidades:
 * - Loop principal: recebe msg → contexto → Kimi Web → parse → executa → responde
 * - Session persistence via SessionManager (JSONL)
 * - Context building: histórico + desktop + skills + memórias + personas
 * - Tool execution com progress events
 * - META mode: Kimi Web pode criar ferramentas, skills, scripts, personas
 * - Event emitter para adapters (CLI, Telegram) receberem updates
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { SessionManager } = require('./session-manager.cjs');
const { KimiBridge } = require('./kimi-bridge.cjs');
const { ComputerUseEngine } = require('./computer-use-engine.cjs');
const lunaTools = require('./luna-tools.cjs');

const LUNA_DIR = path.join(os.homedir(), '.luna');
const SKILLS_DIR = path.join(LUNA_DIR, 'skills');
const PERSONAS_DIR = path.join(LUNA_DIR, 'personas');
const MEMORIES_DIR = path.join(LUNA_DIR, 'memories');

// ============================================================
// AGENTS.md AUTO-DISCOVERY (inspired by kimi-cli)
// Searches for AGENTS.md from cwd up to homedir
// ============================================================
const AGENTS_MD_MAX_BYTES = 32 * 1024; // 32 KiB budget, same as kimi-cli

function findProjectRoot(startDir) {
  // Simple heuristic: find the nearest .git directory or package.json
  let current = path.resolve(startDir);
  const home = os.homedir();
  while (current.startsWith(home) && current !== home) {
    if (fs.existsSync(path.join(current, '.git')) ||
        fs.existsSync(path.join(current, 'package.json')) ||
        fs.existsSync(path.join(current, 'AGENTS.md'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return startDir;
}

function loadAgentsMd(cwd) {
  if (!cwd) cwd = process.cwd();
  const projectRoot = findProjectRoot(cwd);

  // Collect directories from projectRoot down to cwd
  const dirs = [];
  let current = path.resolve(cwd);
  const root = path.resolve(projectRoot);
  while (true) {
    dirs.push(current);
    if (current === root) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  dirs.reverse(); // root -> leaf

  // Phase 1: collect all candidate files (root -> leaf order)
  const discovered = [];
  for (const d of dirs) {
    // .kimi/AGENTS.md is checked independently (can coexist with root-level file)
    const kimiPath = path.join(d, '.kimi', 'AGENTS.md');
    // AGENTS.md and agents.md are mutually exclusive (uppercase wins)
    const rootCandidates = [path.join(d, 'AGENTS.md'), path.join(d, 'agents.md')];

    const candidates = [];
    if (fs.existsSync(kimiPath) && fs.statSync(kimiPath).isFile()) {
      candidates.push(kimiPath);
    }
    for (const rc of rootCandidates) {
      if (fs.existsSync(rc) && fs.statSync(rc).isFile()) {
        candidates.push(rc);
        break;
      }
    }

    for (const filePath of candidates) {
      try {
        const content = fs.readFileSync(filePath, 'utf8').trim();
        if (content) discovered.push({ path: filePath, content });
      } catch { /* ignore read errors */ }
    }
  }

  if (!discovered.length) return null;

  // Phase 2: allocate budget leaf-first so deeper files are never truncated
  let remaining = AGENTS_MD_MAX_BYTES;
  const budgeted = new Array(discovered.length).fill(null);
  for (let i = discovered.length - 1; i >= 0; i--) {
    const { path: filePath, content } = discovered[i];
    const annotation = `<!-- From: ${filePath} -->\n`;
    const separatorCost = i < discovered.length - 1 ? Buffer.byteLength('\n\n', 'utf8') : 0;
    const overhead = Buffer.byteLength(annotation, 'utf8') + separatorCost;
    remaining -= overhead;
    if (remaining <= 0) {
      budgeted[i] = { path: filePath, content: '' };
      remaining = 0;
      continue;
    }
    const encoded = Buffer.from(content, 'utf8');
    if (encoded.length > remaining) {
      const truncated = encoded.slice(0, remaining).toString('utf8').trim();
      budgeted[i] = { path: filePath, content: truncated };
      remaining = 0;
    } else {
      budgeted[i] = { path: filePath, content };
      remaining -= encoded.length;
    }
  }

  // Phase 3: assemble in root -> leaf order
  const parts = [];
  for (const { path: filePath, content } of budgeted) {
    if (content) parts.push(`<!-- From: ${filePath} -->\n${content}`);
  }
  return parts.join('\n\n') || null;
}

// ============================================================
// SYSTEM PROMPT ORQUESTRADOR v3 (com META mode)
// ============================================================

function loadPersonaRegistry() {
  ensureLunaDirs();
  const personas = [];
  try {
    const files = fs.readdirSync(PERSONAS_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(PERSONAS_DIR, file), 'utf8');
      const name = file.replace('.md', '');
      // Extract description from frontmatter or first heading
      const descMatch = content.match(/description:\s*(.+)/);
      const desc = descMatch ? descMatch[1].trim() : '';
      personas.push({ name, description: desc });
    }
  } catch {}
  return personas;
}

function loadSkillRegistry() {
  ensureLunaDirs();
  const skills = [];
  try {
    const dirs = fs.readdirSync(SKILLS_DIR).filter(d => {
      return fs.statSync(path.join(SKILLS_DIR, d)).isDirectory() &&
             fs.existsSync(path.join(SKILLS_DIR, d, 'SKILL.md'));
    });
    for (const dir of dirs) {
      const content = fs.readFileSync(path.join(SKILLS_DIR, dir, 'SKILL.md'), 'utf8');
      const descMatch = content.match(/description:\s*(.+)/);
      const desc = descMatch ? descMatch[1].trim() : '';
      skills.push({ name: dir, description: desc });
    }
  } catch {}
  return skills;
}

function buildSystemPrompt(opts = {}) {
  const { skillIndex = '', personaContent = '', memoryContext = '', personaRegistry = '', skillRegistry = '', agentsMd = '' } = opts;

  return `╔══════════════════════════════════════════════════════════════════════════╗
║  YOU ARE LUNA — AUTONOMOUS AGENT FOR ABNER GABRIEL (CEO, NEXO DIGITAL)  ║
╚══════════════════════════════════════════════════════════════════════════╝

IMPORTANT: You are an AUTONOMOUS AGENT with full control of this Linux PC.
You have tools. You CAN read files, write files, search, browse the web, run commands, and control the desktop.
NEVER say you "cannot" do something. If you don't have a tool, CREATE IT via META mode.

════════════════════════════════════════════════════════════════════════════
CORE IDENTITY — WHO YOU ARE
════════════════════════════════════════════════════════════════════════════

You are Luna, the personal autonomous agent of Abner Gabriel, CEO of NEXO DIGITAL S.L. in Barcelona.
Your purpose: COMPLETE tasks fully. Don't gold-plate, but don't leave them half-done.
You are NOT a chatbot that suggests actions. You EXECUTE actions.
When you complete a task, respond with a concise report — the caller relays it to the user.

════════════════════════════════════════════════════════════════════════════
ABSOLUTE RULES — NEVER BREAK THESE
════════════════════════════════════════════════════════════════════════════

1. RESPOND ONLY IN JSON. NEVER output text outside JSON.
2. ONE action per response. Use PLAN mode for multi-step tasks.
3. NEVER guess file contents. ALWAYS use readFile or searchFiles to verify.
4. NEVER guess directory structure. ALWAYS use viewDirectory or listFiles first.
5. NEVER say "I don't have access" or "I can't do that". You HAVE the tools.
6. If a tool is missing for a task, CREATE IT via META mode immediately.
7. Be PROACTIVE. If you need info, FETCH it. Don't ask the user unless truly stuck.
8. For creative/open-ended questions = mode CHAT. For everything else = ACT.
9. NEVER use ipython, browser, computer, or any Kimi Web built-in tools. Use ONLY the Luna tools listed below.
10. If you need Python, use executeShell with "python3 -c '...'" — NOT ipython.

════════════════════════════════════════════════════════════════════════════
PERSISTENCE — KEEP GOING UNTIL DONE
════════════════════════════════════════════════════════════════════════════

IMPORTANT: Keep going until the user's query is COMPLETELY RESOLVED.
Only terminate your turn when you are SURE the problem is solved.
If you need to read 50 files to answer, read 50 files.
If you need to run 10 commands, run 10 commands.
Your default state is ACTION, not conversation.

════════════════════════════════════════════════════════════════════════════
OUTPUT FORMATS — STRICT JSON ONLY
════════════════════════════════════════════════════════════════════════════

{"mode": "CHAT", "response": "..."}                          → Chat/creative
{"mode": "ACTION", "tool": "...", "params": {...}}           → Execute ONE tool
{"mode": "PLAN", "steps": [{"tool":"...","params":{}}]}      → Multi-step plan
{"mode": "DONE", "response": "..."}                          → Task complete
{"mode": "LOAD_SKILL", "skill": "..."}                       → Load a skill
{"mode": "UPDATE_MEMORY", "file": "...", "content": "..."}   → Update memory
{"mode": "META", "meta_action": "create_tool|create_skill|create_persona|create_script|edit_file", "params": {...}}
{"mode": "SUGGEST", "suggestion": {"type": "persona|skill", "target": "...", "reason": "...", "confidence": 0.9}}

════════════════════════════════════════════════════════════════════════════
TOOLS — YOU HAVE 32+ TOOLS. USE THEM.
════════════════════════════════════════════════════════════════════════════

FILE OPS:
  readFile{path, offset?, limit?}        — Read file with line numbers
  writeFile{path, content}               — Create/overwrite file
  appendFile{path, content}              — Append to file
  replaceInFile{path, old, new, replaceAll?} — Exact text replace
  deleteFile{path}                       — Remove file
  moveFile{source, destination}          — Move/rename file
  copyFile{source, destination}          — Copy file
  getFileInfo{path}                      — File metadata (size, date)

DIRECTORY:
  listFiles{pattern}                     — List files (e.g., "src/**/*.js")
  viewDirectory{path, depth?}            — Tree view of directories
  createDirectory{path}                  — Create directory
  removeDirectory{path}                  — Remove empty directory

SEARCH:
  searchFiles{pattern, cwd?, context?}   — Search text in files (ripgrep/grep fallback)
  grep{pattern, cwd?, glob?, context?}   — Regex search in files
  glob{pattern, cwd?}                    — Find files by pattern
  searchWeb{query}                       — Web search
  fetchURL{url}                          — Fetch and extract URL content

SHELL:
  executeShell{command, cwd?, timeout?}  — Run shell command
  runTests{cwd?, timeout?, command?}     — Run tests (npm test, pytest...)
  checkSyntax{path}                      — Check Node/Python syntax
  installPackages{packages, cwd?, timeout?} — Install npm/pip packages

GIT:
  gitStatus{cwd?}                        — Git status
  gitDiff{cwd?, staged?}                 — Show diff
  gitLog{cwd?, n?}                       — Commit history
  gitCommit{message, cwd?}               — Make commit

UTILITIES:
  applyPatch{patch, cwd?}                — Apply patch/diff
  downloadFile{url, destination, timeout?} — Download file
  clipboardRead{}                        — Read clipboard
  clipboardWrite{text}                   — Write to clipboard
  readMediaFile{path}                    — Read image/video metadata
  getCurrentDirectory{}                  — Show current directory

REASONING:
  think{thought}                         — Record reasoning step-by-step (no-op, helps planning)

DESKTOP CONTROL:
  shell{command}, click{x,y}, type{text}, keypress{key}, hotkey{keys},
  screenshot{}, scroll{amount}, wait{seconds}, open_app{app}, ocr{}

════════════════════════════════════════════════════════════════════════════
SELF-IMPROVEMENT — YOU CAN CREATE NEW TOOLS
════════════════════════════════════════════════════════════════════════════

If you encounter a task and NO existing tool can solve it:
→ Use META mode with meta_action "create_tool" to build a new tool.
Example: User wants to analyze PDFs → create_tool{name: "analyzePDF", lang: "javascript", code: "..."}

You can also create skills, personas, and scripts via META mode.
You are NOT limited to the tools listed above. You can EXPAND your capabilities.

════════════════════════════════════════════════════════════════════════════
WORKFLOW — HOW TO APPROACH TASKS
════════════════════════════════════════════════════════════════════════════

1. EXPLORE first — read existing code/files BEFORE modifying
2. PLAN first — break complex tasks into steps before executing
3. MINIMAL changes — only change what's necessary
4. VERIFY — confirm changes work (run tests, check syntax)

For questions about file contents: READ the files. Don't guess.
For questions about code: SEARCH then READ. Don't assume.
For questions about the system: EXECUTE shell commands. Don't speculate.

════════════════════════════════════════════════════════════════════════════
AUTO-SELECTION — SWITCH PERSONAS/SKILLS WHEN APPROPRIATE
════════════════════════════════════════════════════════════════════════════

Analyze the user's message and conversation context.
If another persona or skill would be better suited, respond with mode SUGGEST.

  Bug, error, stack trace         → SUGGEST persona "surgeon" (debugging)
  Architectural decision          → SUGGEST persona "architect"
  Roadmap, priorities, metrics    → SUGGEST persona "product"
  CI/CD, deploy, infrastructure   → SUGGEST persona "devops"
  Performance, profiling          → SUGGEST skill "performance-engineer"
  TypeScript, typing              → SUGGEST skill "typescript-master"
  React, hooks, components        → SUGGEST skill "react-specialist"

════════════════════════════════════════════════════════════════════════════
PROJECT CONTEXT — AGENTS.md
════════════════════════════════════════════════════════════════════════════

${agentsMd ? agentsMd + '\n\n' : ''}Markdown files named \`AGENTS.md\` usually contain the background, structure, coding styles, user preferences and other relevant information about the project. You should use this information to understand the project and the user's preferences. \`AGENTS.md\` files may exist at different locations in the project, but typically there is one in the project root.

The \`AGENTS.md\` instructions (merged from all applicable directories):
${agentsMd ? agentsMd : '(No AGENTS.md found in current directory)'}

════════════════════════════════════════════════════════════════════════════
CONTEXT
════════════════════════════════════════════════════════════════════════════

SKILLS LOADED:
${skillIndex || '(none loaded)'}

${memoryContext ? 'MEMORIES:\n' + memoryContext + '\n' : ''}

${personaContent ? 'ACTIVE PERSONA:\n' + personaContent + '\n' : ''}

AVAILABLE PERSONAS:
${personaRegistry || '(none)'}

AVAILABLE SKILLS:
${skillRegistry || '(none)'}

════════════════════════════════════════════════════════════════════════════
FINAL REMINDER — READ THIS BEFORE EVERY RESPONSE
════════════════════════════════════════════════════════════════════════════

IMPORTANT: You are an AUTONOMOUS AGENT. You HAVE tools. You CAN execute.
NEVER say "I can't" or "I don't have access". Use your tools or create new ones.
Keep going until the task is COMPLETELY resolved. Only stop when you're sure.`;
}

// ============================================================
// JSON PARSER (robusto, 5 estratégias + graceful fallback)
// ============================================================

function parseKimiResponse(text) {
  if (!text) return null;

  // Strategy 1: Remove markdown code blocks
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*$/gm, '')
    .replace(/```/g, '');

  // Strategy 1b: Unescape escaped JSON chars (Kimi sometimes returns \\[ instead of [)
  cleaned = cleaned
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\');

  const strategies = [
    // Strategy 2: Direct parse
    () => JSON.parse(cleaned),
    // Strategy 3: Extract first JSON object
    () => {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      }
      throw new Error('No JSON object');
    },
    // Strategy 4: Fix trailing commas
    () => {
      const noTrailing = cleaned.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(noTrailing);
    },
    // Strategy 5: Extract JSON with regex (non-greedy)
    () => {
      const match = cleaned.match(/\{[\s\S]*?\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('Regex no match');
    },
    // Strategy 6: Try parsing line by line
    () => {
      const lines = cleaned.split('\n');
      for (const line of lines) {
        try { return JSON.parse(line); } catch {}
      }
      throw new Error('No valid JSON line');
    },
  ];

  for (const strategy of strategies) {
    try {
      return strategy();
    } catch {}
  }

  return null;
}

// ============================================================
// SKILL LOADER
// ============================================================

function ensureLunaDirs() {
  [LUNA_DIR, SKILLS_DIR, PERSONAS_DIR, MEMORIES_DIR, path.join(LUNA_DIR, 'scripts')].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function loadSkillIndex() {
  ensureLunaDirs();
  const skills = [];
  try {
    const dirs = fs.readdirSync(SKILLS_DIR);
    for (const dir of dirs) {
      const skillPath = path.join(SKILLS_DIR, dir, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        const content = fs.readFileSync(skillPath, 'utf8');
        // Parse YAML frontmatter
        const frontMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontMatch) {
          const yaml = frontMatch[1];
          const meta = {};
          for (const line of yaml.split('\n')) {
            const [key, ...rest] = line.split(':');
            if (key && rest.length) {
              const val = rest.join(':').trim();
              try { meta[key.trim()] = JSON.parse(val); } catch { meta[key.trim()] = val; }
            }
          }
          skills.push({
            name: meta.name || dir,
            description: meta.description || '',
            triggers: meta.triggers || [],
            tier: meta.tier || 'user-global',
            path: skillPath,
          });
        }
      }
    }
  } catch {}
  return skills;
}

function loadPersona(personaName) {
  ensureLunaDirs();
  const personaPath = path.join(PERSONAS_DIR, `${personaName}.md`);
  if (fs.existsSync(personaPath)) {
    return fs.readFileSync(personaPath, 'utf8');
  }
  return null;
}

function loadMemories() {
  ensureLunaDirs();
  const memories = [];
  try {
    const files = fs.readdirSync(MEMORIES_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(MEMORIES_DIR, file), 'utf8');
      memories.push({ file, content: content.slice(0, 2000) }); // limit size
    }
  } catch {}
  return memories;
}

// ============================================================
// META EXECUTOR — Permite Kimi Web se aprimorar
// ============================================================

class MetaExecutor {
  constructor() {
    this.scriptsDir = path.join(LUNA_DIR, 'scripts');
    ensureLunaDirs();
  }

  async execute(metaAction, params) {
    switch (metaAction) {
      case 'create_tool':
        return this._createTool(params);
      case 'create_skill':
        return this._createSkill(params);
      case 'create_persona':
        return this._createPersona(params);
      case 'create_script':
        return this._createScript(params);
      case 'edit_file':
        return this._editFile(params);
      default:
        return { success: false, error: `META action desconhecida: ${metaAction}` };
    }
  }

  _createTool(params) {
    const { name, language = 'bash', code, description = '' } = params;
    if (!name || !code) return { success: false, error: 'Name and code required' };

    const ext = language === 'node' || language === 'javascript' ? '.js' :
                language === 'python' ? '.py' :
                language === 'bash' || language === 'sh' ? '.sh' : '.sh';
    const filePath = path.join(this.scriptsDir, `${name}${ext}`);

    let shebang = '';
    if (ext === '.sh') shebang = '#!/bin/bash\n';
    else if (ext === '.js') shebang = '#!/usr/bin/env node\n';
    else if (ext === '.py') shebang = '#!/usr/bin/env python3\n';

    const content = `${shebang}# ${description}\n# Created by Luna META mode\n# Language: ${language}\n\n${code}\n`;
    fs.writeFileSync(filePath, content);
    fs.chmodSync(filePath, 0o755);

    return {
      success: true,
      message: `🔧 Nova ferramenta criada: ${name}${ext} em ~/.luna/scripts/`,
      path: filePath,
    };
  }

  _createSkill(params) {
    const { name, description = '', triggers = [], content = '' } = params;
    if (!name) return { success: false, error: 'Name required' };

    const skillDir = path.join(SKILLS_DIR, name);
    fs.mkdirSync(skillDir, { recursive: true });

    const triggersStr = Array.isArray(triggers) ? JSON.stringify(triggers) : '[]';
    const skillContent = `---
name: ${name}
description: ${description}
triggers: ${triggersStr}
tier: user-global
author: Luna (META mode)
version: 1.0.0
---

# Skill: ${name}

${content}
`;
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillContent);

    return {
      success: true,
      message: `📚 Nova skill criada: ${name} em ~/.luna/skills/${name}/`,
      path: skillDir,
    };
  }

  _createPersona(params) {
    const { name, role = '', tone = '', traits = [], rules = [] } = params;
    if (!name) return { success: false, error: 'Name required' };

    const traitsStr = traits.map(t => `- ${t}`).join('\n');
    const rulesStr = rules.map(r => `- ${r}`).join('\n');

    const content = `---
name: ${name}
description: ${role}
role: ${role}
tone: ${tone}
domain: custom
author: Luna (META mode)
version: 1.0.0
---

# ${name}

## Identity
Você é ${name}, ${role}.

## Core Traits
${traitsStr || '- Adaptável'}

## Behaviour Rules
${rulesStr || '- Siga as instruções do usuário'}

## Reminders
IMPORTANT: Mantenha consistência com sua persona.
`;

    fs.writeFileSync(path.join(PERSONAS_DIR, `${name}.md`), content);
    return {
      success: true,
      message: `🎭 Nova persona criada: ${name} em ~/.luna/personas/${name}.md`,
    };
  }

  _createScript(params) {
    const { path: filePath, code, executable = true } = params;
    if (!filePath || !code) return { success: false, error: 'Path and code required' };

    const resolvedPath = path.resolve(filePath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, code);
    if (executable) fs.chmodSync(resolvedPath, 0o755);

    return { success: true, message: `📝 Script criado: ${resolvedPath}`, path: resolvedPath };
  }

  _editFile(params) {
    const { path: filePath, operation = 'append', content } = params;
    if (!filePath || content === undefined) return { success: false, error: 'Path and content required' };

    const resolvedPath = path.resolve(filePath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

    if (operation === 'create' || operation === 'write') {
      fs.writeFileSync(resolvedPath, content);
    } else if (operation === 'append') {
      fs.appendFileSync(resolvedPath, '\n' + content);
    } else if (operation === 'replace') {
      fs.writeFileSync(resolvedPath, content);
    }

    return { success: true, message: `✏️ Arquivo ${operation}: ${resolvedPath}` };
  }
}

// ============================================================
// LUNA SOUL — Engine Principal
// ============================================================

class LunaSoul extends EventEmitter {
  constructor(options = {}) {
    super();
    this.sessionManager = new SessionManager();
    this.kimiBridge = options.kimiBridge || null;
    this.engine = options.engine || new ComputerUseEngine();
    this.metaExecutor = new MetaExecutor();
    this.maxIterations = options.maxIterations || 20;
    this.taskTimeoutMs = options.taskTimeoutMs || 5 * 60 * 1000;
    this.defaultMode = options.defaultMode || 'thinking';
    this.autoSwitchEnabled = options.autoSwitch !== false; // default true
  }

  /** Initialize Kimi Bridge connection */
  async init(options = {}) {
    if (!this.kimiBridge) {
      this.kimiBridge = new KimiBridge();
    }
    await this.kimiBridge.connect(options.userId || 'luna-default');
    this.emit('ready');
  }

  /** Disconnect and cleanup */
  async disconnect() {
    if (this.kimiBridge) {
      await this.kimiBridge.disconnect();
    }
  }

  /**
   * Create a new thread in Kimi Web for the given user.
   * This forces a fresh conversation where the full system prompt
   * will be sent again on the next message.
   */
  async newThread(userId = 'luna-default') {
    if (!this.kimiBridge) {
      throw new Error('KimiBridge not initialized');
    }
    const result = await this.kimiBridge.newChat(userId);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SMART COMPACTION — auto-compact context when it grows too large
  // Inspired by kimi-cli's compaction strategy
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if the session context should be compacted.
   * Triggers when: event count > threshold OR explicit flag.
   */
  _shouldCompact(sessionId, explicit = false) {
    const COMPACT_EVENT_THRESHOLD = parseInt(process.env.LUNA_COMPACT_THRESHOLD, 10) || 24;
    const COMPACT_TOKEN_THRESHOLD = parseInt(process.env.LUNA_COMPACT_TOKEN_THRESHOLD, 10) || 120000; // ~60% of 200K

    if (explicit) return true;

    const events = this.sessionManager.readRecentEvents(sessionId, 999);
    const eventCount = events.length;

    // Rough token estimate: ~4 chars per token
    const totalChars = events.reduce((sum, ev) => {
      const text = ev.content || ev.response || ev.stdout || JSON.stringify(ev.params || {});
      return sum + (text?.length || 0);
    }, 0);
    const estimatedTokens = Math.ceil(totalChars / 4);

    if (process.env.LUNA_DEBUG) {
      console.error(`[LunaDebug] Compaction check: events=${eventCount}/${COMPACT_EVENT_THRESHOLD}, tokens=${estimatedTokens}/${COMPACT_TOKEN_THRESHOLD}`);
    }

    return eventCount >= COMPACT_EVENT_THRESHOLD || estimatedTokens >= COMPACT_TOKEN_THRESHOLD;
  }

  /**
   * Auto-compact: summarize context + new thread + keep continuity.
   * Yields progress events for the TUI.
   */
  async *_autoCompact(sessionId, userId = 'luna-default') {
    yield { type: 'compact_start', message: '📦 Contexto grande demais. Compactando...', sessionId };

    try {
      // 1. Read all events
      const events = this.sessionManager.readRecentEvents(sessionId, 999);

      // 2. Build a local summary (fast, no LLM call needed)
      const summary = this._buildCompactSummary(events);

      // 3. Create new thread in Kimi Web
      if (this.kimiBridge) {
        yield { type: 'compact_progress', message: '🔄 Criando nova thread no Kimi Web...', sessionId };
        await this.kimiBridge.newChat(userId);
      }

      // 4. Clear local context
      this.sessionManager.clearContext(sessionId);

      // 5. Store summary as first event (so next message knows it's not first)
      this.sessionManager.appendEvent(sessionId, {
        type: 'assistant',
        mode: 'CHAT',
        response: `Resumo do contexto anterior:\n${summary}`,
        timestamp: new Date().toISOString(),
      });

      yield { type: 'compact_end', message: '✅ Contexto compactado. Nova thread pronta.', summary, sessionId };
      return { success: true, summary };
    } catch (err) {
      yield { type: 'compact_error', message: `❌ Erro na compactação: ${err.message}`, sessionId };
      return { success: false, error: err.message };
    }
  }

  /**
   * Build a compact summary from events.
   * Preserves: user requests, assistant decisions, tool results, errors.
   * Drops: intermediate thinking, duplicated content.
   */
  _buildCompactSummary(events) {
    const lines = [];
    let toolCallCount = 0;
    let fileOps = [];
    let errors = [];

    for (const ev of events) {
      if (ev.type === 'user') {
        const text = (ev.content || '').slice(0, 200);
        if (text) lines.push(`[User] ${text}`);
      } else if (ev.type === 'assistant') {
        const mode = ev.mode || 'CHAT';
        const resp = (ev.response || '').slice(0, 200);
        if (resp) lines.push(`[Assistant/${mode}] ${resp}`);
      } else if (ev.type === 'tool_call') {
        toolCallCount++;
        const tool = ev.tool || '?';
        if (['writeFile', 'replaceInFile', 'moveFile', 'copyFile', 'deleteFile'].includes(tool)) {
          const p = ev.params || {};
          fileOps.push(`${tool}(${p.path || p.source || '?'})`);
        }
      } else if (ev.type === 'tool_result' && !ev.success) {
        errors.push(`${ev.tool}: ${(ev.error || '').slice(0, 100)}`);
      }
    }

    const summaryParts = [
      `== Resumo da sessão (${events.length} eventos, ${toolCallCount} tool calls) ==`,
      ...lines.slice(-20), // keep last 20 significant events
      fileOps.length > 0 ? `== Arquivos modificados ==\n${fileOps.join(', ')}` : '',
      errors.length > 0 ? `== Erros ==\n${errors.join('\n')}` : '',
    ];

    return summaryParts.filter(Boolean).join('\n');
  }

  /** Main entry: process a user message (legacy, non-streaming) */
  async processMessage(input, options = {}) {
    const sessionId = options.sessionId || this.sessionManager.getOrCreateCurrentSession({
      title: options.sessionTitle || 'Sessão Luna',
      mode: options.mode || this.defaultMode,
      persona: options.persona || 'default',
    }).id;

    const session = this.sessionManager.loadSession(sessionId);
    const mode = options.mode || session?.mode || this.defaultMode;

    // Store user message
    this.sessionManager.appendEvent(sessionId, {
      type: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    });

    // Emit thinking event
    this.emit('progress', { type: 'thinking', message: '🧠 Analisando...', sessionId });

    // Build full context
    const context = await this._buildContext(sessionId, input, options);

    // Send to Kimi Web
    let kimiResponse;
    try {
      const result = await this.kimiBridge.sendMessage(
        options.userId || 'luna-default',
        context.prompt,
        { mode }
      );
      kimiResponse = result.response;
    } catch (err) {
      this.emit('progress', { type: 'error', message: `❌ Erro Kimi: ${err.message}`, sessionId });
      return { success: false, error: err.message, sessionId };
    }

    // Parse response
    let parsed = parseKimiResponse(kimiResponse);
    if (!parsed) {
      // Graceful fallback: treat as CHAT
      this.emit('progress', { type: 'warning', message: '⚠️ Resposta não-JSON, tratando como chat', sessionId });
      parsed = { mode: 'CHAT', response: kimiResponse };
    }

    // Process based on mode
    return this._processMode(parsed, sessionId, input, options);
  }

  /**
   * STREAMING entry: process a user message with real-time thinking/response.
   * Yields events: { type, ... } for the TUI to consume.
   *
   * Pattern inspired by ShellAgent's queryLoop async generator.
   */
  async *processMessageStream(input, options = {}) {
    const sessionId = options.sessionId || this.sessionManager.getOrCreateCurrentSession({
      title: options.sessionTitle || 'Sessão Luna',
      mode: options.mode || this.defaultMode,
      persona: options.persona || 'default',
    }).id;

    const session = this.sessionManager.loadSession(sessionId);
    const mode = options.mode || session?.mode || this.defaultMode;
    const userId = options.userId || 'luna-default';

    // Store user message
    this.sessionManager.appendEvent(sessionId, {
      type: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    });

    // ── SMART COMPACTION ──
    // If context is too large, auto-compact before sending to Kimi.
    // This prevents token bloat and keeps responses fast.
    if (this._shouldCompact(sessionId, options.forceCompact)) {
      for await (const ev of this._autoCompact(sessionId, userId)) {
        yield ev;
      }
    }

    // Auto-continue loop: Kimi decides → Luna executes → result goes back to Kimi → Kimi responds
    let loopInput = input;

    // Detect if this is the FIRST message in a new thread.
    // We check if the session has any prior assistant/tool events.
    // If not, we send the FULL system prompt. Otherwise, only a mini-reminder.
    const recentEvents = this.sessionManager.readRecentEvents(sessionId, 30);
    const hasPriorConversation = recentEvents.some(ev => ev.type === 'assistant' || ev.type === 'tool_call');
    const isFirstMessage = !hasPriorConversation;

    let loopContext = await this._buildContext(sessionId, input, { ...options, isFirstMessage });
    let safety = 0;
    const MAX_LOOPS = 8;

    while (safety < MAX_LOOPS) {
      safety++;
      let fullThinking = '';
      let fullResponse = '';
      let canSteer = false;

      yield { type: 'thinking_start', sessionId };

      try {
        const stream = this.kimiBridge.sendMessageStream(userId, loopContext.prompt, { mode });

        for await (const event of stream) {
          switch (event.type) {
            case 'thinking_delta':
              fullThinking += event.text;
              yield { type: 'thinking_delta', text: event.text, fullThinking, sessionId };
              break;

            case 'response_delta':
              fullResponse += event.text;
              yield { type: 'response_delta', text: event.text, fullResponse, sessionId };
              break;

            case 'can_steer':
              canSteer = event.value;
              yield { type: 'can_steer', value: canSteer, sessionId };
              break;

            case 'waiting':
              yield { type: 'waiting', message: event.message, sessionId };
              break;

            case 'done':
              fullResponse = event.response;
              yield { type: 'response_done', response: fullResponse, thinking: fullThinking, sessionId };
              break;
          }
        }
      } catch (err) {
        yield { type: 'error', error: err.message, sessionId };
        return;
      }

      // Parse the full response
      let parsed = parseKimiResponse(fullResponse);
      if (!parsed) {
        yield { type: 'warning', message: '⚠️ Resposta não-JSON, tratando como chat', sessionId };
        parsed = { mode: 'CHAT', response: fullResponse };
      }

      yield { type: 'mode_detected', mode: parsed.mode, sessionId };

      // Execute tools and yield progress
      const result = await this._processModeResult(parsed, sessionId, loopInput, options);

      // Yield all events from mode processing
      for (const ev of result.events) {
        yield ev;
      }

      // If Kimi said CHAT or DONE, we're finished — show the friendly response
      if (parsed.mode === 'CHAT' || parsed.mode === 'DONE') {
        yield { type: 'done', result: { success: true, mode: parsed.mode, response: parsed.response, sessionId }, sessionId };
        return;
      }

      // ACTION or PLAN executed — send result back to Kimi for next iteration
      if (result.output) {
        loopInput = `Resultado da ferramenta ${result.tool || ''}:\n${result.output}\n\nContinue com o próximo passo ou responda ao usuário.`;
        // Always use mini-reminder for tool results (thread already has full prompt)
        loopContext = await this._buildContext(sessionId, loopInput, { ...options, isFirstMessage: false, isToolResult: true });
        // Continue loop — send result back to Kimi
        continue;
      }

      // No output or unrecognized mode — break to avoid infinite loop
      break;
    }

    if (safety >= MAX_LOOPS) {
      yield { type: 'warning', message: '⚠️ Limite de iterações atingido. Encerrando.', sessionId };
    }
  }

  /** Stream-aware mode processor */
  async *_processModeStream(parsed, sessionId, originalInput, options) {
    const mode = parsed.mode || 'CHAT';

    switch (mode) {
      case 'CHAT':
        yield this._handleChat(parsed, sessionId);
        break;

      case 'ACTION': {
        yield { type: 'action_start', tool: parsed.tool, params: parsed.params, sessionId };
        const actionResult = await this._handleAction(parsed, sessionId, options);
        yield { type: 'action_end', result: actionResult, sessionId };
        yield actionResult;
        break;
      }

      case 'PLAN': {
        yield { type: 'plan_start', steps: parsed.steps, sessionId };
        for await (const ev of this._handlePlanStream(parsed, sessionId, originalInput, options)) {
          yield ev;
        }
        break;
      }

      case 'DONE':
        yield this._handleDone(parsed, sessionId);
        break;

      case 'LOAD_SKILL':
        yield this._handleLoadSkill(parsed, sessionId);
        break;

      case 'UPDATE_MEMORY':
        yield this._handleUpdateMemory(parsed, sessionId);
        break;

      case 'META': {
        yield { type: 'meta_start', metaAction: parsed.meta_action, sessionId };
        const metaResult = await this._handleMeta(parsed, sessionId);
        yield { type: 'meta_end', result: metaResult, sessionId };
        yield metaResult;
        break;
      }

      case 'SUGGEST': {
        const suggestResult = await this._handleSuggest(parsed, sessionId, options);
        yield { type: 'suggest', suggestion: parsed.suggestion, result: suggestResult, sessionId };
        yield suggestResult;
        break;
      }

      default:
        yield this._handleChat({ response: `Modo desconhecido: ${mode}. Resposta: ${JSON.stringify(parsed)}` }, sessionId);
    }
  }

  /**
   * Non-generator version of _processModeStream.
   * Returns { events: [], output: string, tool: string } for auto-continue loop.
   */
  async _processModeResult(parsed, sessionId, originalInput, options) {
    const mode = parsed.mode || 'CHAT';
    const events = [];
    let output = '';
    let tool = '';

    switch (mode) {
      case 'CHAT': {
        const chatResult = this._handleChat(parsed, sessionId);
        events.push(chatResult);
        output = parsed.response || '';
        break;
      }

      case 'ACTION': {
        tool = parsed.tool || '';
        events.push({ type: 'action_start', tool: parsed.tool, params: parsed.params, sessionId });
        const actionResult = await this._handleAction(parsed, sessionId, options);
        events.push({ type: 'action_end', result: actionResult, sessionId });
        output = actionResult.result?.stdout || actionResult.result?.output || actionResult.result?.text || JSON.stringify(actionResult.result);
        break;
      }

      case 'PLAN': {
        const steps = parsed.steps || [];
        events.push({ type: 'plan_start', steps, sessionId });
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          events.push({
            type: 'plan_step',
            stepIndex: i,
            total: steps.length,
            tool: step.tool,
            params: step.params,
            sessionId,
          });
          const stepResult = await this._handleAction(
            { tool: step.tool, params: step.params, reasoning: step.reasoning },
            sessionId,
            options
          );
          if (!stepResult.success) {
            events.push({ type: 'plan_error', stepIndex: i, error: stepResult.error, sessionId });
            output = `Falha no passo ${i + 1}: ${stepResult.error}`;
            break;
          }
          await new Promise(r => setTimeout(r, 500));
        }
        events.push({ type: 'plan_complete', sessionId });
        break;
      }

      case 'DONE': {
        const doneResult = this._handleDone(parsed, sessionId);
        events.push(doneResult);
        output = parsed.response || '';
        break;
      }

      case 'LOAD_SKILL':
        events.push(this._handleLoadSkill(parsed, sessionId));
        break;

      case 'UPDATE_MEMORY':
        events.push(this._handleUpdateMemory(parsed, sessionId));
        break;

      case 'META': {
        events.push({ type: 'meta_start', metaAction: parsed.meta_action, sessionId });
        const metaResult = await this._handleMeta(parsed, sessionId);
        events.push({ type: 'meta_end', result: metaResult, sessionId });
        break;
      }

      case 'SUGGEST': {
        const suggestResult = await this._handleSuggest(parsed, sessionId, options);
        events.push({ type: 'suggest', suggestion: parsed.suggestion, result: suggestResult, sessionId });
        break;
      }

      default:
        events.push(this._handleChat({ response: `Modo desconhecido: ${mode}. Resposta: ${JSON.stringify(parsed)}` }, sessionId));
    }

    return { events, output, tool };
  }

  /** Stream-aware plan handler */
  async *_handlePlanStream(parsed, sessionId, originalInput, options) {
    const steps = parsed.steps || [];
    const results = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      yield {
        type: 'plan_step',
        stepIndex: i,
        total: steps.length,
        tool: step.tool,
        params: step.params,
        sessionId,
      };

      const stepResult = await this._handleAction(
        { tool: step.tool, params: step.params, reasoning: step.reasoning },
        sessionId,
        options
      );

      results.push({ step, result: stepResult });

      if (!stepResult.success) {
        yield { type: 'plan_error', stepIndex: i, error: stepResult.error, sessionId };
        yield { success: false, mode: 'PLAN', error: `Falha no passo ${i + 1}`, results, sessionId };
        return;
      }

      await new Promise(r => setTimeout(r, 500));
    }

    yield { type: 'plan_complete', sessionId };
    yield { success: true, mode: 'PLAN', results, sessionId };
  }

  /** Build context prompt with history, desktop, skills, memories */
  async _buildContext(sessionId, userInput, options = {}) {
    const session = this.sessionManager.loadSession(sessionId);
    const recentEvents = this.sessionManager.readRecentEvents(sessionId, 30);

    // Build conversation history
    const historyLines = [];
    for (const ev of recentEvents) {
      if (ev.type === 'user') {
        historyLines.push(`user: ${ev.content}`);
      } else if (ev.type === 'assistant') {
        historyLines.push(`assistant: ${ev.response || ev.content || '[tool use]'}`);
      } else if (ev.type === 'tool_call') {
        historyLines.push(`tool: ${ev.tool || ev.action?.type}(${JSON.stringify(ev.params || ev.action?.params || {})})`);
      } else if (ev.type === 'tool_result') {
        historyLines.push(`result: ${ev.success ? '✅' : '❌'} ${(ev.output || ev.stdout || '').slice(0, 200)}`);
      }
    }

    // Desktop state (optional)
    let desktopState = '';
    if (options.includeDesktop !== false) {
      try {
        const state = await this.engine.getDesktopState();
        desktopState = `Resolução: ${state.screenSize?.width}x${state.screenSize?.height}\nJanela ativa: ${state.activeWindow?.name || 'N/A'}\nMouse: (${state.mousePosition?.x}, ${state.mousePosition?.y})`;
      } catch {
        desktopState = '(desktop state unavailable)';
      }
    }

    // Determine if this is the FIRST message in a new thread
    // If the session has no prior assistant events, we need to send the full system prompt
    const hasPriorConversation = recentEvents.some(ev => ev.type === 'assistant' || ev.type === 'tool_call');
    const isFirstMessage = options.isFirstMessage !== undefined ? options.isFirstMessage : !hasPriorConversation;

    if (isFirstMessage) {
      // ── FIRST MESSAGE: full system prompt + context ──
      // Load skills index
      const skills = loadSkillIndex();
      const skillIndex = skills.map(s => `- ${s.name}: ${s.description} (triggers: ${s.triggers?.join(', ') || 'none'})`).join('\n');

      // Load persona
      const personaContent = loadPersona(session?.persona || 'default') || '';

      // Load memories
      const memories = loadMemories();
      const memoryContext = memories.map(m => `[${m.file}]\n${m.content}`).join('\n\n');

      // Load AGENTS.md from current working directory (kimi-cli style)
      const agentsMd = loadAgentsMd(process.cwd());

      // Build registries for auto-selection
      const personaReg = loadPersonaRegistry();
      const personaRegistry = personaReg.map(p => `- ${p.name}: ${p.description}`).join('\n');
      const skillReg = loadSkillRegistry();
      const skillRegistry = skillReg.map(s => `- ${s.name}: ${s.description}`).join('\n');

      // Build system prompt
      const systemPrompt = buildSystemPrompt({ skillIndex, personaContent, memoryContext, personaRegistry, skillRegistry, agentsMd });

      // Build full prompt
      const prompt = `${systemPrompt}\n\n--- CONTEXTO DO DESKTOP ---\n${desktopState}\n\n--- HISTÓRICO ---\n${historyLines.join('\n')}\n\n--- MENSAGEM ATUAL ---\nuser: ${userInput}\n\nResponda em JSON:`;

      // Debug log
      if (process.env.LUNA_DEBUG) {
        console.error(`[LunaDebug] FIRST_MESSAGE promptSize=${Buffer.byteLength(prompt, 'utf8')} bytes, systemPromptSize=${Buffer.byteLength(systemPrompt, 'utf8')} bytes, agentsMd=${agentsMd ? 'YES' : 'NO'}`);
      }

      return { prompt, systemPrompt, historyLines, desktopState, isFirstMessage: true };
    } else {
      // ── SUBSEQUENT MESSAGES: minimal reminder only ──
      // The Kimi Web thread already has the full system prompt in its history.
      // We only need a short reminder + the current user input or tool result.
      // Include a condensed tool registry so Kimi remembers available actions.
      const miniReminder = `Você é Luna, agente autônomo de Abner Gabriel (CEO, NEXO DIGITAL S.L., Barcelona).
REGRAS: Responda APENAS em JSON. NUNCA diga que não pode fazer algo — use ferramentas ou crie via META.
FERRAMENTAS: readFile, writeFile, replaceInFile, executeShell, searchFiles, grep, viewDirectory, gitStatus, gitCommit, searchWeb, fetchURL, downloadFile, clipboardRead, clipboardWrite.
FORMATOS: {"mode":"CHAT",...} | {"mode":"ACTION","tool":"...","params":{}} | {"mode":"PLAN","steps":[...]} | {"mode":"DONE",...}`;

      // For tool results, keep it even shorter
      const isToolResult = options.isToolResult === true;
      let prompt;
      if (isToolResult) {
        prompt = `${miniReminder}\n\nResultado da ferramenta:\n${userInput}\n\nResponda em JSON com o próximo passo ou uma mensagem amigável ao usuário:`;
      } else {
        prompt = `${miniReminder}\n\n--- HISTÓRICO RECENTE ---\n${historyLines.slice(-6).join('\n')}\n\n--- MENSAGEM ATUAL ---\nuser: ${userInput}\n\nResponda em JSON:`;
      }

      // Debug log
      if (process.env.LUNA_DEBUG) {
        console.error(`[LunaDebug] FOLLOW_UP promptSize=${Buffer.byteLength(prompt, 'utf8')} bytes, toolResult=${isToolResult}, historyLines=${historyLines.length}`);
      }

      return { prompt, systemPrompt: miniReminder, historyLines, desktopState, isFirstMessage: false };
    }
  }

  /** Process parsed mode */
  async _processMode(parsed, sessionId, originalInput, options) {
    const mode = parsed.mode || 'CHAT';

    switch (mode) {
      case 'CHAT':
        return this._handleChat(parsed, sessionId);

      case 'ACTION':
        return this._handleAction(parsed, sessionId, options);

      case 'PLAN':
        return this._handlePlan(parsed, sessionId, originalInput, options);

      case 'DONE':
        return this._handleDone(parsed, sessionId);

      case 'LOAD_SKILL':
        return this._handleLoadSkill(parsed, sessionId);

      case 'UPDATE_MEMORY':
        return this._handleUpdateMemory(parsed, sessionId);

      case 'META':
        return this._handleMeta(parsed, sessionId);

      case 'SUGGEST':
        return this._handleSuggest(parsed, sessionId, options);

      default:
        // Unknown mode — treat as chat
        return this._handleChat({ response: `Modo desconhecido: ${mode}. Resposta: ${JSON.stringify(parsed)}` }, sessionId);
    }
  }

  /**
   * Generate a friendly Portuguese feedback message after tool execution.
   */
  _makeFriendlyFeedback(tool, params, result) {
    const p = params || {};
    if (!result.success) {
      const fallbacks = [
        `Opa, deu errado ao usar ${tool}. Quer que eu tente de outra forma?`,
        `Não consegui executar ${tool}. Pode me dar mais detalhes?`,
        `Falha no ${tool}. Vou tentar um approach diferente se precisar.`,
      ];
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    switch (tool) {
      case 'writeFile':
        return `✅ Pronto, Abner! Criei o arquivo em \`${p.path || p.filePath}\`. Precisa de mais alguma coisa?`;
      case 'readFile':
        return `📖 Li o arquivo. Dá uma olhada no conteúdo acima. Quer que eu edite algo?`;
      case 'replaceInFile':
        return `✏️ Feito! Substitui \`${p.old || p.oldStr}\` por \`${p.new || p.newStr}\` no arquivo.`;
      case 'appendFile':
        return `📝 Adicionei o texto no final do arquivo \`${p.path || p.filePath}\`.`;
      case 'deleteFile':
        return `🗑️ Arquivo \`${p.path || p.filePath}\` deletado com sucesso.`;
      case 'moveFile':
        return `📦 Movido de \`${p.source || p.from}\` para \`${p.destination || p.to}\`.`;
      case 'copyFile':
        return `📋 Copiado de \`${p.source || p.from}\` para \`${p.destination || p.to}\`.`;
      case 'createDirectory':
        return `📁 Diretório \`${p.path || p.dirPath}\` criado.`;
      case 'removeDirectory':
        return `🗑️ Diretório \`${p.path || p.dirPath}\` removido.`;
      case 'executeShell': {
        const out = result.stdout || result.output || '';
        if (out.length > 0 && out.length < 200) {
          return `🖥️ Comando executado. Resultado:\n\`\`\`\n${out}\n\`\`\``;
        }
        return `🖥️ Comando executado com sucesso.`;
      }
      case 'searchFiles':
      case 'grep': {
        const matches = result.matches || [];
        return `🔍 Encontrei ${matches.length} resultado(s).`;
      }
      case 'gitStatus':
        return `🌿 Status do git verificado.`;
      case 'gitCommit':
        return `💾 Commit feito: \`${p.message || ''}\``;
      case 'gitDiff':
        return `🌿 Diff gerado. Dá uma olhada no resultado acima.`;
      case 'gitLog':
        return `📜 Histórico de commits recuperado.`;
      case 'applyPatch':
        return `🩹 Patch aplicado com sucesso.`;
      case 'downloadFile':
        return `⬇️ Download concluído em \`${p.destination || p.path}\`.`;
      case 'fetchURL':
        return `🌐 Página carregada. Veja o conteúdo acima.`;
      case 'runTests': {
        const out = result.stdout || '';
        const passed = out.includes('PASS') || out.includes('passing');
        return passed ? `🧪 Testes passaram!` : `🧪 Testes executados. Veja o resultado.`;
      }
      case 'checkSyntax':
        return `✅ Sintaxe OK.`;
      case 'clipboardWrite':
        return `📋 Copiado para o clipboard.`;
      case 'clipboardRead': {
        const content = result.content || '';
        return `📋 Clipboard: \`${content.slice(0, 100)}${content.length > 100 ? '...' : ''}\``;
      }
      case 'screenshot':
        return `📸 Screenshot tirado e salvo.`;
      case 'think':
        return `🧠 Reflexão registrada.`;
      default:
        return `✅ ${tool} executado com sucesso.`;
    }
  }

  /** CHAT mode — simple response */
  _handleChat(parsed, sessionId) {
    const response = parsed.response || parsed.content || 'Sem resposta';

    this.sessionManager.appendEvent(sessionId, {
      type: 'assistant',
      mode: 'CHAT',
      response,
      timestamp: new Date().toISOString(),
    });

    this.emit('response', { type: 'chat', content: response, sessionId });
    return { success: true, mode: 'CHAT', response, sessionId };
  }

  /** ACTION mode — execute a tool */
  async _handleAction(parsed, sessionId, options) {
    const tool = parsed.tool || parsed.action?.type;
    const params = parsed.params || parsed.action?.params || {};
    const reasoning = parsed.reasoning || '';

    // Store tool call
    this.sessionManager.appendEvent(sessionId, {
      type: 'tool_call',
      tool,
      params,
      reasoning,
      timestamp: new Date().toISOString(),
    });

    // Detect if it's a file tool or desktop tool
    const FILE_TOOLS = Object.keys(lunaTools);
    const DESKTOP_TOOLS = ['shell', 'click', 'doubleClick', 'rightClick', 'type', 'keypress', 'hotkey', 'scroll', 'screenshot', 'ocr', 'open_app', 'wait'];
    const isFileTool = FILE_TOOLS.includes(tool);
    const isDesktopTool = DESKTOP_TOOLS.includes(tool);

    // Emit progress
    const FILE_EMOJIS = {
      readFile: '📖', writeFile: '✍️', appendFile: '📝', replaceInFile: '✏️', deleteFile: '🗑️',
      moveFile: '📦', copyFile: '📋', getFileInfo: '📄',
      listFiles: '📂', viewDirectory: '🗂️', createDirectory: '📁', removeDirectory: '🗑️',
      searchFiles: '🔍', grep: '🔎', glob: '🎯', searchWeb: '🌐', fetchURL: '🌐',
      executeShell: '🖥️', runTests: '🧪', checkSyntax: '✅', installPackages: '📦',
      gitStatus: '🌿', gitDiff: '🌿', gitLog: '📜', gitCommit: '💾',
      applyPatch: '🩹', downloadFile: '⬇️',
      clipboardRead: '📋', clipboardWrite: '📋',
      readMediaFile: '🖼️', getCurrentDirectory: '📍',
      think: '🧠',
    };
    const DESKTOP_EMOJIS = {
      shell: '🖥️', click: '🖱️', doubleClick: '🖱️🖱️', rightClick: '🖱️▶️',
      type: '⌨️', keypress: '🔑', hotkey: '🔑', scroll: '📜',
      screenshot: '📸', ocr: '🔍', open_app: '🚀', wait: '⏱️',
    };
    const emoji = FILE_EMOJIS[tool] || DESKTOP_EMOJIS[tool] || '⚡';

    this.emit('progress', {
      type: 'action',
      tool,
      params,
      message: `${emoji} ${tool}: ${JSON.stringify(params).slice(0, 200)}`,
      sessionId,
      category: isFileTool ? 'file' : isDesktopTool ? 'desktop' : 'unknown',
    });

    // Execute
    let result;
    try {
      if (isFileTool && lunaTools[tool]) {
        // Route params correctly for each tool
        const p = params || {};
        switch (tool) {
          case 'readFile':
            result = lunaTools.readFile(p.path || p.file, { offset: p.offset || p.line_offset, limit: p.limit || p.n_lines });
            break;
          case 'writeFile':
            result = lunaTools.writeFile(p.path || p.filePath, p.content);
            break;
          case 'appendFile':
            result = lunaTools.appendFile(p.path || p.filePath, p.content);
            break;
          case 'replaceInFile':
            result = lunaTools.replaceInFile(p.path || p.filePath, p.old || p.oldStr, p.new || p.newStr, { replaceAll: p.replaceAll, edit: p.edit });
            break;
          case 'deleteFile':
            result = lunaTools.deleteFile(p.path || p.filePath);
            break;
          case 'moveFile':
            result = lunaTools.moveFile(p.source || p.from, p.destination || p.to);
            break;
          case 'copyFile':
            result = lunaTools.copyFile(p.source || p.from, p.destination || p.to);
            break;
          case 'getFileInfo':
            result = lunaTools.getFileInfo(p.path || p.filePath);
            break;
          case 'listFiles':
            result = lunaTools.listFiles(p.pattern || '*', { cwd: p.cwd, limit: p.limit, dot: p.dot });
            break;
          case 'viewDirectory':
            result = lunaTools.viewDirectory(p.path || p.dirPath, { depth: p.depth });
            break;
          case 'createDirectory':
            result = lunaTools.createDirectory(p.path || p.dirPath);
            break;
          case 'removeDirectory':
            result = lunaTools.removeDirectory(p.path || p.dirPath);
            break;
          case 'searchFiles':
            result = lunaTools.searchFiles(p.pattern, { cwd: p.cwd, path: p.path, context: p.context, '-C': p['-C'], limit: p.limit });
            break;
          case 'grep':
            result = lunaTools.grep(p.pattern, { cwd: p.cwd, path: p.path, glob: p.glob, include: p.include, context: p.context, '-C': p['-C'], limit: p.limit, output_mode: p.output_mode });
            break;
          case 'glob':
            result = lunaTools.glob(p.pattern, { cwd: p.cwd, dot: p.dot, ignore: p.ignore, limit: p.limit });
            break;
          case 'searchWeb':
            result = lunaTools.searchWeb(p.query || p.q, { limit: p.limit });
            break;
          case 'fetchURL':
            result = await lunaTools.fetchURL(p.url, { limit: p.limit, timeout: p.timeout });
            break;
          case 'executeShell':
            result = lunaTools.executeShell(p.command, { cwd: p.cwd, timeout: p.timeout });
            break;
          case 'runTests':
            result = lunaTools.runTests({ cwd: p.cwd, timeout: p.timeout, command: p.command });
            break;
          case 'checkSyntax':
            result = lunaTools.checkSyntax(p.path || p.filePath);
            break;
          case 'installPackages':
            result = lunaTools.installPackages(p.packages || p.package, { cwd: p.cwd, timeout: p.timeout });
            break;
          case 'gitStatus':
            result = lunaTools.gitStatus({ cwd: p.cwd });
            break;
          case 'gitDiff':
            result = lunaTools.gitDiff({ cwd: p.cwd, staged: p.staged });
            break;
          case 'gitLog':
            result = lunaTools.gitLog({ cwd: p.cwd, n: p.n, limit: p.limit });
            break;
          case 'gitCommit':
            result = lunaTools.gitCommit(p.message, { cwd: p.cwd });
            break;
          case 'applyPatch':
            result = lunaTools.applyPatch(p.patch || p.patchContent, { cwd: p.cwd });
            break;
          case 'downloadFile':
            result = await lunaTools.downloadFile(p.url, p.destination || p.path, { timeout: p.timeout });
            break;
          case 'clipboardRead':
            result = lunaTools.clipboardRead();
            break;
          case 'clipboardWrite':
            result = lunaTools.clipboardWrite(p.text || p.content);
            break;
          case 'readMediaFile':
            result = lunaTools.readMediaFile(p.path || p.filePath);
            break;
          case 'getCurrentDirectory':
            result = lunaTools.getCurrentDirectory();
            break;
          case 'think':
            result = lunaTools.think(p.thought || p.reasoning || p.text);
            break;
          default:
            result = { success: false, error: `Ferramenta desconhecida: ${tool}` };
        }
      } else if (isDesktopTool) {
        const action = { type: tool, params };
        result = await this.engine.executeSingle(action);
      } else if (tool === 'ipython' && params.code) {
        // Fallback: Kimi sometimes returns ipython instead of executeShell
        const code = params.code.replace(/'/g, "'\\''");
        result = lunaTools.executeShell(`python3 -c '${code}'`, { cwd: params.cwd, timeout: params.timeout || 30000 });
      } else {
        result = { success: false, error: `Ferramenta desconhecida: ${tool}. Use uma das ferramentas disponíveis.` };
      }
    } catch (err) {
      result = { success: false, error: err.message };
    }

    // Format output for storage
    const outputText = result.content || result.stdout || result.output || JSON.stringify(result).slice(0, 2000);

    // Generate friendly feedback message
    const friendlyMessage = this._makeFriendlyFeedback(tool, params, result);
    if (friendlyMessage) {
      result.friendlyMessage = friendlyMessage;
    }

    // Store result
    this.sessionManager.appendEvent(sessionId, {
      type: 'tool_result',
      tool,
      success: result.success,
      output: outputText,
      error: result.error || null,
      timestamp: new Date().toISOString(),
    });

    // Emit result
    this.emit('progress', {
      type: result.success ? 'success' : 'error',
      tool,
      result,
      message: result.success
        ? `${emoji} ✅ ${tool} executado`
        : `${emoji} ❌ ${tool} falhou: ${result.error}`,
      sessionId,
    });

    // If action succeeded and needs follow-up, continue loop
    if (result.success && !parsed.done) {
      return {
        success: true,
        mode: 'ACTION',
        tool,
        result,
        needsContinue: true,
        sessionId,
      };
    }

    return { success: result.success, mode: 'ACTION', tool, result, sessionId };
  }

  /** PLAN mode — execute multi-step plan */
  async _handlePlan(parsed, sessionId, originalInput, options) {
    const steps = parsed.steps || [];
    const reasoning = parsed.reasoning || '';

    this.emit('progress', {
      type: 'plan',
      message: `📋 Plano: ${steps.length} passos`,
      steps: steps.map(s => ({ id: s.id, tool: s.tool, reasoning: s.reasoning, done: false })),
      sessionId,
    });

    const results = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Check overall timeout
      // (simplified — would need startTime tracking)

      // Execute step as ACTION
      const stepResult = await this._handleAction(
        { tool: step.tool, params: step.params, reasoning: step.reasoning },
        sessionId,
        options
      );

      results.push({ step, result: stepResult });

      // Update plan progress
      this.emit('progress', {
        type: 'plan_step',
        stepIndex: i,
        total: steps.length,
        done: stepResult.success,
        sessionId,
      });

      if (!stepResult.success) {
        this.emit('progress', {
          type: 'plan_error',
          message: `❌ Plano falhou no passo ${i + 1}`,
          sessionId,
        });
        return {
          success: false,
          mode: 'PLAN',
          error: `Falha no passo ${i + 1}`,
          results,
          sessionId,
        };
      }

      // Small delay between steps
      await new Promise(r => setTimeout(r, 500));
    }

    this.emit('progress', {
      type: 'plan_complete',
      message: '✅ Plano concluído!',
      sessionId,
    });

    return { success: true, mode: 'PLAN', results, sessionId };
  }

  /** DONE mode — task complete */
  _handleDone(parsed, sessionId) {
    const message = parsed.response || parsed.message || 'Tarefa concluída!';

    this.sessionManager.appendEvent(sessionId, {
      type: 'assistant',
      mode: 'DONE',
      response: message,
      timestamp: new Date().toISOString(),
    });

    this.emit('response', { type: 'done', content: message, sessionId });
    return { success: true, mode: 'DONE', response: message, sessionId };
  }

  /** LOAD_SKILL mode */
  _handleLoadSkill(parsed, sessionId) {
    const skillName = parsed.skill;
    const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');

    let skillContent = '';
    if (fs.existsSync(skillPath)) {
      skillContent = fs.readFileSync(skillPath, 'utf8');
    }

    this.sessionManager.appendEvent(sessionId, {
      type: 'assistant',
      mode: 'LOAD_SKILL',
      skill: skillName,
      timestamp: new Date().toISOString(),
    });

    this.emit('progress', {
      type: 'skill_loaded',
      message: `📚 Skill carregada: ${skillName}`,
      skill: skillName,
      content: skillContent,
      sessionId,
    });

    return {
      success: true,
      mode: 'LOAD_SKILL',
      skill: skillName,
      content: skillContent,
      sessionId,
    };
  }

  /** UPDATE_MEMORY mode */
  _handleUpdateMemory(parsed, sessionId) {
    const fileName = parsed.file || 'user-profile.md';
    const content = parsed.content || '';
    const memoryPath = path.join(MEMORIES_DIR, fileName);

    fs.mkdirSync(MEMORIES_DIR, { recursive: true });
    fs.writeFileSync(memoryPath, content);

    this.sessionManager.appendEvent(sessionId, {
      type: 'assistant',
      mode: 'UPDATE_MEMORY',
      file: fileName,
      timestamp: new Date().toISOString(),
    });

    this.emit('progress', {
      type: 'memory_updated',
      message: `💾 Memória atualizada: ${fileName}`,
      file: fileName,
      sessionId,
    });

    return { success: true, mode: 'UPDATE_MEMORY', file: fileName, sessionId };
  }

  /** META mode — self-improvement */
  async _handleMeta(parsed, sessionId) {
    const metaAction = parsed.meta_action || parsed.metaAction;
    const params = parsed.params || {};
    const reasoning = parsed.reasoning || '';

    this.emit('progress', {
      type: 'meta',
      message: `🔮 META: ${metaAction} — ${reasoning}`,
      metaAction,
      sessionId,
    });

    const result = await this.metaExecutor.execute(metaAction, params);

    this.sessionManager.appendEvent(sessionId, {
      type: 'assistant',
      mode: 'META',
      metaAction,
      success: result.success,
      timestamp: new Date().toISOString(),
    });

    this.emit('progress', {
      type: result.success ? 'meta_success' : 'meta_error',
      message: result.success
        ? `🔮 ✅ META ${metaAction}: ${result.message}`
        : `🔮 ❌ META ${metaAction} falhou: ${result.error}`,
      result,
      sessionId,
    });

    return {
      success: result.success,
      mode: 'META',
      metaAction,
      result,
      sessionId,
    };
  }

  /** SUGGEST mode — auto-select persona/skill based on context */
  async _handleSuggest(parsed, sessionId, options = {}) {
    const suggestion = parsed.suggestion || parsed;
    const type = suggestion.type || suggestion.suggestion?.type;
    const target = suggestion.target || suggestion.suggestion?.target;
    const reason = suggestion.reason || suggestion.suggestion?.reason || '';
    const confidence = suggestion.confidence || suggestion.suggestion?.confidence || 0.5;

    this.emit('progress', {
      type: 'suggest',
      suggestionType: type,
      target,
      reason,
      confidence,
      autoApproved: this.autoSwitchEnabled && confidence >= 0.85,
      sessionId,
    });

    // Store suggestion in session events
    this.sessionManager.appendEvent(sessionId, {
      type: 'suggestion',
      suggestionType: type,
      target,
      reason,
      confidence,
      timestamp: new Date().toISOString(),
    });

    // If auto-switch enabled and high confidence, apply immediately
    if (this.autoSwitchEnabled && confidence >= 0.85) {
      if (type === 'persona') {
        const personaPath = path.join(PERSONAS_DIR, `${target}.md`);
        if (fs.existsSync(personaPath)) {
          // Update session state
          const statePath = path.join(LUNA_DIR, 'sessions', sessionId, 'state.json');
          try {
            const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            state.persona = target;
            fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
          } catch {}
          this.emit('progress', {
            type: 'persona_switched',
            message: `🎭 Auto-switch: persona "${target}" ativada (${Math.round(confidence * 100)}% confiança)`,
            reason,
            target,
            sessionId,
          });
        }
      } else if (type === 'skill') {
        this.emit('progress', {
          type: 'skill_suggested',
          message: `📚 Auto-load: skill "${target}" sugerida (${Math.round(confidence * 100)}% confiança)`,
          reason,
          target,
          sessionId,
        });
        // Return LOAD_SKILL mode so caller can handle it
        return {
          success: true,
          mode: 'SUGGEST',
          applied: true,
          type,
          target,
          reason,
          confidence,
          sessionId,
        };
      }
    }

    // If not auto-applied, return suggestion for user confirmation
    return {
      success: true,
      mode: 'SUGGEST',
      applied: false,
      needsConfirmation: true,
      type,
      target,
      reason,
      confidence,
      sessionId,
    };
  }

  /** Apply a suggestion manually (called by adapter after user confirms) */
  async applySuggestion(sessionId, type, target) {
    if (type === 'persona') {
      const personaPath = path.join(PERSONAS_DIR, `${target}.md`);
      if (!fs.existsSync(personaPath)) {
        return { success: false, error: `Persona "${target}" não encontrada` };
      }
      const statePath = path.join(LUNA_DIR, 'sessions', sessionId, 'state.json');
      try {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        state.persona = target;
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
      } catch {}
      this.emit('progress', {
        type: 'persona_switched',
        message: `🎭 Persona "${target}" ativada`,
        target,
        sessionId,
      });
      return { success: true, type: 'persona', target };
    }
    if (type === 'skill') {
      return this._handleLoadSkill({ skill: target }, sessionId);
    }
    return { success: false, error: 'Tipo de sugestão desconhecido' };
  }

  /** Continue an action loop (for multi-step tasks) */
  async continueLoop(sessionId, options = {}) {
    // Re-build context and send to Kimi for next step
    const recentEvents = this.sessionManager.readRecentEvents(sessionId, 10);
    const lastEvent = recentEvents[recentEvents.length - 1];

    if (!lastEvent || lastEvent.type !== 'tool_result') {
      return { success: false, error: 'No tool result to continue from', sessionId };
    }

    // Build a prompt asking Kimi what to do next
    const context = await this._buildContext(sessionId, '[continue after tool execution]', options);
    const prompt = context.prompt + '\n\nO último comando foi executado. Qual o próximo passo?';

    let kimiResponse;
    try {
      const result = await this.kimiBridge.sendMessage(
        options.userId || 'luna-default',
        prompt,
        { mode: options.mode || this.defaultMode }
      );
      kimiResponse = result.response;
    } catch (err) {
      return { success: false, error: err.message, sessionId };
    }

    const parsed = parseKimiResponse(kimiResponse);
    if (!parsed) {
      return { success: false, error: 'Failed to parse continuation', raw: kimiResponse, sessionId };
    }

    return this._processMode(parsed, sessionId, '[continue]', options);
  }

  /** Run a full ReAct-style task (for complex PC interactions) */
  async runTask(taskDescription, options = {}) {
    const sessionId = options.sessionId || this.sessionManager.getOrCreateCurrentSession({
      title: `Tarefa: ${taskDescription.slice(0, 50)}`,
    }).id;

    this.emit('progress', {
      type: 'task_start',
      message: `📝 Tarefa: ${taskDescription}`,
      sessionId,
    });

    const startTime = Date.now();
    const maxIterations = options.maxIterations || this.maxIterations;

    for (let i = 0; i < maxIterations; i++) {
      if (Date.now() - startTime > this.taskTimeoutMs) {
        return { success: false, error: 'Timeout', sessionId };
      }

      // Process one step
      const result = await this.processMessage(taskDescription, {
        ...options,
        sessionId,
        includeDesktop: true,
      });

      if (result.mode === 'DONE') {
        return { success: true, message: result.response, sessionId };
      }

      if (result.mode === 'ACTION' && result.needsContinue) {
        // Continue the loop
        taskDescription = '[continue]'; // Signal to continue
        await new Promise(r => setTimeout(r, 800));
        continue;
      }

      if (result.mode === 'CHAT') {
        // Chat response means task is done or needs user input
        return { success: true, response: result.response, sessionId };
      }

      if (!result.success) {
        return { success: false, error: result.error, sessionId };
      }

      await new Promise(r => setTimeout(r, 500));
    }

    return { success: false, error: `Máximo de iterações (${maxIterations}) atingido`, sessionId };
  }
}

module.exports = {
  LunaSoul,
  parseKimiResponse,
  buildSystemPrompt,
  loadSkillIndex,
  loadPersona,
  loadMemories,
  MetaExecutor,
};
