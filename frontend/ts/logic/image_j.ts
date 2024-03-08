// deno-lint-ignore-file no-inferrable-types
// adapted from https://github.com/cgohlke/roifile

import { Point }    from "../util.ts"


/** ImageJ RoI types */
enum ROI_TYPE {
    POLYGON  = 0,
    RECT     = 1,
    OVAL     = 2,
    LINE     = 3,
    FREELINE = 4,
    POLYLINE = 5,
    NOROI    = 6,
    FREEHAND = 7,
    TRACED   = 8,
    ANGLE    = 9,
    POINT    = 10,
}

/** ImageJ RoI options */
enum ROI_OPTIONS {
    //SPLINE_FIT             = 1
    //DOUBLE_HEADED          = 2
    //OUTLINE                = 4
    OVERLAY_LABELS         = 8,
    //OVERLAY_NAMES          = 16
    OVERLAY_BACKGROUNDS    = 32,
    //OVERLAY_BOLD           = 64
    SUB_PIXEL_RESOLUTION   = 128,
    //DRAW_OFFSET            = 256
    //ZERO_TRANSPARENT       = 512
    //SHOW_LABELS            = 1024
    //SCALE_LABELS           = 2048
    //PROMPT_BEFORE_DELETING = 4096
}

type Rect = {
    top:    number;
    left:   number;
    bottom: number;
    right:  number;
}

export class RoI {
    version:number = 226;

    constructor(
        public name:        string,
        public coordinates: Int32Array,
        public roi_type:    ROI_TYPE,
        public options:     ROI_OPTIONS,
        public rect:        Rect,
    ){}

    /** Create a freeline-type RoI from a list of Points (basic) */
    static freeline_from_points(
        points: Point[],
        name?:  string,
    ): RoI {

        const options:number = (
            ROI_OPTIONS.OVERLAY_BACKGROUNDS 
            | ROI_OPTIONS.OVERLAY_LABELS
            //| ROI_OPTIONS.SUB_PIXEL_RESOLUTION
        )

        // NOTE: subpixel coordinates not implemented
        const coords:Point[] = points.map( 
            (p:Point) => ( {x:Math.round(p.x), y:Math.round(p.y)} )
        )
        
        const left_top:Point     = points_min(coords);
        const right_bottom:Point = points_max(coords);
        const left:  number = Math.floor(left_top.x);
        const top:   number = Math.floor(left_top.y);
        const right: number = Math.floor(right_bottom.x) + 1;
        const bottom:number = Math.floor(right_bottom.y) + 1;

        //order='F'
        const integer_coordinates: Int32Array = Int32Array.from([
            coords.map( (p:Point) => p.x - left ),
            coords.map( (p:Point) => p.y - top ),
        ].flat())

        return new RoI(
            name ?? crypto.randomUUID(),
            integer_coordinates,
            ROI_TYPE.FREELINE,
            options,
            {top, left, right, bottom},
        )
    }

    /** Export to binary format that can be imported into ImageJ */
    tobytes(): ArrayBuffer {
        //NOTE: complicated because of big endianness

        const result:ArrayBuffer[] = [
            new TextEncoder().encode('Iout'),
        ]
        const n_coordinates:number = Math.floor(this.coordinates.length / 2);

        //hBxhhhhH = 2+1+1+ 2*4 + 2 = 14
        let buffer:ArrayBuffer = new ArrayBuffer(14)
        let view:DataView      = new DataView(buffer)
        view.setInt16(0, this.version, false)
        view.setUint8(2, this.roi_type)
        view.setUint8(3, 0)
        view.setInt16(4,  this.rect.top,    false)
        view.setInt16(6,  this.rect.left,   false)
        view.setInt16(8,  this.rect.bottom, false)
        view.setInt16(10, this.rect.right,  false)
        view.setUint16(12, n_coordinates < 2**16? n_coordinates : 0, false)
        result.push(buffer)

        buffer = new Uint8Array(16).fill(0).buffer
        view   = new DataView(buffer)
        if(n_coordinates >= 2**16){
            view.setInt32(0, n_coordinates, false);
        }
        result.push(buffer);

        //hi4s4shhBBhi = 2+4+4+4+2+2+1+1+2+4 = 26
        buffer = new ArrayBuffer(26)
        view   = new DataView(buffer)
        // 2 bytes stroke_width = 0
        // 4 bytes shape_roi_size = 0
        // 4 bytes stroke_color = None = 0
        // 4 bytes fill_color   = None = 0
        // 2 bytes subtype = 0
        view.setInt16(16, this.options, false)
        // 1 byte arrow_style_or_aspect_ratio = 0
        // 1 byte arrow_head_size = 0
        // 2 bytes rounded_rect_arc_size = 0
        // 4 bytes position = 0
        result.push(buffer)

        const extrabuffers:ArrayBuffer[] = []
        if(this.roi_type == ROI_TYPE.FREELINE) {
            const buffer = new ArrayBuffer(this.coordinates.length*2)
            const view   = new DataView(buffer)
            for(const i in this.coordinates)
                view.setInt16(Number(i)*2, this.coordinates[i]!, false);
            
            extrabuffers.push(buffer)
            //NOTE: subpixel coordinates not implemented
        }
        const extradata:ArrayBuffer = concat(extrabuffers)
        const header2_offset:number = 64 + extradata.byteLength
        const header2_buffer = new ArrayBuffer(4)
        const header2_view   = new DataView(header2_buffer)
        header2_view.setInt32(0, header2_offset, false)
        result.push(header2_buffer)
        result.push(extradata)

        const offset:number = header2_offset + 64;
        const name_length:number = this.name.length;
        const name_offset:number = (name_length > 0)? offset : 0;
        //4xiiiii4shBBifiii12x = 4+4*5+4+2+1+1+4+4+4+4+4+12 = 64
        buffer = new ArrayBuffer(64)
        view   = new DataView(buffer)
        // 4 nullbytes
        // 4 bytes c_position = 0
        // 4 bytes z_position = 0
        // 4 bytes t_position = 0
        view.setInt32(16, name_offset, false)
        view.setInt32(20, name_length, false)
        // 4 bytes overlay_label_color = None = 0
        // 2 bytes overlay_font_size = 0
        // everything else also zero
        result.push(buffer)

        if(name_length > 0){
            result.push(
                encode_utf16be(this.name)
            )
        }
        return concat(result)
    }

    /** Import from binary format */
    // static frombytes(bytes:Uint8Array): RoI|Error {

    // }
}


/** Find the minimum x/y coordinates for a set of points. (`points.min(axis=0)`) */
export function points_min(points:Point[]): Point {
    const min_p:Point = {x:1e99, y: 1e99}
    for(const p of points){
        if(p.x < min_p.x)
            min_p.x = p.x;
        if(p.y < min_p.y)
            min_p.y = p.y;
    }
    return min_p;
}

/** Find the maximum x/y coordinates for a set of points. (`points.min(axis=0)`) */
export function points_max(points:Point[]): Point {
    const max_p:Point = {x:-1e99, y:-1e99}
    for(const p of points){
        if(p.x > max_p.x)
            max_p.x = p.x;
        if(p.y > max_p.y)
            max_p.y = p.y;
    }
    return max_p;
}

/** Compute the total size of a list of buffers */
function total_length(x:ArrayBuffer[]): number {
    let n:number = 0;
    for(const xi of x)
        n += xi.byteLength;
    return n;
}

/** Concatenate a list of buffers */
export function concat(buffers:ArrayBuffer[]): ArrayBuffer {
    const nbytes:number = total_length(buffers)
    const result = new Uint8Array(nbytes)
    
    let offset:number = 0;
    for(const buffer of buffers){
        result.set(new Uint8Array(buffer), offset)
        offset += buffer.byteLength;
    }
    return result;
}

/** Encode a string in UTF16 format (big endian), as Python's `.encode('utf-16be')` */
export function encode_utf16be(x:string): ArrayBuffer {
    const buffer:ArrayBuffer = new ArrayBuffer(x.length*2);
    const view:DataView      = new DataView(buffer);
    for(let i:number = 0; i < x.length; i++){
        view.setInt16(i*2, x.charCodeAt(i), false)
    }
    return buffer;
}

