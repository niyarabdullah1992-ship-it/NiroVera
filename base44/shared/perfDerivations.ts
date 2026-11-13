/** Server import face — the logic lives once in ./perfDerivations.js (plain .js so the
 *  client, the Node tests and Deno all import the same file). Re-export only;
 *  no twin to drift. See ./perfDerivations.js for the derivations.
 */
export * from "./perfDerivations.js";
