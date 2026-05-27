/**
 * Application initialization.
 * This module must be imported before any other application modules
 * to ensure tools and other global state are properly initialized.
 */

import { registerBuiltinTools } from "./tools/builtin/index.js";

// Register all builtin tools
registerBuiltinTools();

console.log("[init] Application initialized");
