import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees: transient full copies of the repo — lint them from
    // within the worktree, not through the main tree.
    ".claude/worktrees/**",
    // Vendored snapshot of the standalone hiveboard app (already ported into
    // /projects — see src/lib/board.ts); kept for reference only.
    "Hive-Project-Management-main/**",
  ]),
]);

export default eslintConfig;
