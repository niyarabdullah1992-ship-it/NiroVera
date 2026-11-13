/** Server import face — the logic lives once in ./safetyBranchVisibility.js (plain .js so the
 *  client, the Node tests and Deno all import the same file). Re-export only;
 *  no twin to drift. See ./safetyBranchVisibility.js for the derivations.
 */
export * from "./safetyBranchVisibility.js";
