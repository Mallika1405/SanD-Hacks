"use client";
/** Rolling in-memory audio buffer (last ~60s as 30s segments). Segments are uploaded only after trigger(). */
export class RollingRecorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private segs: Blob[] = [];
  private chunks: Blob[] = [];
  private timer: any;
  private running = false;
  persisting = false;
  onSegment?: (b: Blob) => void;

  async start() {
    if (this.running) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.running = true;
    this.begin();
  }
  private begin() {
    if (!this.stream) return;
    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
    const rec = new MediaRecorder(this.stream, { mimeType: mime });
    this.chunks = [];
    rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    rec.onstop = () => {
      const b = new Blob(this.chunks, { type: mime });
      this.segs.push(b); if (this.segs.length > 2) this.segs.shift();
      if (this.persisting) this.onSegment?.(b);
      if (this.running) this.begin();
    };
    rec.start(); this.rec = rec;
    this.timer = setTimeout(() => rec.state === "recording" && rec.stop(), 30_000);
  }
  /** Start persisting: upload buffered segments now, then each new segment as it completes. */
  trigger() {
    if (this.persisting) return;
    this.persisting = true;
    this.segs.forEach((b) => this.onSegment?.(b));
    clearTimeout(this.timer);
    if (this.rec?.state === "recording") this.rec.stop();
  }
  stop() {
    this.running = false; this.persisting = false; clearTimeout(this.timer);
    try { if (this.rec?.state === "recording") this.rec.stop(); } catch {}
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null; this.segs = []; this.chunks = [];
  }
}
