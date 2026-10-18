import assert from "node:assert/strict";
import { VOICE_CHANNELS, voiceRouteLine, collectVoiceItems } from "../src/lib/voiceBoard.js";
import { isHrOnlyVoice, voiceChannelOf } from "../src/lib/voicePrivacy.js";
import { composeRequestKinds } from "../src/lib/requestWorkspace.js";

const heat = VOICE_CHANNELS.find((row) => row.id === "heat");
assert.ok(heat, "«بلاغ عمل مكشوف» is a voice channel");
assert.match(heat.lawAr, /3337/);
const row = { id: "pub_1", authorId: "e1", type: "complaint", kind: "public", channel: "heat", incidentDate: "2026-07-14" };
assert.equal(voiceChannelOf(row), "heat");
assert.equal(isHrOnlyVoice(row), true, "a heat report goes to HR only, never via the manager");
assert.equal(collectVoiceItems({ publicReports: [row] })[0].channel, "heat");
assert.ok(!composeRequestKinds("self").some((k) => k.id === "heat_report"), "no longer raised from requests");
assert.ok(voiceRouteLine);
console.log("voice heat ok");
