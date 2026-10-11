/**
 * A spring tuned the way designers describe one: `response` is how long one
 * swing takes in seconds, `dampingRatio` how much of the swing survives. At 1
 * it settles without overshooting; just below 1 it overshoots a hair and
 * settles, which is what lets motion read as a physical object.
 */
export interface SpringConfig {
  response: number;
  dampingRatio: number;
}

/**
 * How long a velocity must stay under `restDistance` to count as at rest, in
 * seconds: motion that would cover less than that in 50 ms is invisible.
 */
const REST_HORIZON = 0.05;

/**
 * A damped spring solved in closed form instead of stepped frame by frame, so
 * its state is a function of the clock alone. A frame lost to a busy main
 * thread skips ahead rather than stretching the motion out, and retargeting
 * mid-flight starts from the exact position and velocity of that instant, so
 * an interrupted motion bends smoothly instead of restarting a curve.
 *
 * Times are on the performance clock in ms; velocities are per second.
 */
export class Spring {
  private from = 0;
  private velocity = 0;
  private to = 0;
  private start = 0;
  private config: SpringConfig;
  private readonly restDistance: number;

  /** `restDistance` is the offset from the target too small to see, in the spring's unit. */
  constructor(config: SpringConfig, restDistance = 0.05) {
    this.config = config;
    this.restDistance = restDistance;
  }

  get target() {
    return this.to;
  }

  /** Settled on its target, as `settle` or `jump` leave it. */
  get resting() {
    return this.from === this.to && this.velocity === 0;
  }

  /** Position and velocity at `time`. */
  sample(time: number): [position: number, velocity: number] {
    const offset = this.from - this.to;
    const speed = this.velocity;
    if (offset === 0 && speed === 0) return [this.to, 0];

    const { response, dampingRatio } = this.config;
    const omega = (2 * Math.PI) / response;
    const t = Math.max(0, time - this.start) / 1000;

    if (dampingRatio < 1) {
      const decay = dampingRatio * omega;
      const frequency = omega * Math.sqrt(1 - dampingRatio * dampingRatio);
      const swing = (speed + decay * offset) / frequency;
      const envelope = Math.exp(-decay * t);
      const cos = Math.cos(frequency * t);
      const sin = Math.sin(frequency * t);

      return [
        this.to + envelope * (offset * cos + swing * sin),
        envelope *
          ((swing * frequency - decay * offset) * cos -
            (offset * frequency + decay * swing) * sin),
      ];
    }

    const drift = speed + omega * offset;
    const envelope = Math.exp(-omega * t);

    return [
      this.to + (offset + drift * t) * envelope,
      (speed - omega * drift * t) * envelope,
    ];
  }

  /** Sets off from `position` at `velocity` towards `target`. */
  launch(
    position: number,
    velocity: number,
    target: number,
    time: number,
    config = this.config,
  ) {
    this.from = position;
    this.velocity = velocity;
    this.to = target;
    this.start = time;
    this.config = config;
  }

  /** Heads somewhere new from wherever the motion is at `time`, keeping its momentum. */
  retarget(target: number, time: number, config = this.config) {
    if (target === this.to && config === this.config) return;
    const [position, velocity] = this.sample(time);
    this.launch(position, velocity, target, time, config);
  }

  /** Puts the spring at rest on `position`. */
  jump(position: number) {
    this.launch(position, 0, position, 0);
  }

  /** The position at `time`, ending the motion on target once it is too close to see. */
  settle(time: number): [position: number, moving: boolean] {
    const [position, velocity] = this.sample(time);
    const resting =
      Math.abs(position - this.to) < this.restDistance &&
      Math.abs(velocity) * REST_HORIZON < this.restDistance;

    if (!resting) return [position, true];

    this.jump(this.to);
    return [this.to, false];
  }
}
