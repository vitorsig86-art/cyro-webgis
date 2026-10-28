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
  layers: [basemap, orto, modelo],
  scenes: [],
  diagnostic: { steps: [] },
  // Ferramentas só aparecem em npm run dev; desligue cameraCapture ao finalizar.
  developmentTools: { modelAlignment: false, cropAuthoring: false, cameraCapture: false },
};
