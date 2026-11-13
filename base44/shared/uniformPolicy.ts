/** Server import face — the logic lives once in ./uniformPolicy.js (plain .js so the
 *  client, the Node tests and Deno all import the same file). Re-export only;
 *  no twin to drift. See ./uniformPolicy.js for the derivations.
 */
export * from "./uniformPolicy.js";
