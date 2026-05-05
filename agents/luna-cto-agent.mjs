import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const lunaModule = require('./luna-cto-agent.cjs');

export const LunaAgent = lunaModule.LunaAgent || lunaModule.default?.LunaAgent || lunaModule.default;
export const runAgent = lunaModule.runAgent || lunaModule.default?.runAgent;
export const diagnose = lunaModule.diagnose || lunaModule.default?.diagnose;
export const CONFIG = lunaModule.CONFIG || lunaModule.default?.CONFIG || {};

export default LunaAgent;