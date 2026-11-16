/** Server import face — the logic lives once in ./brand.js (plain .js so the
 *  client, the Node tests and Deno all import the same file). Re-export only;
 *  no twin to drift. See ./brand.js.
 */
export * from "./brand.js";
