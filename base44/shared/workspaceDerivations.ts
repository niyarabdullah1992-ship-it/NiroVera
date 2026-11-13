/** Workspace tenant registry — server import face.
 *
 *  The logic lives once in ./workspaceDerivations.js (plain .js so the client,
 *  the Node tests and Deno can all import the same file). This .ts only
 *  re-exports it, so the function deployment and the esbuild / twin-drift guards
 *  keep seeing a .ts twin while there is exactly one source. No drift by
 *  construction. See workspaceDerivations.js for the derivations themselves.
 */
export * from "./workspaceDerivations.js";
