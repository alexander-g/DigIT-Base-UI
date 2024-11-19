import { Result as BaseResult } from "./files.ts";
import * as files               from "./files.ts";
import * as segm                from "./segmentation.ts"
import * as zip                 from "./zip.ts"
import * as util                from "../util.ts"

import * as backend_common from "./backends/common.ts"
import * as imagetools     from "./imagetools.ts";

export class InstanceSegmentationInput extends files.InputFile {}


export class InstanceSegmentationResult extends segm.SegmentationResult {
    /** URL/blob to an instance map (each pixel assigned to an instance) */
    instancemap: Blob|null;

    constructor(
        ...args:[
            ...baseargs: ConstructorParameters<typeof segm.SegmentationResult>, 
            instancemap?: Blob,
        ]
    ){
        const [_status, raw, inputname, classmap, instancemap] = args;
        let status: files.ResultStatus|undefined = _status;
        if(status == 'processed' && instancemap === undefined)
            status = 'unprocessed';
        
        super(status, raw, inputname, classmap)
        this.instancemap = instancemap ?? null;
    }

    override async export(): Promise<Record<string, File> | null> {
        if(this.instancemap === null){
            return null;
        }

        const baseexport: Record<string, File>|null = await super.export()
        if(baseexport != null){
            baseexport['instancemap.png'] 
                = new File([this.instancemap], 'instancemap.png');
        }
        return baseexport;
    }

    static override async validate<T extends BaseResult>(
        this: new (...args:ConstructorParameters<typeof InstanceSegmentationResult>) => T, 
        raw:  unknown,
    ): Promise<T|null> {
        const baseresult:segm.SegmentationResult|null 
            = await super.validate(raw) as segm.SegmentationResult|null;
        if(baseresult == null)
            return null;
        
        raw = baseresult.raw;

        // load from zip file
        if(raw instanceof Blob){
            const zipcontents: zip.Files|Error = await zip.unzip(raw as File)
            if(zipcontents instanceof Error)
                return null;
            
            if('instancemap.png' in zipcontents){
                const instancemap_file:File = zipcontents['instancemap.png']!
                return new this(
                    'processed', 
                    raw, 
                    baseresult.inputname, 
                    baseresult.classmap ?? undefined,
                    instancemap_file,
                )
            }
            else return null;
            
        }

        if(is_session_output(raw)){
            const labelmaptensor:backend_common.AnyTensor = raw.output.labels_rgb;

            //TODO: code re-use and refactor
            const l_rgba:Uint8ClampedArray = imagetools.rgb_u8_to_rgba(
                labelmaptensor.data as Uint8Array
            )
            const shape: readonly number[]  = labelmaptensor.shape;
            const size:util.ImageSize = {
                height: shape[0]!,
                width:  shape[1]!,
            }
            const imagedata: imagetools.ImageData 
                = new imagetools.ImageData(l_rgba, size.height, size.width)
            const datablob:Blob|Error 
                = await imagetools.imagedata_to_blob(imagedata)
            if(datablob instanceof Error){
                return null
            }
            return new this(
                'processed', 
                raw, 
                baseresult.inputname, 
                baseresult.classmap ?? undefined, 
                datablob
            )
        }

        else return null;            
    }
}




/** Partial format returned by running instance segmentation models in TorchScript */
export type TS_Output = {
    "labels_rgb": backend_common.AnyTensor;
}

export type Session_Output = {
    output: TS_Output;
}

export function validate_ts_output(raw:unknown): TS_Output|null {
    if(util.is_object(raw)
    && util.has_property_of_type(raw, 'labels_rgb', backend_common.validate_tensor)){
        if(raw['labels_rgb'].shape.length == 3   // 2D + RGB
        && raw['labels_rgb'].shape[2]     == 3   // RGB
        && raw['labels_rgb'].dtype        == 'uint8'){
            return raw as TS_Output;
        }
        else return null;
    }
    else return null;
}

export function validate_session_output(x:unknown): Session_Output|null {
    //TODO: code duplication with objectdetection.ts
    if(util.is_object(x)
    && util.has_property_of_type(x, 'output', validate_ts_output)){
        return x;
    }
    else return null;
}

export function is_session_output(x:unknown): x is Session_Output {
    return validate_session_output(x) === x;
}


