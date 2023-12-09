
//NOTE: deno-only dependencies, this should not be bundled for the browser

export * as canvaslib from "https://deno.land/x/canvas@v1.4.1/src/canvas.ts"
export type { 
    EmulatedCanvas2D, 
    Image as EmulatedImage,
    CanvasRenderingContext2D as EmulatedCanvasRenderingContext2D,
    CanvasKit 
} from "https://deno.land/x/canvas@v1.4.1/src/canvas.ts";


