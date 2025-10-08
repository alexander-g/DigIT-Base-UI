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
        try{
            await image.decode()
        } catch (error) {
            return error as Error;
        }
        return image;
    }
}


/** Load an image from file/blob and return raw RGB data.
 *  Resize to `targetsize` if provided */
export async function blob_to_rgb(
    blob:        Blob|File, 
    targetsize?: util.ImageSize
): Promise<ImageData|Error> {
    if(await is_tiff_file(blob)){
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
        0,0, targetsize.width, targetsize.height                                                    // TODO: probably not correct?
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
export
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


export async function resize_imagefile(
    imagefile: File, 
    size:      util.ImageSize,
): Promise<File|Error> {
    const rgb:ImageData|Error = await blob_to_rgb(imagefile, size)
    if(rgb instanceof Error)
        return rgb as Error;
    
    const rgba:ImageData = 
        new ImageData(rgb_u8_to_rgba(rgb), size.height, size.width, "HWC");
    const blob:Blob|Error = await imagedata_to_blob(rgba)
    if(blob instanceof Error)
        return blob as Error;
    
    return new File([blob], imagefile.name, {type:imagefile.type})
}



export async function is_tiff_file(x:Blob): Promise<boolean> {
    const tifftype: TiffType|Error = await get_tiff_type(x)
    return !(tifftype instanceof Error)
}

export async function is_bigtiff(x:Blob): Promise<boolean> {
    const tifftype: TiffType|Error = await get_tiff_type(x)
    if(tifftype instanceof Error)
        return false;
    //else
    return tifftype.bigtiff;
}

export type TiffType = {
    endian: 'little'|'big';
    bigtiff: boolean;
}

export async function get_tiff_type(x:Blob): Promise<TiffType|Error> {
    const endianbytes:Uint8Array = new Uint8Array(
        await x.slice(0,2).arrayBuffer()
    )
    if(endianbytes.byteLength < 2)
        return new Error('Unexpected EOF');
    
    let endian:'little'|'big';
    if(endianbytes[0] == 0x49 && endianbytes[1] == 0x49)
        endian = 'little';
    else if(endianbytes[0] == 0x4D && endianbytes[1] == 0x4D)
        endian = 'big';
    else
        return new Error('Invalid TIFF')
    
    const versionview = new DataView(await x.slice(2,4).arrayBuffer())
    if(versionview.byteLength < 2)
        return new Error('Unexpected EOF')
    
    const version:number = versionview.getUint16(0, endian == 'little')
    let bigtiff:boolean;
    if(version == 42)
        bigtiff = false;
    else if(version == 43)
        bigtiff = true;
    else
        return new Error('Invalid TIFF')
    
    return {endian, bigtiff}
}


/** Maximum safe 'number' */
const MAX_SAFE_INTEGER = 9007199254740991;

async function read_uint_from_blob(
    x:      Blob, 
    offset: number, 
    length: 1|2|4|8, 
    endian: 'little'|'big'
): Promise<number|Error> {
    x = x.slice(offset, offset+length)
    if(x.size < length)
        return new Error('Unexpected EOF')
    
    const view = new DataView(await x.arrayBuffer())
    if(length == 1)
        return view.getUint8(0)
    else if(length == 2)
        return view.getUint16(0, endian == 'little')
    else if(length == 4)
        return view.getUint32(0, endian == 'little')
    else if(length == 8){
        const as_bigint:bigint = view.getBigUint64(0, endian == 'little')
        if(as_bigint > MAX_SAFE_INTEGER)
            return new Error('Number too large')
        return Number(as_bigint);
    }
    else return new Error('Invalid byte length')
}

export async function get_tiff_size(x:Blob): Promise<util.ImageSize|Error> {
    const tifftype: TiffType|Error = await get_tiff_type(x)
    if(tifftype instanceof Error)
        return tifftype as Error;
    
    // skip the first 4 bytes (signature)
    //x = x.slice(4)
    let off:number = 4;

    const little_end: boolean = (tifftype.endian == 'little')
    const bigtiff: boolean = tifftype.bigtiff;
    
    // Read the offset to the first IFD
    let ifd_offset: number;
    if(!bigtiff){
        const offsetview = new DataView(await x.slice(off,off+4).arrayBuffer())
        if(offsetview.byteLength < 4)
            return new Error('Unexpected EOF')
        
        ifd_offset = offsetview.getUint32(0, little_end)
    } else {
        // if it's BigTIFF, there should be an extra 4 bytes, offset is then 8
        const offsetview = new DataView(await x.slice(off+4,off+4+8).arrayBuffer())
        if(offsetview.byteLength < 8)
            return new Error('Unexpected EOF')
        
        const ifd_offset_bigint:bigint = offsetview.getBigUint64(0, little_end)
        if(ifd_offset_bigint > MAX_SAFE_INTEGER)
            return new Error('File to large')
        ifd_offset = Number(ifd_offset_bigint);
    }

    off = ifd_offset;
    let len:1|2|4|8 = (bigtiff? 8 : 2)
    const num_entries:number|Error = 
        await read_uint_from_blob(x, off, len, tifftype.endian)
    if(num_entries instanceof Error)
        return num_entries as Error;
    
    off = off + len;
    
    let width:  number|undefined = undefined;
    let height: number|undefined = undefined;
    for(let i:number = 0; i < num_entries; i++) {
        const tag:number|Error = 
            await read_uint_from_blob(x, off,   2, tifftype.endian)
        if(tag instanceof Error)
            return tag as Error;
        
        // not used:
        // const field_type:number|Error = 
        //     await read_uint_from_blob(x, off+2, 2, tifftype.endian)
        len = (bigtiff? 8 : 4)
        const count:number|Error = 
            await read_uint_from_blob(x, off+4, len, tifftype.endian)
        if(count instanceof Error)
            return count as Error;
        const value_offset:number|Error = 
            await read_uint_from_blob(x, off+4+len, len, tifftype.endian)
        if(value_offset instanceof Error)
            return value_offset as Error;
        
        off = off + 4 + len + len;
        
        if(tag == 256){  // ImageWidth
            if(count == 1)
                width = value_offset;
            else
                return new Error(`Unexpected IFD count in tag ImageWidth: ${count}`)
        } else if (tag == 257){ // ImageLength
            if(count == 1)
                height = value_offset;
            else
                return new Error(`Unexpected IFD count in tag ImageLength: ${count}`)
        }

        if(width != undefined && height != undefined)
            break;
    }

    if(width == undefined || height == undefined)
        return new Error('Image size not found')
    
    return {width, height};
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

/** Check if blob/file is a png file without reading the full file */
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



export async function is_jpg_file(x:Blob): Promise<boolean> {
    const signature = new Uint8Array(await x.slice(0, 2).arrayBuffer());
    if(signature.length < 2)
        return false;
    
    const is_jpg:boolean = (signature[0] == 0xff) && (signature[1] == 0xd8)
    return is_jpg;
}


/** Read the image size from a jpg blob/file without reading the full file */
export async function get_jpg_size(blob: Blob): Promise<util.ImageSize|Error>{
    if(! (await is_jpg_file(blob)) )
        return new Error("Not a valid JPEG file")

    let offset:number = 2;
    while (offset < blob.size) {
        const marker:number|Error = 
            await read_uint_from_blob(blob, offset, 1, 'big');
        if (marker !== 0xff) {
            return new Error("Invalid JPEG format");
        }

        const markerType:number|Error = 
            await read_uint_from_blob(blob, offset+1, 1, 'big');
        if(markerType instanceof Error)
            return markerType as Error;
        
        if (markerType === 0xc0 || markerType === 0xc2) {
            const height:number|Error = 
                await read_uint_from_blob(blob, offset+5, 2, 'big');
            if(height instanceof Error)
                return height as Error;
            
            const width:number|Error = 
                await read_uint_from_blob(blob, offset+7, 2, 'big');
            if(width instanceof Error)
                return width as Error;
            
            return {width, height};
        } else {
            const length:number|Error = 
                await read_uint_from_blob(blob, offset+2, 2, 'big');
            if(length instanceof Error)
                return length as Error;
            
            offset += length + 2; // Move to the next segment
        }
    }
    return new Error("No valid size found");
}

/** Read the image size from a png blob/file without reading the full file */
export async function get_png_size(blob: Blob): Promise<util.ImageSize|Error>{
    // Check PNG signature
    const valid_png:boolean = await is_png(blob)
    if (!valid_png)
        return new Error("Not a valid PNG file");
    
    let offset:number = 8;
    while (true) {
        const lengthslice:Blob = blob.slice(offset, offset + 4);
        const lengthbuffer:ArrayBuffer = await lengthslice.arrayBuffer();
        if(lengthbuffer.byteLength < 4)
            return new Error('Unexpected EOF');
        const length:number = new DataView(lengthbuffer).getUint32(0, false);
        offset += 4;

        const chunktypeslice:Blob = blob.slice(offset, offset + 4);
        const chunktypebuffer:ArrayBuffer = await chunktypeslice.arrayBuffer();
        const chunktype:string = 
            String.fromCharCode(...new Uint8Array(chunktypebuffer));

        if (chunktype === 'IHDR') {
            const widthslice:Blob = blob.slice(offset + 4, offset + 8);
            const widthbuffer:ArrayBuffer = await widthslice.arrayBuffer();
            if(widthbuffer.byteLength < 4)
                return new Error('Unexpected EOF');
            const width:number = new DataView(widthbuffer).getUint32(0, false);

            const heightslice:Blob = blob.slice(offset + 8, offset + 12);
            const heightbuffer:ArrayBuffer = await heightslice.arrayBuffer();
            if(heightbuffer.byteLength < 4)
                return new Error('Unexpected EOF');
            const height:number = new DataView(heightbuffer).getUint32(0, false)

            return {width, height};
        } else {
            // Skip the chunk data and CRC
            offset += length + 12; // 4 bytes for length, 4 for type, 4 for CRC
        }
    }
}


/** Read the image size of JPG, TIFF or PNG files without loading the full file */
export async function read_image_size(x:Blob): Promise<util.ImageSize|Error> {
    let size:util.ImageSize|Error = await get_jpg_size(x)
    if(!(size instanceof Error))
        return size;
    
    size = await get_tiff_size(x)
    if(!(size instanceof Error))
        return size;
    
    size = await get_png_size(x)
    if(!(size instanceof Error))
        return size;
    
    return new Error('Could not get image size')
}




/** Maximum image size to display in original, scale down otherwise */
export const MAX_SIZE_MEGAPIXELS = 20;
/** Maximum image height/width to display in original, scale down otherwise
 *  (Browser limit) */
//export const MAX_SIZE_HEIGHT_WIDTH:number = 1024 * 32 -1;

// NOTE: in practice even lower
export const MAX_SIZE_HEIGHT_WIDTH:number = 1024 * 8 -1;




/** Suggest a smaller image size to display in the browser if needed */
export function get_display_size(size:util.ImageSize): util.ImageSize {
    const { width:W, height:H } = size;
    
    const size_mp:number  = W * H / 1000000
    const scale_mp:number = Math.sqrt(MAX_SIZE_MEGAPIXELS) / Math.sqrt(size_mp);
    const scale_h:number  = MAX_SIZE_HEIGHT_WIDTH / H;
    const scale_w:number  = MAX_SIZE_HEIGHT_WIDTH / W;
    const scale:number = Math.min(
        scale_mp,
        scale_h,
        scale_w,
        1.0,
    )

    const display_size:util.ImageSize = { 
        width:  Math.floor(W*scale), 
        height: Math.floor(H*scale) 
    }
    return display_size;
}
