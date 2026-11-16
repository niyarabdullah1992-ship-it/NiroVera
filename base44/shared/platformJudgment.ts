/** Server import face — the logic lives once in ./platformJudgment.js (plain .js so the
 *  client, the Node tests and Deno all import the same file). Re-export only;
 *  no twin to drift. See ./platformJudgment.js for the derivations.
 */
export * from "./platformJudgment.js";
