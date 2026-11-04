// Every landmark model: the generic kinds and the landmarks with their own (real-design) models.

import type { LandmarkKind } from '../../config/landmarks';
import type { LandmarkModel } from './kit';
import { GENERIC_CIVIC } from './genericCivic';
import { GENERIC_WORKS } from './genericWorks';
import { MODELS_EAST } from './east';
import { MODELS_NORTH } from './north';
import { MODELS_NORTHWEST } from './northwest';
import { MODELS_SOUTH } from './south';

export const GENERIC: Partial<Record<LandmarkKind, LandmarkModel>> = { ...GENERIC_WORKS, ...GENERIC_CIVIC };

export const MODELS: Record<string, LandmarkModel> = { ...MODELS_NORTHWEST, ...MODELS_SOUTH, ...MODELS_EAST, ...MODELS_NORTH };
