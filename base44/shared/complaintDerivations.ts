/** Server import face — the logic lives once in ./complaintDerivations.js (plain .js so the
 *  client, the Node tests and Deno all import the same file). Re-export only;
 *  no twin to drift. See ./complaintDerivations.js.
 */
export * from "./complaintDerivations.js";
