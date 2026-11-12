// Стиль настоящей карты (векторные тайлы OpenFreeMap, данные OpenStreetMap): спокойная серая, как обычные карты.
import type { StyleSpecification } from "maplibre-gl";

// обычная серая карта (как в навигаторах): от вкуса не зависит, цветные только метки-логотипы
function colors() {
  return {
    land: "#f3f3f1",
    block: "#e9e9e6",
    building: "#dcdcd9",
    park: "#d6e8cc",
    wood: "#cfe3c4",
    water: "#bfd6e6",
    road: "#ffffff",
    roadCase: "#d3d3cf",
    major: "#fdfdfb",
    rail: "#bdbdb8",
    label: "#5f5f5c",
    halo: "#ffffff",
    waterLabel: "#5a7d95",
  };
}

const NAME = ["coalesce", ["get", "name:ru"], ["get", "name"]] as unknown as string;
const FONT = ["Noto Sans Regular"];
const FONT_B = ["Noto Sans Bold"];

export function mapStyle(): StyleSpecification {
  const c = colors();
  const minor = ["match", ["get", "class"], ["minor", "service", "track"], true, false];
  const mid = ["match", ["get", "class"], ["secondary", "tertiary"], true, false];
  const big = ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false];
  const w = (a: number, b: number) => ["interpolate", ["exponential", 1.6], ["zoom"], 10, a, 17, b];
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: { omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
    layers: [
      { id: "background", type: "background", paint: { "background-color": c.land } },
      { id: "landuse", type: "fill", source: "omt", "source-layer": "landuse", filter: ["match", ["get", "class"], ["residential", "commercial", "retail", "industrial"], true, false], paint: { "fill-color": c.block, "fill-opacity": 0.55 } },
      { id: "wood", type: "fill", source: "omt", "source-layer": "landcover", filter: ["match", ["get", "class"], ["wood", "grass", "farmland"], true, false], paint: { "fill-color": c.wood, "fill-opacity": 0.75 } },
      { id: "park", type: "fill", source: "omt", "source-layer": "park", paint: { "fill-color": c.park, "fill-opacity": 0.85 } },
      { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": c.water } },
      { id: "waterway", type: "line", source: "omt", "source-layer": "waterway", paint: { "line-color": c.water, "line-width": w(0.6, 4) } },
      { id: "building", type: "fill", source: "omt", "source-layer": "building", minzoom: 14, paint: { "fill-color": c.building, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.5, 0.7] } },
      { id: "rail", type: "line", source: "omt", "source-layer": "transportation", filter: ["==", ["get", "class"], "rail"], paint: { "line-color": c.rail, "line-width": w(0.4, 1.6), "line-dasharray": [3, 3] } },
      { id: "road-minor", type: "line", source: "omt", "source-layer": "transportation", minzoom: 13, filter: minor as never, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.road, "line-width": w(0.4, 7) } },
      { id: "road-mid-case", type: "line", source: "omt", "source-layer": "transportation", filter: mid as never, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.roadCase, "line-width": w(1.2, 13) } },
      { id: "road-mid", type: "line", source: "omt", "source-layer": "transportation", filter: mid as never, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.road, "line-width": w(0.8, 11) } },
      { id: "road-big-case", type: "line", source: "omt", "source-layer": "transportation", filter: big as never, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.roadCase, "line-width": w(2, 18) } },
      { id: "road-big", type: "line", source: "omt", "source-layer": "transportation", filter: big as never, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.major, "line-width": w(1.4, 15) } },
      { id: "water-name", type: "symbol", source: "omt", "source-layer": "water_name", layout: { "text-field": NAME, "text-font": FONT, "text-size": 13, "symbol-placement": "point" }, paint: { "text-color": c.waterLabel, "text-halo-color": c.halo, "text-halo-width": 1.2 } },
      { id: "road-name", type: "symbol", source: "omt", "source-layer": "transportation_name", minzoom: 13.5, layout: { "text-field": NAME, "text-font": FONT, "text-size": 11.5, "symbol-placement": "line" }, paint: { "text-color": c.label, "text-halo-color": c.halo, "text-halo-width": 1.4 } },
      { id: "place", type: "symbol", source: "omt", "source-layer": "place", filter: ["match", ["get", "class"], ["suburb", "quarter", "neighbourhood", "island"], true, false], layout: { "text-field": NAME, "text-font": FONT_B, "text-size": 12, "text-transform": "uppercase", "text-letter-spacing": 0.12, "text-max-width": 8 }, paint: { "text-color": "#8a8a86", "text-halo-color": c.halo, "text-halo-width": 1.4 } },
    ],
  } as StyleSpecification;
}
