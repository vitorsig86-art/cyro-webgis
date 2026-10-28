import type { ProjectConfig } from "./types";
import { templateProject } from "./template";

// Valores reais do projeto cyro. template.ts guarda só exemplos genéricos
// usados por npm run check: não coloque dados da propriedade nele.
// Passo a passo: docs/CHECKLIST_NOVO_PROJETO.md.
const basemap = templateProject.layers[0];

// Gerado por scripts/raster-from-xml.cjs (Global Mapper, EPSG:900913, TMS).
// bounds = tile 11/768/896 inteiro, não o contorno real do ortomosaico.
const orto: ProjectConfig["layers"][number] = {
  id: "orto",
  name: "Ortomosaico",
  description: "",
  kind: "orthomosaic",
  defaultVisible: true,
  source: {
    format: "tms",
    url: "https://pub-97f2474708304c9b9448b3766da91a46.r2.dev/orto/{z}/{x}/{reverseY}.png",
    credit: "Cardeal Map",
    bounds: [-45, -21.9430456, -44.8242187, -21.7799053],
    minimumLevel: 11,
    maximumLevel: 20,
    tileWidth: 256,
    tileHeight: 256,
  },
};

// Derivados do relevo, gerados por scripts/raster-from-xml.cjs (EPSG:900913, TMS).
// Legenda desenhada no próprio raster. Mesmo exclusiveGroup: um ligado por vez
// sobre o orto. bounds = tiles inteiros do BoundingBox, não o contorno real.
const R2 = "https://pub-97f2474708304c9b9448b3766da91a46.r2.dev";
type Layer = ProjectConfig["layers"][number];
const derivado = (id: string, name: string, kind: Layer["kind"], folder: string, bounds: [number, number, number, number], minimumLevel: number, maximumLevel: number): Layer => ({
  id,
  name,
  description: "",
  kind,
  defaultVisible: false,
  legendMode: "embedded",
  exclusiveGroup: "derivados",
  source: {
    format: "tms",
    url: `${R2}/${folder}/{z}/{x}/{reverseY}.png`,
    credit: "Cardeal Map",
    bounds,
    minimumLevel,
    maximumLevel,
    tileWidth: 256,
    tileHeight: 256,
  },
});
const relevoBounds: [number, number, number, number] = [-45, -21.9430456, -44.2968749, -21.2893743];
const mdt = derivado("mdt", "Modelo Digital de Terreno", "dtm", "mdt", relevoBounds, 9, 18);
const mds = derivado("mds", "Modelo Digital de Superfície", "dsm", "mds", relevoBounds, 9, 18);
const declividade = derivado("declividade", "Declividade", "slope", "decli", relevoBounds, 9, 18);
// O tipo não tem "aspect"; "solar-orientation" é o kind do template para vertentes.
const aspecto = derivado("aspecto", "Orientação de Vertentes", "solar-orientation", "aspect", [-45, -21.9430456, -44.6484374, -21.6165793], 10, 19);

// Vetores (GeoJSON CRS84 no R2). A versão atual no R2 ainda não tem STRAHLER,
// comprimento_m, cota_m nem mestra: as feições usam o estilo base (stroke/
// strokeWidth) e os popups mostram só o título até o arquivo certo subir.
const curvas: Layer = {
  id: "curvas",
  name: "Curvas de Nível (3 m)",
  description: "",
  kind: "contours",
  defaultVisible: false,
  source: {
    format: "geojson",
    url: `${R2}/geojson/curvas_3m.geojson`,
    autoZoom: false,
    popup: { title: "Curva de nível", fields: [{ property: "cota_m", label: "Cota", suffix: " m", format: "integer" }] },
    style: {
      stroke: "#000000",
      strokeWidth: 1,
      clampToGround: true,
      zIndex: 5,
      classification: {
        property: "mestra",
        classes: {
          false: { stroke: "#000000", strokeWidth: 1 },
          true: { stroke: "#000000", strokeWidth: 2 },
        },
      },
    },
  },
};

// Estilo do Global Mapper por STRAHLER; sem a symbology simulated-drainage-strahler.
const drenagem: Layer = {
  id: "drenagem",
  name: "Drenagem",
  description: "",
  kind: "drainage",
  defaultVisible: false,
  source: {
    format: "geojson",
    url: `${R2}/geojson/linhas_drenagem.geojson`,
    autoZoom: false,
    popup: {
      title: "Drenagem",
      fields: [
        { property: "STRAHLER", label: "Ordem de Strahler", format: "integer" },
        { property: "comprimento_m", label: "Comprimento", decimals: 0, suffix: " m" },
      ],
    },
    style: {
      stroke: "#00E5FF",
      strokeWidth: 1,
      clampToGround: true,
      zIndex: 10,
      classification: {
        property: "STRAHLER",
        classes: {
          1: { stroke: "#00E5FF", strokeWidth: 1, zIndex: 10 },
          2: { stroke: "#14B8F0", strokeWidth: 1.6, zIndex: 11 },
          3: { stroke: "#1E88E5", strokeWidth: 2.4, zIndex: 12 },
          4: { stroke: "#1546D8", strokeWidth: 3.4, zIndex: 13 },
        },
      },
    },
  },
};

const perimetro: Layer = {
  id: "perimetro",
  name: "Perímetro da Área",
  description: "",
  kind: "property-boundary",
  defaultVisible: true,
  source: {
    format: "geojson",
    url: `${R2}/geojson/area_perimetro.geojson`,
    autoZoom: false,
    style: { stroke: "#FFD400", strokeWidth: 3, fillOpacity: 0, clampToGround: true, zIndex: 20 },
  },
};

// Metashape. Altura: ver comentário de heightOffsetMeters.
// Mesmo token do Bing, por isso VITE_CESIUM_ION_TOKEN.
const modelo: ProjectConfig["layers"][number] = {
  id: "modelo",
  name: "Modelo 3D",
  description: "",
  kind: "3d-tiles",
  defaultVisible: false,
  source: {
    format: "3d-tiles",
    source: "ion",
    assetId: 5140405,
    tokenEnv: "VITE_CESIUM_ION_TOKEN",
    clipping: {
      enabled: true,
      inverse: true,
      positions: [
        [-44.8583192, -21.9219800],
        [-44.8670679, -21.9166591],
        [-44.8711443, -21.9232125],
        [-44.8708877, -21.9245612],
        [-44.8641478, -21.9285609],
        [-44.8608793, -21.9249971],
      ],
    },
    // 0: modelo assenta no World Terrain sem offset. Referencial vertical do asset a
    // confirmar (exportação do Metashape ou configuração de upload no ion); não é o N do MAPGEO.
    heightOffsetMeters: 0,
    terrainCutout: false,
  },
};

export const project: ProjectConfig = {
  ...templateProject,
  id: "cyro",
  name: "Cyro",
  location: "Baependi-MG",
  // Área do projeto [W, S, E, N] em graus; define o limite de navegação.
  // Ausente = sem limite. Capture com "Capturar bounds da vista" (npm run dev).
  // Sem bounds por enquanto: o BoundingBox do XML do orto é um tile inteiro do
  // nível 11, não o contorno do ortomosaico. Capturar com o painel antes de ligar.
  // bounds: [W, S, E, N],
  // Opcional: navigation: { marginRatio: 0.25, maximumZoomDistance: 5000 },
  // Capture a vista final (cameraCapture). Ângulos em graus; altura em metros sobre o elipsoide.
  initialCamera: { longitude: -44.8698617, latitude: -21.9182845, height: 1694.0, heading: 125.73, pitch: -46.46, roll: 0.00 },
  // Ordem = empilhamento: o último item fica por cima.
  layers: [basemap, orto, mdt, mds, declividade, aspecto, curvas, drenagem, perimetro, modelo],
  scenes: [],
  diagnostic: { steps: [] },
  // Ferramentas só aparecem em npm run dev; desligue cameraCapture ao finalizar.
  developmentTools: { modelAlignment: false, cropAuthoring: false, cameraCapture: false },
};
