import * as preact      from "https://esm.sh/preact@10.25.0"
import JSX = preact.JSX;
export { preact, type JSX };

//make preact global (for javascript)
// @ts-ignore used only for debugging
globalThis.preact = preact;

import * as signals from "https://esm.sh/@preact/signals@1.3.1?deps=preact@10.25.0,@preact/signals-core@1.7.0";
import Signal           = signals.Signal;
type ReadonlySignal<T>  = signals.ReadonlySignal<T>;
export { signals, Signal, type ReadonlySignal }




// @deno-types="https://raw.githubusercontent.com/alexander-g/wasm-big-image/refs/tags/v2026-10-07/wasm-big-image.d.ts"
export { 
    initialize as wasm_big_image_initialize,
    type BigImage,
    type Image,
} from "https://raw.githubusercontent.com/alexander-g/wasm-big-image/refs/tags/v2026-10-07/wasm-big-image.js"




// TODO: remove
//export { default as UTIF } from 'https://cdn.skypack.dev/utif@3.1.0?dts'

//NOTE: utif2 better at jpeg decompression
// @deno-types="https://gist.githubusercontent.com/alexander-g/9a29620733b53d7a72992098fd0b9761/raw/2984712c54977c9a0b906b2d6c38bd75d5201f2a/UTIF.d.ts"
export { default as UTIF } from 'https://esm.sh/utif2@4.1.0?target=es2022&no-dts'

export * as fflate from "https://esm.sh/fflate@0.7.4"

//for side-effects
import "./jquery_mock.ts";



export * as ort from "npm:onnxruntime-web@1.22.0";



export * as denolibs from "./dep.deno.ts"
export type { 
    EmulatedCanvas2D, 
    EmulatedImage,
    EmulatedCanvasRenderingContext2D,
    CanvasKit
} from "./dep.deno.ts";


