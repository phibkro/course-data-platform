import * as Option from 'effect/Option';
import * as Tracer from 'effect/Tracer';
import type * as Exit from 'effect/Exit';

import type { RuntimeTraceSpan, RuntimeTracing } from './source-cache';

const traceAttribute = (value: unknown): boolean | number | string | undefined => {
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

class CloudflareEffectSpan extends Tracer.NativeSpan {
  readonly #runtimeSpan: RuntimeTraceSpan;

  constructor(
    options: ConstructorParameters<typeof Tracer.NativeSpan>[0],
    tracing: RuntimeTracing & {
      startActiveSpan<Output>(name: string, callback: (span: RuntimeTraceSpan) => Output): Output;
    },
  ) {
    super(options);
    this.#runtimeSpan = tracing.startActiveSpan(options.name, (span) => span);
    this.#runtimeSpan.setAttribute('effect.span.kind', options.kind);
    const parent = Option.getOrUndefined(options.parent);
    if (parent !== undefined)
      this.#runtimeSpan.setAttribute('effect.parent.span_id', parent.spanId);
  }

  override attribute(key: string, value: unknown): void {
    super.attribute(key, value);
    this.#runtimeSpan.setAttribute(key, traceAttribute(value));
  }

  override event(name: string, startTime: bigint, attributes?: Record<string, unknown>): void {
    super.event(name, startTime, attributes);
    this.#runtimeSpan.setAttribute('effect.event', name);
  }

  override end(endTime: bigint, exit: Exit.Exit<unknown, unknown>): void {
    this.#runtimeSpan.setAttribute('effect.exit', exit._tag.toLowerCase());
    this.#runtimeSpan.end();
    super.end(endTime, exit);
  }
}

export interface EffectRuntimeTracing extends RuntimeTracing {
  startActiveSpan<Output>(name: string, callback: (span: RuntimeTraceSpan) => Output): Output;
}

export const makeCloudflareEffectTracer = (tracing: EffectRuntimeTracing): Tracer.Tracer =>
  Tracer.make({
    span: (options) => new CloudflareEffectSpan(options, tracing),
  });
