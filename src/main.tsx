import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerRuleset } from "./core/ruleset/index.js";
import { wwiiRuleset } from "./rulesets/wwii/engine/index.js";
import { App } from "./ui/App.js";

// Register every ruleset bundle before mounting the UI. Engine-core never
// imports rulesets directly (R3); it looks them up through the registry,
// which means every ruleset has to land in the registry before any code
// that consults it runs. Step 1a only registers WWII; nothing yet
// consults the registry, but the pattern is in place for subsequent
// Phase B step-1 sub-steps. See docs/features/v2/mechanics-refactor.md
// §8 + §13.1.
registerRuleset(wwiiRuleset);

const container = document.getElementById("root");
if (!container) throw new Error("#root element not found");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
