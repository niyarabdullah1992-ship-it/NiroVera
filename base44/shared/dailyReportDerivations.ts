/** Server import face — the logic lives once in ./dailyReportDerivations.js (plain .js so the
 *  client, the Node tests and Deno all import the same file). Re-export only;
 *  no twin to drift. See ./dailyReportDerivations.js for the derivations.
 */
export * from "./dailyReportDerivations.js";
