import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("publish map keeps the user position separate from the trade pin", async () => {
  const [publishMap, osmMap] = await Promise.all([
    readFile(new URL("../app/PublishLocationMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/map/OsmMap.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(publishMap, /tradeMarkerRef/);
  assert.match(publishMap, /userLocationLayerRef/);
  assert.match(publishMap, /updateUserLocation/);
  assert.match(publishMap, /L\.circleMarker/);
  assert.match(publishMap, /我的当前位置/);
  assert.match(osmMap, /我的当前位置/);
});
