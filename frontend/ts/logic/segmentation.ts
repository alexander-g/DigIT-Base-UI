import { Result as BaseResult } from "./files.ts";
import * as util                from "../util.ts"
import { FlaskProcessing }      from "./flask_processing.ts";
import { 
    validate_ort_tensor, 
    PartialTensor, 
    SessionOutput 
} from "./onnxruntime.ts";
import * as imagetools from "./imagetools.ts";


export class Input extends File {}


export class SegmentationResult extends BaseResult {
    /** URL to a classmap (segmentation result) */
    classmap: string|null = null;

    constructor(
        ...args:[
            ...baseargs:  ConstructorParameters<typeof BaseResult>, 
            classmap?:     string,
        ]
    ){
        super(args[0], args[1], args[2])
        this.classmap = args[3] ?? null
    }

    async export(): Promise<Record<string, File>|null> {
        const exports: Record<string, File>|null = await super.export() ?? {}
        
        if(this.classmap != null) {
            const classmap: Blob|Error = await util.fetch_image_as_blob(this.classmap)
            if(!(classmap instanceof Error))
                exports['classmap.png'] = new File([classmap], 'classmap.png')
        }
        return exports;
    }

    static async validate<T extends BaseResult>(
        this: new (...args:ConstructorParameters<typeof SegmentationResult>) => T, 
        raw:  unknown
    ): Promise<T|null> {
        const baseresult:BaseResult|null = await super.validate(raw)
        if(baseresult == null)
            return null;
        
        if(util.is_object(raw)
        && util.has_string_property(raw, 'classmap')) {
            return new this('processed', raw, baseresult.inputname, raw.classmap)
        }

        if(is_onnx_session_output(raw)){
            const y_rgba:Uint8ClampedArray = imagetools.f32_mono_to_rgba_u8(
                raw.output["y.output"].data as Float32Array
            )
            const size:util.ImageSize = {
                height: raw.output['y.output'].dims[2]!,
                width:  raw.output['y.output'].dims[3]!,
            }
            const imagedata: imagetools.ImageData 
                = new imagetools.ImageData(y_rgba, size.height, size.width)
            const dataurl:string|Error 
                = await imagetools.imagedata_to_dataurl(imagedata)
            if(dataurl instanceof Error){
                return null
            }
            return new this('processed', raw, baseresult.inputname, dataurl)
        }
        else return null;
    }
}

export class SegmentationFlaskProcessing extends FlaskProcessing<SegmentationResult> {
    constructor(){
        super(SegmentationResult)
    }
}



/** Format returned by running segmentation models in ONNX */
export type ONNX_Output = {
    "y.output":   PartialTensor;
}

export type ONNX_Session_Output = SessionOutput & {
    output: ONNX_Output;
}

export function validate_onnx_output(raw:unknown): ONNX_Output|null {
    if(util.is_object(raw)
    && util.has_property_of_type(raw, 'y.output', validate_ort_tensor)){
        if(raw['y.output'].dims.length == 4
        && raw['y.output'].dims[0]     == 1
        && raw['y.output'].dims[1]     == 1
        && raw['y.output'].type        == 'float32'){
            return raw as ONNX_Output;
        }
        else return null;
    }
    else return null;
}

export function validate_onnx_session_output(x:unknown): ONNX_Session_Output|null {
    //TODO: code duplication with objectdetection.ts
    if(util.is_object(x)
    && util.has_property_of_type(x, 'output',    validate_onnx_output)
    && util.has_property_of_type(x, 'imagesize', util.validate_imagesize)
    && util.has_property_of_type(x, 'inputsize', util.validate_imagesize)){
        return x;
    }
    else return null;
}

export function is_onnx_session_output(x:unknown): x is ONNX_Session_Output {
    return validate_onnx_session_output(x) == x;
}
