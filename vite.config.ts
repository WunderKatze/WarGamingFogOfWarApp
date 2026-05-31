import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    // happy-dom gives renderHook + React Testing Library a DOM to mount in.
    // Light enough that running every test in this environment is cheaper
    // than maintaining per-file environment annotations.
    environment: "happy-dom",
  },
});
