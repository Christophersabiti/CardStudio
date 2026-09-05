import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([...nextVitals,...nextTs,{rules:{"@next/next/no-page-custom-font":"off"}},globalIgnores([".next/**","node_modules/**","deliverables/**","Claude outputs/**","next-env.d.ts"])]);
