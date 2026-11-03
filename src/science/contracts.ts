/** Frozen design contract only. No ephemeris, time conversion, or physical values loaded in phase 0. */
export type Vec3 = readonly [number, number, number];
export interface Provenance {
  sourceId: string; url: string; retrievedAtUtc: string; version: string;
  sha256: string; processing: readonly string[];
}
export interface Quantity<U extends string> {
  value: number; unit: U; source: Provenance;
  uncertainty: { kind: 'exact' } | { kind: 'unknown' } | { kind: 'absolute'; value: number; unit: U };
}
export interface EphemerisState {
  kind: 'ephemeris'; targetId: string; centerId: '0';
  frame: 'ICRF'; referencePlane: 'FRAME'; correction: 'NONE';
  epoch: { value: number; unit: 's'; scale: 'TDB'; origin: 'J2000_TDB' };
  position: { value: Vec3; unit: 'km' }; velocity: { value: Vec3; unit: 'km/s' };
  coverage: { startTdbSeconds: number; endTdbSeconds: number; unit: 's' };
  source: Provenance;
}
export interface BodyPhysicalRecord {
  id: string; classification: 'star' | 'planet' | 'satellite' | 'dwarf-planet' | 'small-body';
  classificationSource: Provenance;
  meanRadius: Quantity<'km'> | null; equatorialRadius: Quantity<'km'> | null;
  gm: Quantity<'km^3/s^2'> | null; mass: Quantity<'kg'> | null;
  // Unknown is null, never zero. Rotation is a sourced orientation model, not invented speed.
  orientationModel: { kernel: Provenance; frameId: string } | null;
}
export interface ExperimentState {
  kind: 'hypothetical-experiment'; experimentId: string;
  elapsed: { value: number; unit: 's' }; step: { value: number; unit: 's' };
  bodies: readonly { id: string; mass: Quantity<'kg'>; positionKm: Vec3; velocityKmPerS: Vec3 }[];
  integrator: 'velocity-verlet' | 'leapfrog';
}
export type DisplayPolicy =
  | { mode: 'scientific'; kmPerRenderUnit: number }
  | { mode: 'exploration'; distanceLaw: 'log1p'; referenceKm: number; renderRadiusGain: number; label: '非线性距离 · 尺寸放大' }
  | { mode: 'local'; anchorId: string; kmPerRenderUnit: number };
