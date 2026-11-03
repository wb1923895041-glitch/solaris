export interface TimeParameters { DELTA_T_A: number[]; K: number[]; EB: number[]; M: number[]; DELTA_AT: number[] }
export class TimeSystem {
  readonly startMs: number; readonly endMs: number;
  constructor(readonly parameters: TimeParameters, startUtc: string, endUtc: string) {
    this.startMs = Date.parse(startUtc); this.endMs = Date.parse(endUtc);
  }
  parse(utc: string): number {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(utc)) throw new Error('请输入 ISO UTC 日期，须含秒与 Z；不支持闰秒字面量');
    const ms = Date.parse(utc);
    if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0,19) !== utc.slice(0,19)) throw new Error('无效日历日期');
    this.check(ms); return ms;
  }
  check(ms: number) { if (!Number.isFinite(ms) || ms < this.startMs || ms > this.endMs) throw new Error('日期超出已核验数据窗：2024-01-01 至 2031-01-01 UTC'); }
  utcToTdb(ms: number): number {
    this.check(ms);
    // NAIF naif0012.tls DELTET: valid here after the 2017 leap second.
    // Future announced leap seconds require a regenerated cache and updated LSK.
    const p=this.parameters, nominal=(ms-Date.UTC(2000,0,1,12))/1000;
    const base=p.DELTA_T_A[0]+p.DELTA_AT[p.DELTA_AT.length-2];
    let et=nominal+base;
    for(let i=0;i<5;i++) { const m=p.M[0]+p.M[1]*et; et=nominal+base+p.K[0]*Math.sin(m+p.EB[0]*Math.sin(m)); }
    return et;
  }
  format(ms: number) { return new Date(ms).toISOString().replace('T',' ').replace('.000Z',' UTC'); }
}
export class TimeController {
  utcMs: number; playing=false; rate=86400; private anchorReal=0; private anchorUtc=0;
  constructor(readonly time: TimeSystem, readonly defaultUtcMs: number) { this.utcMs=defaultUtcMs; }
  tick(realMs: number) {
    if(this.playing) {
      const next=this.anchorUtc+(realMs-this.anchorReal)*this.rate;
      this.utcMs=Math.max(this.time.startMs,Math.min(this.time.endMs,next));
      if(next<=this.time.startMs || next>=this.time.endMs) this.playing=false;
    }
    return this.utcMs;
  }
  play(playing: boolean, realMs: number) { this.tick(realMs); this.playing=playing; this.anchorReal=realMs; this.anchorUtc=this.utcMs; }
  setRate(rate: number, realMs: number) { if(!Number.isFinite(rate)) throw new Error('无效倍率'); this.tick(realMs); this.rate=rate; this.anchorReal=realMs; this.anchorUtc=this.utcMs; }
  jump(ms: number, realMs: number) { this.time.check(ms); this.utcMs=ms; this.anchorReal=realMs; this.anchorUtc=ms; }
  reset(realMs: number) { this.playing=false; this.jump(this.defaultUtcMs,realMs); }
}
