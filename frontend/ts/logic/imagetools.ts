import { denolibs } from "../dep.ts"
const canvaslib = denolibs.canvaslib;

import type {
    EmulatedCanvas2D, 
    EmulatedImage,
    EmulatedCanvasRenderingContext2D,
    CanvasKit
} from "../dep.ts"
import * as util from "../util.ts"


let _canvas:CanvasKit|undefined = undefined;
async function _init_canvaslib() {
    if(_canvas == undefined)
        _canvas = await canvaslib.init()
}


//common types for both browser and deno
export type Image    = HTMLImageElement|EmulatedImage
type Canvas          = HTMLCanvasElement|EmulatedCanvas2D;
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
export  async function create_canvas(size:util.ImageSize):Promise<Canvas> {
    if(util.is_deno()){
        await _init_canvaslib()
        return canvaslib.createCanvas(size.width, size.height);
    } else {
        const canvas:HTMLCanvasElement = document.createElement('canvas')
        canvas.width  = size.width;
        canvas.height = size.height;
        return canvas;
    }
}

/** Load and decode a file/blob into an image element. */
export async function blob_to_image(blob:Blob): Promise<Image|Error> {
    if(util.is_deno()){
        const buffer:ArrayBuffer = await blob.arrayBuffer()
        try{
            await _init_canvaslib()
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


/** Load an image from file/blob and return raw RGB data.
 *  Resize to `targetsize` if provided */
export async function blob_to_rgb(
    blob:Blob, targetsize?:util.ImageSize
): Promise<ImageData|Error> {
    const image:Image|Error  = await blob_to_image(blob);
    if(image instanceof Error)
        return image as Error
    else return image_to_rgb(image, targetsize);
}

/** Convert an image element to raw RGB data. Resize to `targetsize` if provided */
export async function image_to_rgb(
    image:Image, targetsize?:util.ImageSize|null
): Promise<ImageData|Error> {
    if(!targetsize){
        //read the size from file
        targetsize = get_image_size(image);
    }

    const canvas:Canvas = await create_canvas(targetsize)
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

/** Convert uint8 RGB data to float32 with values scaled from 0 to 1. */
export
function rgb_u8_to_f32(rgb_u8: Uint8Array|Uint8ClampedArray): Float32Array {
    const floatData = new Float32Array(rgb_u8.length);
    // deno-lint-ignore no-inferrable-types
    for (let i:number = 0; i < rgb_u8.length; i++) {
        floatData[i] = rgb_u8[i]! / 255;
    }
    return floatData;
}

export function f32_mono_to_rgba_u8(f32:Float32Array): Uint8ClampedArray {
    const u8 = new Uint8ClampedArray(f32.length * 4)

    // deno-lint-ignore no-inferrable-types
    for(let i:number = 0; i < f32.length; i++) {
        u8[i*4+0] = f32[i]! * 255;
        u8[i*4+1] = f32[i]! * 255;
        u8[i*4+2] = f32[i]! * 255;
        u8[i*4+3] = 255;
    }
    return u8;
}

export 
async function imagedata_to_dataurl(data:ImageData): Promise<string|Error> {
    if(data.length != 4 * data.width * data.height){
        return new Error('RGBA data required')
    }
    const size:util.ImageSize      = {width:data.width, height:data.height}
    const canvas:Canvas            = await create_canvas(size)
    const ctx:CanvasContext2D|null = canvas.getContext('2d')
    if(ctx == null){
        return new Error('Could not create a canvas context')
    }
    ctx.putImageData(
        {data, height:data.height, width:data.width, colorSpace:"srgb"}, 0, 0
    )
    return canvas.toDataURL('image/png');
}



/** Get the height and width of either HTMLImageElement or EmulatedImage */
export function get_image_size(image:Image): util.ImageSize {
    return {
        width:  typeof image.width == 'number' ? image.width :image.width(), 
        height: typeof image.height == 'number'? image.height:image.height()
    };
}

