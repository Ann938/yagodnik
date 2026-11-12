// Стиль настоящей карты (векторные тайлы OpenFreeMap, данные OpenStreetMap) в оттенках текущего вкуса.
// Цвета берём из палитры страницы (--bg/--bg2/--ink/--accent) и смешиваем: земля светлая, кварталы чуть темнее,
// вода — холодная, парки — приглушённо-зелёные, дороги белые; подписи — цветом текста сайта.
import type { StyleSpecification } from "maplibre-gl";

export type Palette = { bg: string; bg2: string; ink: string; accent: string };

const hex = (h: string) => {
  const s = h.replace("#", "");
  const n = parseInt(s.length === 3 ? s.replace(/./g, "$&$&") : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
// смесь двух цветов: k — доля второго
export const mixc = (a: string, b: string, k: number) => {
  const A = hex(a),
    B = hex(b);
  return `rgb(${A.map((x, i) => Math.round(x + (B[i] - x) * k)).join(",")})`;
};

export function colors(p: Palette) {
  return {
    land: mixc(p.bg, "#ffffff", 0.45),
    block: mixc(p.bg, p.bg2, 0.35),
    building: mixc(p.bg, p.bg2, 0.75),
    park: mixc("#cfe3bd", p.bg, 0.25),
    wood: mixc("#bcd8a8", p.bg, 0.2),
    water: mixc("#a9cfe6", p.bg2, 0.22),
    road: "#fffaf6",
    roadCase: mixc(p.bg2, p.ink, 0.12),
    major: mixc("#ffffff", p.bg2, 0.25),
    rail: mixc(p.bg2, p.ink, 0.25),
    label: p.ink,
    halo: mixc(p.bg, "#ffffff", 0.6),
    waterLabel: mixc("#4f86a8", p.ink, 0.3),
  };
}

const NAME = ["coalesce", ["get", "name:ru"], ["get", "name"]] as unknown as string;
const FONT = ["Noto Sans Regular"];
const FONT_B = ["Noto Sans Bold"];

export function mapStyle(p: Palette): StyleSpecification {
  const c = colors(p);
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
      { id: "road-name", type: "symbol", source: "omt", "source-layer": "transportation_name", minzoom: 13.5, layout: { "text-field": NAME, "text-font": FONT, "text-size": 11.5, "symbol-placement": "line" }, paint: { "text-color": mixc(p.ink, p.bg, 0.35), "text-halo-color": c.halo, "text-halo-width": 1.4 } },
      { id: "place", type: "symbol", source: "omt", "source-layer": "place", filter: ["match", ["get", "class"], ["suburb", "quarter", "neighbourhood", "island"], true, false], layout: { "text-field": NAME, "text-font": FONT_B, "text-size": 12, "text-transform": "uppercase", "text-letter-spacing": 0.12, "text-max-width": 8 }, paint: { "text-color": mixc(p.ink, p.bg, 0.5), "text-halo-color": c.halo, "text-halo-width": 1.4 } },
    ],
  } as StyleSpecification;
}

// перекраска уже загруженной карты при смене вкуса — без перезагрузки тайлов
export function recolor(map: import("maplibre-gl").Map, p: Palette) {
  const c = colors(p);
  const set = (id: string, prop: string, v: string) => map.getLayer(id) && map.setPaintProperty(id, prop as never, v as never);
  set("background", "background-color", c.land);
  set("landuse", "fill-color", c.block);
  set("wood", "fill-color", c.wood);
  set("park", "fill-color", c.park);
  set("water", "fill-color", c.water);
  set("waterway", "line-color", c.water);
  set("building", "fill-color", c.building);
  set("rail", "line-color", c.rail);
  set("road-mid-case", "line-color", c.roadCase);
  set("road-big-case", "line-color", c.roadCase);
  set("road-big", "line-color", c.major);
  set("water-name", "text-color", c.waterLabel);
  set("road-name", "text-color", mixc(p.ink, p.bg, 0.35));
  set("place", "text-color", mixc(p.ink, p.bg, 0.5));
  for (const id of ["water-name", "road-name", "place"]) set(id, "text-halo-color", c.halo);
}
