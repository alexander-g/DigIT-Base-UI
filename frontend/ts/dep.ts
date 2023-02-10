export * as preact      from "https://esm.sh/preact@10.11.3"
//export * as hooks       from "https://esm.sh/preact@10.11.3/hooks";
export * as signals     from "https://esm.sh/@preact/signals@1.1.3";

//export { default as UTIF } from 'https://cdn.skypack.dev/utif@3.1.0?dts'

//NOTE: utif2 better at jpeg decompression, esm.sh versions hang in deno
// @deno-types="https://cdn.jsdelivr.net/npm/utif2@4.0.1/UTIF.d.ts"
export { default as UTIF } from 'https://cdn.skypack.dev/utif2@4.0.1?dts'
