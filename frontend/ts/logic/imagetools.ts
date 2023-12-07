import * as canvaslib from "https://deno.land/x/canvas@v1.4.1/mod.ts"
import * as util from "../util.ts"

import type { 
    EmulatedCanvas2D, 
    Image as EmulatedImage,
    CanvasRenderingContext2D as EmulatedCanvasRenderingContext2D
} from "https://deno.land/x/canvas@v1.4.1/mod.ts";

//common types for both browser and deno
type Image  = HTMLImageElement|EmulatedImage
type Canvas = HTMLCanvasElement|EmulatedCanvas2D;
type CanvasContext2D = CanvasRenderingContext2D|EmulatedCanvasRenderingContext2D

export class ImageData extends Uint8ClampedArray {
    //readonly width:number;
    //readonly height:number;
    //readonly ordering: "CHW" | "HWC";

    constructor(
                 rgbdata:  Uint8ClampedArray,
        readonly height:   number, 
        readonly width:    number,
        readonly ordering: "CHW"|"HWC" = "HWC" ) {
            super(rgbdata.buffer)
    }
}


/** Create canvas of specified `size`. Native in browser or emulated in deno */
export 
function create_canvas(size:util.ImageSize):Canvas {
    if(util.is_deno()){
        return canvaslib.createCanvas(size.width, size.height);
    } else {
        const canvas:HTMLCanvasElement = document.createElement('canvas')
        canvas.width  = size.width;
        canvas.height = size.height;
        return canvas;
    }
}

export async function blob_to_image(blob:Blob): Promise<Image|Error> {
    if(util.is_deno()){
        const buffer:ArrayBuffer = await blob.arrayBuffer()
        try{
            return await canvaslib.loadImage(new Uint8Array(buffer))
        } catch(error) {
            return error;
        }
    } else {
        const image = new Image()
        image.src   = URL.createObjectURL(blob)
        await image.decode()
        return image;
    }
}


/** Load an image and return raw RGB data. Resize to `targetsize` if provided */
export async function blob_to_rgb(
    blob:Blob, targetsize?:util.ImageSize
): Promise<ImageData|Error> {
    const image:Image|Error  = await blob_to_image(blob);
    if(image instanceof Error)
        return image as Error
    
    if(!targetsize){
        //read the size from file
        targetsize = {
            width:  typeof image.width == 'number' ? image.width :image.width(), 
            height: typeof image.height == 'number'? image.height:image.height()
        };
    }

    const canvas:Canvas = create_canvas(targetsize)
    const ctx:CanvasContext2D|null = canvas.getContext('2d')
    if(ctx == null){
        return new Error('Could not create a canvas context')
    }
    
    //casting to make typescript happy
    (ctx as CanvasRenderingContext2D).drawImage(
        (image as HTMLImageElement), 0, 0, targetsize.width, targetsize.height
    )

    const rgba:Uint8ClampedArray = ctx.getImageData(
        0,0, targetsize.width, targetsize.height
    ).data
    
    const rgb: Uint8ClampedArray = rgba_to_rgb(rgba)
    return new ImageData(rgb, targetsize.height, targetsize.width, "HWC");
}


/** Remove the alpha channel from an array of RGBA values (HWC ordering) */
function rgba_to_rgb(data:Uint8ClampedArray): Uint8ClampedArray {
    const new_length:number = Math.floor(data.buffer.byteLength/4*3);
    const new_array  = new Uint8ClampedArray(new_length)
    
    // deno-lint-ignore no-inferrable-types
    let j:number = 0;
    // deno-lint-ignore no-inferrable-types
    for (let i:number = 0; i < data.length; i++) {
        if(i%4 != 3){
            new_array[j] = data[i]!;
            j++;
        }
    }
    return new_array;
}
