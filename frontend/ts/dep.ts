import * as preact      from "https://esm.sh/preact@10.11.3"
import JSX = preact.JSX;
export { preact, type JSX };

//make preact global (for javascript)
globalThis.preact = preact;

//export * as hooks       from "https://esm.sh/preact@10.11.3/hooks";
import * as signals     from "https://esm.sh/@preact/signals@1.1.3?deps=preact@10.11.3";
import Signal           = signals.Signal;
type ReadonlySignal<T>  = signals.ReadonlySignal<T>;
export { signals, Signal, type ReadonlySignal }




//export { default as UTIF } from 'https://cdn.skypack.dev/utif@3.1.0?dts'

//NOTE: utif2 better at jpeg decompression, esm.sh versions hang in deno
export { default as UTIF } from 'https://cdn.skypack.dev/utif2@4.0.1?dts'

export * as fflate from "https://esm.sh/fflate@0.7.4"

import "./jquery_mock.ts"
