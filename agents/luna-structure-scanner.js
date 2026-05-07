/**
 * LUNA STRUCTURE SCANNER v1.0
 * Escaneia a estrutura real do projeto NEXO DASHBOARD PRO
 * Gera: /mnt/agents/output/luna-project-context.md
 * 
 * COMO USAR:
 * 1. Salve como: C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO\agents\luna-structure-scanner.js
 * 2. Rode: node luna-structure-scanner.js
 * 3. O arquivo luna-project-context.md será gerado na raiz do projeto
 * 4. Me envie esse arquivo para eu entender sua estrutura real
 */

const fs = require('fs');
const path = require('path');

// ── CONFIG ──
const BASE_DIR = process.cwd(); // Roda da pasta onde o script está
const PROJECT_ROOT = path.resolve(BASE_DIR, '..'); // Sobe um nível (raiz do projeto)
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'luna-project-context.md');

// Arquivos e pastas a ignorar
const IGNORE = [
  'node_modules', '.git', 'dist', 'build', '.vercel', 'coverage',
  '.DS_Store', 'Thumbs.db', '*.log', '*.tmp', '*.temp',
  'luna-project-context.md' // Não se auto-incluir
];

// Extensões relevantes para ler conteúdo
const RELEVANT_EXTS = [
  '.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx',
  '.json', '.md', '.txt', '.yml', '.yaml',
  '.html', '.css', '.ps1', '.sh', '.bat'
];

// Arquivos que NUNCA devem ter conteúdo lido (dados sensíveis)
const SKIP_CONTENT = [
  '.env', '.env.local', '.env.production',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'
];

// ── HELPERS ──
function shouldIgnore(filePath) {
  const basename = path.basename(filePath);
  return IGNORE.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(basename);
    }
    return basename === pattern || filePath.includes(pattern);
  });
}

function isRelevant(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return RELEVANT_EXTS.includes(ext);
}

function shouldSkipContent(filePath) {
  const basename = path.basename(filePath);
  return SKIP_CONTENT.includes(basename);
}

function getFileSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function readFirstLines(filePath, maxLines = 80) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Para JSON, tenta parsear e mostrar estrutura
    if (filePath.endsWith('.json')) {
      try {
        const parsed = JSON.parse(content);
        const preview = JSON.stringify(parsed, null, 2).split('\n').slice(0, maxLines);
        return preview.join('\n');
      } catch {
        return lines.slice(0, maxLines).join('\n');
      }
    }

    return lines.slice(0, maxLines).join('\n');
  } catch (err) {
    return `/* Erro ao ler: ${err.message} */`;
  }
}

function extractImports(content) {
  const imports = [];
  const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;
  const importSideRegex = /import\s+['"`]([^'"`]+)['"`]/g;

  let match;
  while ((match = requireRegex.exec(content)) !== null) imports.push(match[1]);
  while ((match = importRegex.exec(content)) !== null) imports.push(match[1]);
  while ((match = importSideRegex.exec(content)) !== null) imports.push(match[1]);

  return [...new Set(imports)];
}

function extractExports(content) {
  const exports = [];
  const moduleRegex = /module\.exports\s*=\s*\{([^}]+)\}/;
  const exportRegex = /export\s+(?:default\s+)?(?:const|let|var|function|class)\s+(\w+)/g;

  let match;
  if ((match = moduleRegex.exec(content)) !== null) {
    exports.push(`module.exports: { ${match[1].trim()} }`);
  }
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(`export ${match[1]}`);
  }

  return exports;
}

// ── SCANNER ──
function scanDirectory(dir, relativePath = '', depth = 0, maxDepth = 6) {
  if (depth > maxDepth) return [];

  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relPath = path.join(relativePath, item.name);

    if (shouldIgnore(fullPath)) continue;

    if (item.isDirectory()) {
      results.push({
        type: 'directory',
        path: relPath,
        depth,
        children: scanDirectory(fullPath, relPath, depth + 1, maxDepth)
      });
    } else {
      const stat = fs.statSync(fullPath);
      const fileInfo = {
        type: 'file',
        path: relPath,
        size: getFileSize(stat.size),
        sizeBytes: stat.size,
        ext: path.extname(item.name),
        depth
      };

      // Ler conteúdo de arquivos relevantes
      if (isRelevant(fullPath) && !shouldSkipContent(fullPath) && stat.size < 500 * 1024) {
        const content = readFirstLines(fullPath, 80);
        fileInfo.preview = content;
        fileInfo.lineCount = content.split('\n').length;

        // Extrair imports/exports de arquivos JS
        if (['.js', '.mjs', '.cjs', '.ts'].includes(fileInfo.ext)) {
          try {
            const fullContent = fs.readFileSync(fullPath, 'utf8');
            fileInfo.imports = extractImports(fullContent);
            fileInfo.exports = extractExports(fullContent);
          } catch {}
        }
      }

      results.push(fileInfo);
    }
  }

  return results;
}

// ── FORMATTER ──
function formatTree(items, prefix = '') {
  let output = '';

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isLast = i === items.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';

    if (item.type === 'directory') {
      output += `${prefix}${connector}📁 ${path.basename(item.path)}/\n`;
      if (item.children && item.children.length > 0) {
        output += formatTree(item.children, prefix + childPrefix);
      }
    } else {
      const icon = item.ext === '.json' ? '📄' : 
                   item.ext === '.js' || item.ext === '.mjs' || item.ext === '.cjs' ? '⚡' :
                   item.ext === '.md' ? '📝' :
                   item.ext === '.html' ? '🌐' :
                   item.ext === '.css' ? '🎨' :
                   item.ext === '.ps1' ? '💻' :
                   '📄';
      output += `${prefix}${connector}${icon} ${path.basename(item.path)} (${item.size})\n`;
    }
  }

  return output;
}

function formatFileDetails(items, depth = 0) {
  let output = '';

  for (const item of items) {
    if (item.type === 'directory' && item.children) {
      output += formatFileDetails(item.children, depth + 1);
    } else if (item.type === 'file' && item.preview) {
      const lang = item.ext === '.json' ? 'json' :
                   item.ext === '.js' || item.ext === '.mjs' || item.ext === '.cjs' ? 'javascript' :
                   item.ext === '.md' ? 'markdown' :
                   item.ext === '.html' ? 'html' :
                   item.ext === '.css' ? 'css' :
                   item.ext === '.ps1' ? 'powershell' :
                   'text';

      output += `\n---\n\n## 📄 ${item.path}\n\n`;
      output += `- **Tamanho:** ${item.size}\n`;
      output += `- **Linhas lidas:** ${item.lineCount}\n`;

      if (item.imports && item.imports.length > 0) {
        output += `- **Imports:** ${item.imports.join(', ')}\n`;
      }
      if (item.exports && item.exports.length > 0) {
        output += `- **Exports:** ${item.exports.join(', ')}\n`;
      }

      output += `\n\`\`\`${lang}\n${item.preview}\n\`\`\`\n`;
    }
  }

  return output;
}

// ── MAIN ──
function main() {
  console.log('🔍 LUNA STRUCTURE SCANNER v1.0');
  console.log(`📁 Escaneando: ${PROJECT_ROOT}`);
  console.log('⏳ Isso pode levar alguns segundos...\n');

  const tree = scanDirectory(PROJECT_ROOT);

  let md = `# LUNA PROJECT CONTEXT\n`;
  md += `# Gerado em: ${new Date().toISOString()}\n`;
  md += `# Projeto: NEXO DASHBOARD PRO\n`;
  md += `# Raiz: ${PROJECT_ROOT}\n\n`;

  md += `---\n\n`;
  md += `## 🗂️ ÁRVORE DE ARQUIVOS\n\n`;
  md += `\`\`\`\n`;
  md += `NEXO_DASHBOARD_PRO/\n`;
  md += formatTree(tree);
  md += `\`\`\`\n\n`;

  md += `---\n\n`;
  md += `## 📋 DETALHES DOS ARQUIVOS\n`;
  md += formatFileDetails(tree);

  md += `\n---\n\n`;
  md += `## 📊 RESUMO\n\n`;

  // Contadores
  let fileCount = 0;
  let dirCount = 0;
  let jsCount = 0;
  let jsonCount = 0;
  let mdCount = 0;

  function count(items) {
    for (const item of items) {
      if (item.type === 'file') {
        fileCount++;
        if (['.js', '.mjs', '.cjs'].includes(item.ext)) jsCount++;
        if (item.ext === '.json') jsonCount++;
        if (item.ext === '.md') mdCount++;
      } else if (item.type === 'directory') {
        dirCount++;
        if (item.children) count(item.children);
      }
    }
  }
  count(tree);

  md += `- **Total de arquivos:** ${fileCount}\n`;
  md += `- **Total de pastas:** ${dirCount}\n`;
  md += `- **Arquivos JS:** ${jsCount}\n`;
  md += `- **Arquivos JSON:** ${jsonCount}\n`;
  md += `- **Arquivos MD:** ${mdCount}\n\n`;

  md += `---\n\n`;
  md += `## 📝 NOTAS PARA O AI\n\n`;
  md += `Este arquivo foi gerado automaticamente para fornecer contexto completo\n`;
  md += `do projeto NEXO DASHBOARD PRO. Use estas informações para:\n`;
  md += `1. Entender a estrutura real de arquivos\n`;
  md += `2. Ver os schemas JSON reais (não inventar dados)\n`;
  md += `3. Ver imports/exports de cada arquivo\n`;
  md += `4. Entender dependências antes de propor código\n\n`;
  md += `**NÃO gere código genérico.** Sempre baseie-se nesta estrutura real.\n`;

  fs.writeFileSync(OUTPUT_FILE, md, 'utf8');

  console.log('✅ Scan completo!');
  console.log(`📄 Arquivo gerado: ${OUTPUT_FILE}`);
  console.log(`📊 ${fileCount} arquivos | ${dirCount} pastas | ${jsCount} JS | ${jsonCount} JSON`);
  console.log('\n🚀 Me envie este arquivo para eu entender sua estrutura real!');
}

main();
