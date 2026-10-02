/**
 * PkgDiet - Alternatives Engine (Node/ESM Entrypoint)
 * Registers the packaged dataset and exports the core functions.
 */

import alternativesData from '../data/alternatives.json' with { type: 'json' };
import { injectAlternatives } from './alternatives-core.js';

injectAlternatives(alternativesData);

// Re-export everything from core
export * from './alternatives-core.js';
