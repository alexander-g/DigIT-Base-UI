import { denolibs, UTIF } from "../dep.ts"
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
            // fcking typescript
            super(rgbdata.buffer as unknown as Uint8ClampedArray)
    }
}


const _canvaslist: Canvas[] = []

function _clean_up_canvaslist() {
    let i:number;
    for(i = _canvaslist.length - 1; i >=0; i--){
        const canvas:Canvas = _canvaslist[i]!
        if('dispose' in canvas)
            canvas.dispose();
        
        _canvaslist.splice(i, 1);
    }
}


/** Create canvas of specified `size`. Native in browser or emulated in deno */
export  async function create_canvas(size:util.ImageSize):Promise<Canvas> {
    _clean_up_canvaslist()

    let canvas: Canvas;
    if(util.is_deno()){
        await _init_canvaslib()
        canvas = canvaslib.createCanvas(size.width, size.height);
    } else {
        canvas = document.createElement('canvas')
        canvas.width  = size.width;
        canvas.height = size.height;
    }
    _canvaslist.push(canvas);
    return canvas;
}

/** Load and decode a file/blob into an image element. */
export async function blob_to_image(blob:Blob): Promise<Image|Error> {
    if(util.is_deno()){
        const buffer:ArrayBuffer = await blob.arrayBuffer()
        try{
            await _init_canvaslib()
            return await canvaslib.loadImage(new Uint8Array(buffer))
        } catch(error) {
            return error as Error;
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
    blob:        Blob|File, 
    targetsize?: util.ImageSize
): Promise<ImageData|Error> {
    if(is_tiff_file(blob)){
        if(targetsize != undefined)
            return new Error(
                'Cannot specify a target size for tiff images (not implemented)'
            )
        
        const imagedata:globalThis.ImageData|null = await load_tiff_file(blob);
        if(imagedata == null)
            return new Error('Could not load tiff image')
        
        const rgb:Uint8ClampedArray = rgba_to_rgb(imagedata.data)
        return new ImageData(rgb, imagedata.height, imagedata.width, 'HWC')
    }

    const image:Image|Error  = await blob_to_image(blob);
    if(image instanceof Error)
        return image as Error
    else return image_to_rgb(image, targetsize);
}


type CanvasAndContext = {canvas:Canvas, context:CanvasContext2D}

async function image_to_canvas(
    image:       Image, 
    targetsize?: util.ImageSize|null
): Promise<CanvasAndContext|Error> {
    if(!targetsize){
        //read the size from file
        targetsize = get_image_size(image);
    }

    const canvas:Canvas = await create_canvas(targetsize)  //TODO: canvas.dispose()
    const ctx:CanvasContext2D|null = canvas.getContext('2d')
    if(ctx == null){
        return new Error('Could not create a canvas context')
    }
    
    //casting to make typescript happy
    (ctx as CanvasRenderingContext2D).drawImage(
        (image as HTMLImageElement), 0, 0, targetsize.width, targetsize.height
    )

    return {canvas, context:ctx};
}


/** Convert an image element to raw RGB data. Resize to `targetsize` if provided */
export async function image_to_rgb(
    image:Image, 
    targetsize?:util.ImageSize|null
): Promise<ImageData|Error> {
    const canvas: CanvasAndContext|Error = await image_to_canvas(image, targetsize)
    if(canvas instanceof Error)
        return canvas;
    
    if(!targetsize){
        //read the size from file
        targetsize = get_image_size(image);
    }
    const rgba:Uint8ClampedArray = canvas.context.getImageData(
        0,0, targetsize.width, targetsize.height
    ).data
    
    const rgb: Uint8ClampedArray = rgba_to_rgb(rgba)
    return new ImageData(rgb, targetsize.height, targetsize.width, "HWC");
}

/** Convert an image element to blob. Resize to `targetsize` if provided */
export async function image_to_blob(
    image:       Image, 
    targetsize?: util.ImageSize|null
): Promise<Blob|Error> {
    const canvas: CanvasAndContext|Error = await image_to_canvas(image, targetsize)
    if(canvas instanceof Error)
        return canvas;
    
    return canvas_to_blob(canvas.canvas)
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

/** Convert uint8 RGB data to uint8 RGBA */
export
function rgb_u8_to_rgba(rgb_u8: Uint8Array|Uint8ClampedArray): Uint8ClampedArray {
    const rgba_size:number = rgb_u8.length / 3 * 4
    const rgba_data = new Uint8ClampedArray(rgba_size);
    // deno-lint-ignore no-inferrable-types
    for (let i:number = 0, j:number=0; i < rgb_u8.length; i+=3, j+=4) {
        rgba_data[j+0] = rgb_u8[i+0]!;
        rgba_data[j+1] = rgb_u8[i+1]!;
        rgba_data[j+2] = rgb_u8[i+2]!;
        rgba_data[j+3] = 255;
    }
    return rgba_data;
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
async function imagedata_to_blob(data:ImageData): Promise<Blob|Error> {
    if(data.length != 4 * data.width * data.height){
        return new Error('RGBA data required')
    }
    const size:util.ImageSize      = {width:data.width, height:data.height}
    const canvas:Canvas            = await create_canvas(size)
    const ctx:CanvasContext2D|null = canvas.getContext('2d')
    if(ctx == null){
        return new Error('Could not create a canvas context')
    }
    const imagedata:globalThis.ImageData
        = util.is_deno()
            ? {data, height:data.height, width:data.width, colorSpace:"srgb"}
            : new globalThis.ImageData(data, data.width, data.height)
    //TODO: memory access out of bounds after several calls
    ctx.putImageData(imagedata, 0, 0)
    const resultblob:Blob|Error = await canvas_to_blob(canvas)
    // if('dispose' in canvas)
    //     canvas.dispose();
    return resultblob;
}

/** Get image data from either HTMLImageElement or EmulatedImage as a blob  */
async function canvas_to_blob(canvas:Canvas): Promise<Blob|Error> { //TODO: jpeg
    if('toBlob' in canvas) {
        return new Promise( (resolve: (b:Blob|Error) => void ) => {
            canvas.toBlob((b:Blob|null) => {
                if(b == null)
                    resolve(new Error('Failed to convert image data to blob'))
                else 
                    resolve(b)
            }, 'image/png')
        } )
        
    } else {
        return await new Blob([canvas.toBuffer('image/png')])
    }
}



/** Get the height and width of either HTMLImageElement or EmulatedImage */
export function get_image_size(image:Image): util.ImageSize {
    return {
        width:  typeof image.width == 'number' ? image.width :image.width(), 
        height: typeof image.height == 'number'? image.height:image.height()
    };
}



export function is_tiff_file(x:Blob|File): boolean {
    return (
        x.type == 'image/tiff' 
        || 'name' in x && (/\.tif[f]?$/).test(x.name)
    )
}

export async function is_bigtiff(x:Blob): Promise<boolean> {
    const header:Blob = x.slice(0, 4);
    const buffer:ArrayBuffer = await header.arrayBuffer();
    const view = new Uint8Array(buffer);
    
    if (view.length < 4) {
        return false;
    }
    
    // little-endian BigTIFF: "II\x2B\x00"
    const littleEndianBigTIFF:boolean = (
        view[0] === 0x49 
        && view[1] === 0x49 
        && view[2] === 0x2B 
        && view[3] === 0x00
    )
                                    
    // big-endian BigTIFF: "MM\x00\x2B"
    const bigEndianBigTIFF:boolean = (
        view[0] === 0x4D 
        && view[1] === 0x4D 
        && view[2] === 0x00 
        && view[3] === 0x2B
    )
    return littleEndianBigTIFF || bigEndianBigTIFF;
}

export async function load_tiff_file(
    file:    Blob, 
    // deno-lint-ignore no-inferrable-types
    page_nr: number = 0,
): Promise<globalThis.ImageData|null> {
    const buffer: ArrayBuffer = await file.arrayBuffer()
    const pages: UTIF.IFD[]   = UTIF.decode(buffer)
    if(pages.length > page_nr){
        const page: UTIF.IFD  = pages[page_nr]!
        // deno-lint-ignore no-explicit-any
        const console_log:any = console.log;
        try {
            //replacing console.log because UTIF doesnt care about logging
            console.log = () => {}
            UTIF.decodeImage(buffer, page)
        } catch(_error) {
            return null;
        } finally {
            console.log = console_log
        }
        const rgba: Uint8ClampedArray  = Uint8ClampedArray.from(UTIF.toRGBA8(page));
        if(globalThis.ImageData)
            return new globalThis.ImageData(rgba, page.width, page.height)
        else
            //deno
            return {
                data:   Uint8ClampedArray.from(rgba),
                width:  page.width,
                height: page.height,
                colorSpace: 'srgb',
            }
    }
    return null;
}

export async function is_png(blob:Blob): Promise<boolean> {
    const headerblob:Blob = blob.slice(0, 8);
  
    try {
        const buffer:ArrayBuffer = await headerblob.arrayBuffer();
        if (buffer.byteLength !== 8) {
            return false;
        }
  
        const view = new DataView(buffer);
        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        const expected_signature:number[] = 
            [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  
        for (let i:number = 0; i < expected_signature.length; i++) {
            if (view.getUint8(i) !== expected_signature[i]) {
                return false;
            }
        }
        return true;
    } catch (_error) {
        return false;
    }
}


export async function get_jpg_size(blob: Blob): Promise<[number, number]|Error>{
    const buffer:ArrayBuffer = await blob.slice(0, blob.size).arrayBuffer();
    const dataview = new DataView(buffer);

    // Csheck for JPEG signature
    if (dataview.getUint8(0) !== 0xff || dataview.getUint8(1) !== 0xd8) {
        return new Error("Not a valid JPEG file");
    }

    let offset:number = 2;
    while (offset < dataview.byteLength) {
        const marker:number = dataview.getUint8(offset);
        if (marker !== 0xff) {
            return new Error("Invalid JPEG format");
        }
        const markerType:number = dataview.getUint8(offset + 1);
        if (markerType === 0xc0 || markerType === 0xc2) {
            const height:number = dataview.getUint16(offset + 5);
            const width:number = dataview.getUint16(offset + 7);
            return [width, height];
        } else {
            const length:number = dataview.getUint16(offset + 2);
            offset += length + 2; // Move to the next segment
        }
    }
    return new Error("No valid size found");
}

export async function get_png_size(blob: Blob): Promise<[number, number]|Error>{
    const signatureslice:Blob = blob.slice(0, 8);
    const signature = new Uint8Array(await signatureslice.arrayBuffer());

    // Check PNG signature
    const valid_png:boolean = 
        signature[0] == 137 
        && signature[1] == 80
        && signature[2] == 78
        && signature[3] == 71
        && signature[4] == 13
        && signature[5] == 10
        && signature[6] == 26
        && signature[7] == 10
    if (!valid_png)
        return new Error("Not a valid PNG file");

    
    let offset:number = 8;
    while (true) {
        const lengthslice:Blob = blob.slice(offset, offset + 4);
        const lengthbuffer:ArrayBuffer = await lengthslice.arrayBuffer();
        const length:number = new DataView(lengthbuffer).getUint32(0, false);   // can throw, check buffer size
        offset += 4;

        const chunktypeslice:Blob = blob.slice(offset, offset + 4);
        const chunktypebuffer:ArrayBuffer = await chunktypeslice.arrayBuffer();
        const chunktype:string = 
            String.fromCharCode(...new Uint8Array(chunktypebuffer));

        if (chunktype === 'IHDR') {
            const widthslice:Blob = blob.slice(offset + 4, offset + 8);
            const widthbuffer:ArrayBuffer = await widthslice.arrayBuffer();
            const width:number = new DataView(widthbuffer).getUint32(0, false); // can throw, check buffer size

            const heightslice:Blob = blob.slice(offset + 8, offset + 12);
            const heightbuffer:ArrayBuffer = await heightslice.arrayBuffer();
            const height:number = new DataView(heightbuffer).getUint32(0, false) // can throw, check buffer size

            return [width, height];
        } else {
            // Skip the chunk data and CRC
            offset += length + 12; // 4 bytes for length, 4 for type, 4 for CRC
        }
    }
}

