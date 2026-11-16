/** Server import face — the logic lives once in ./hseDerivations.js (plain .js so the
 *  client, the Node tests and Deno all import the same file). Re-export only;
 *  no twin to drift. See ./hseDerivations.js for the derivations.
 */
export * from "./hseDerivations.js";
