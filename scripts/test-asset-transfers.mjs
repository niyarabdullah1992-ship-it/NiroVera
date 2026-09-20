import assert from "node:assert/strict";
import { applyApprovedAssetMove, checkAssetTransferRequestGate } from "../src/lib/assetTransferGates.js";

assert.equal(checkAssetTransferRequestGate({}).error, "ASSET_REQUIRED");
assert.equal(checkAssetTransferRequestGate({
  asset: { id: "a1", status: "lost", stationId: "s1" },
  fromStationId: "s1",
  toStationId: "s2",
  reason: "الرس بلا مركبة صيانة",
}).error, "ASSET_NOT_MOVABLE");
assert.equal(checkAssetTransferRequestGate({
  asset: { id: "a1", status: "available", stationId: "s1" },
  fromStationId: "s1",
  toStationId: "s1",
  reason: "سبب كافٍ للنقل بين فرعين",
}).error, "STATIONS_REQUIRED");
assert.equal(checkAssetTransferRequestGate({
  asset: { id: "a1", status: "available", stationId: "s1" },
  fromStationId: "s1",
  toStationId: "s2",
  reason: "قصير",
}).error, "REASON_REQUIRED");
assert.equal(checkAssetTransferRequestGate({
  asset: { id: "a1", status: "available", stationId: "s1" },
  fromStationId: "s1",
  toStationId: "s2",
  reason: "الرس بلا مركبة صيانة — طلب مدير الفرع",
}).ok, true);

const moved = applyApprovedAssetMove(
  { id: "a1", stationId: "s1", originStationId: null, value: 1000 },
  { assetId: "a1", fromStationId: "s1", toStationId: "s2" },
);
assert.equal(moved.stationId, "s2");
assert.equal(moved.originStationId, "s1");
assert.equal(moved.value, 1000);
assert.equal(applyApprovedAssetMove({ id: "other" }, { assetId: "a1" }).id, "other");

console.log("asset transfers ok");
