// luna-extract-schemas.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'backend', 'data');
const SCHEMA_DIR = path.join(DATA_DIR, 'schema');

function readJson(filename) {
  try {
    const content = fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return { error: e.message };
  }
}

function readDataJson(filename) {
  try {
    const content = fs.readFileSync(path.join(DATA_DIR, filename), 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return { error: e.message };
  }
}

function summarizeObject(obj, maxDepth = 2, depth = 0) {
  if (depth > maxDepth) return '...';
  if (obj === null) return 'null';
  if (typeof obj !== 'object') return typeof obj;
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const first = summarizeObject(obj[0], maxDepth, depth + 1);
    return `[${first} x${obj.length}]`;
  }
  
  const keys = Object.keys(obj);
  const summary = {};
  for (const key of keys.slice(0, 5)) {
    summary[key] = summarizeObject(obj[key], maxDepth, depth + 1);
  }
  if (keys.length > 5) summary['...'] = `+${keys.length - 5} more`;
  return summary;
}

console.log('=== CLIENTS REGISTRY ===');
const clients = readJson('clients-registry.json');
console.log(JSON.stringify(summarizeObject(clients), null, 2));

console.log('\n=== CONTACTS MAP ===');
const contacts = readJson('contacts-map.json');
console.log(JSON.stringify(summarizeObject(contacts), null, 2));

console.log('\n=== PROJECTS REGISTRY ===');
const projects = readJson('projects-registry.json');
console.log(JSON.stringify(summarizeObject(projects), null, 2));

console.log('\n=== COMPANY TASKS (primeiras 3) ===');
const tasks = readDataJson('company-tasks.json');
if (Array.isArray(tasks)) {
  console.log(JSON.stringify(tasks.slice(0, 3), null, 2));
} else {
  console.log(JSON.stringify(summarizeObject(tasks), null, 2));
}

console.log('\n=== FULL EXTRACT (primeira mensagem) ===');
const extract = readDataJson('full-extract.json');
if (Array.isArray(extract)) {
  console.log(JSON.stringify(extract[0], null, 2));
} else if (extract.messages) {
  console.log(JSON.stringify(extract.messages[0], null, 2));
} else {
  console.log(JSON.stringify(summarizeObject(extract), null, 2));
}