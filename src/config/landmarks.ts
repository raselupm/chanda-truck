// Real roadside landmarks, per start point, in road order from the district toward Dhaka.
// Each one is drawn beside the highway (world/Landmarks.ts) with a name board facing the truck.
// The legal stops (tolls, bridges) appear in the lists as { stop } markers so the landmarks around a
// bridge stay on the right bank of it: Rooppur comes straight after Lalon Shah Bridge, Gabtoli after Jamuna.
// Distances are compressed like the rest of the route: generateRoute spreads them between the markers.

import { LANDMARKS_EAST } from './landmarkData/east';
import { LANDMARKS_NORTH } from './landmarkData/north';
import { LANDMARKS_NORTHWEST } from './landmarkData/northwest';
import { LANDMARKS_SOUTH } from './landmarkData/south';

/** Generic models (world/landmarkModels/generic*.ts); a landmark with its own `model` uses that instead. */
export type LandmarkKind =
  | 'powerPlant' | 'factory' | 'cement' | 'sugarMill' | 'coldStorage' | 'brickKilns' | 'shipyard' | 'gasField' | 'oilDepot'
  | 'mosque' | 'madrasa' | 'temple' | 'buddhist' | 'mazar' | 'monument' | 'ruins' | 'cemetery'
  | 'university' | 'college' | 'cantonment' | 'govtBuilding' | 'jail' | 'hospital' | 'museum' | 'stadium'
  | 'station' | 'busTerminal' | 'market' | 'hotel' | 'airport' | 'riverGhat' | 'bridgeView' | 'flyover' | 'chattar' | 'gateSign'
  | 'park' | 'forest' | 'teaGarden' | 'lake';

/**
 * Footprint of each generic model: [length along the road, depth away from it], metres.
 * The site starts `LANDMARK.gap` beyond the road edge (plus the landmark's setback).
 */
export const LANDMARK_SIZE: Record<LandmarkKind, [number, number]> = {
  powerPlant: [110, 80], factory: [90, 55], cement: [90, 60], sugarMill: [80, 55], coldStorage: [50, 32],
  brickKilns: [70, 50], shipyard: [120, 90], gasField: [70, 55], oilDepot: [80, 55],
  mosque: [45, 40], madrasa: [60, 45], temple: [35, 30], buddhist: [45, 45], mazar: [35, 30], monument: [45, 40],
  ruins: [70, 55], cemetery: [60, 45],
  university: [80, 60], college: [60, 45], cantonment: [70, 50], govtBuilding: [50, 40], jail: [80, 60],
  hospital: [60, 45], museum: [50, 40], stadium: [100, 80],
  station: [90, 28], busTerminal: [70, 45], market: [60, 32], hotel: [60, 40], airport: [140, 100],
  riverGhat: [70, 50], bridgeView: [100, 90], flyover: [140, 30], chattar: [30, 24], gateSign: [24, 10],
  park: [70, 50], forest: [100, 60], teaGarden: [120, 70], lake: [80, 60],
};

export interface LandmarkDef {
  /** shown on the name board */
  nameBn: string;
  /** small second line on the board: the town or district */
  placeBn?: string;
  kind: LandmarkKind;
  /** its own model (world/landmarkModels/<corridor>.ts MODELS), drawn in place of the generic kind */
  model?: string;
  /** [length, depth] when the own model is bigger or smaller than the kind's */
  size?: [number, number];
  /** -1 = left, 1 = right of the road heading to Dhaka; random when not known */
  side?: -1 | 1;
  /** extra metres between the road and the site, for places set back from the highway */
  setback?: number;
  /** stands right after the stop before it in the list (Rooppur beside Lalon Shah Bridge) */
  pin?: boolean;
}

/** A legal stop (LegalStop id in route.ts) at this point of the list. */
export interface LandmarkStop {
  stop: string;
}

export type LandmarkEntry = LandmarkDef | LandmarkStop;

export const isStop = (e: LandmarkEntry): e is LandmarkStop => 'stop' in e;

/** Start point id → its landmarks in road order. */
export const LANDMARKS: Record<string, LandmarkEntry[]> = {
  ...LANDMARKS_NORTHWEST,
  ...LANDMARKS_SOUTH,
  ...LANDMARKS_EAST,
  ...LANDMARKS_NORTH,
};
