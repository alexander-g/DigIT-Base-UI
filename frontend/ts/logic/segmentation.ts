import { Result as BaseResult } from "./files.ts";
import * as files               from "./files.ts";
import * as util                from "../util.ts"
import { FlaskProcessing }      from "./flask_processing.ts";
import { 
    validate_ort_tensor, 
    PartialTensor, 
    SessionOutput 
} from "./onnxruntime.ts";
import * as backend_common from "./backends/common.ts"
import * as imagetools from "./imagetools.ts";
import * as zip        from "./zip.ts"


export class SegmentationInput extends files.InputFile {}


export class SegmentationResult extends BaseResult {
    /** URL/Blob to a classmap (segmentation result) */
    classmap: Blob|string|null = null;

    constructor(
        ...args:[
            ...baseargs:  ConstructorParameters<typeof BaseResult>, 
            classmap?:     string|Blob,
        ]
    ){
        super(args[0], args[1], args[2])
        this.classmap = args[3] ?? null
    }

    async export(): Promise<Record<string, File>|null> {
        const exports: Record<string, File>|null = await super.export() ?? {}
        
        if(this.classmap != null) {
            let classmap: Blob|Error;
            if(this.classmap instanceof Blob)
                classmap = this.classmap;
            else {
                classmap = await util.fetch_image_as_blob(this.classmap)
            }
            if(!(classmap instanceof Error))
                exports['classmap.png'] = new File([classmap], 'classmap.png')
        }
        return exports;
    }

    static async validate<T extends BaseResult>(
        this: util.ClassWithValidate<
            T & SegmentationResult, 
            ConstructorParameters<typeof SegmentationResult>
        >,
        raw:  unknown
    ): Promise<T|null> {
        const baseresult:BaseResult|null = await super.validate(raw)
        if(baseresult == null)
            return null;

        if(raw instanceof Response){
            //raw = await raw.json()
            raw  = await raw.blob()
        }
        
        if(util.is_object(raw)
        && util.has_string_property(raw, 'classmap')) {
            return new this('processed', raw, baseresult.inputname, raw.classmap)
        }

        //onnx or torchscript raw output
        if(is_onnx_session_output(raw)){
            const y_raw:backend_common.AnyTensor|PartialTensor 
                = raw.output["y.output"];
            const y_rgba:Uint8ClampedArray = imagetools.f32_mono_to_rgba_u8(
                y_raw.data as Float32Array
            )
            const shape: readonly number[] 
                = ('shape' in y_raw)? y_raw.shape : y_raw.dims;
            const size:util.ImageSize = {
                height: shape[2]!,
                width:  shape[3]!,
            }
            const imagedata: imagetools.ImageData 
                = new imagetools.ImageData(y_rgba, size.height, size.width)
            const datablob:Blob|Error 
                = await imagetools.imagedata_to_blob(imagedata)
            if(datablob instanceof Error){
                return null
            }
            return new this('processed', raw, baseresult.inputname, datablob)
        }

        // zip file that contains a classmap.png
        if(files.is_input_and_file_pair(raw)
        && files.match_resultfile_to_inputfile(raw.input, raw.file, ['.zip'])){
            const zipcontents:zip.Files|Error = await zip.unzip(raw.file)
            if(zipcontents instanceof Error)
                return null;
            
            if('classmap.png' in zipcontents){
                const classmap_file:File = zipcontents['classmap.png']!;
                return new this('processed', raw, baseresult.inputname, classmap_file)
            }
            else return null;
        }
        
        // png file with a similar name as the input
        if(files.is_input_and_file_pair(raw)
        && files.match_resultfile_to_inputfile(raw.input, raw.file, ['.png'])){
            return new this('processed', raw, baseresult.inputname, raw.file)
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

/** Format returned by running segmentation models in TorchScript */
export type TS_Output = {
    "y.output": backend_common.AnyTensor;
}

export type ONNX_Session_Output = SessionOutput & {
    output: ONNX_Output|TS_Output;
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

export function validate_ts_output(raw:unknown): TS_Output|null {
    if(util.is_object(raw)
    && util.has_property_of_type(raw, 'y.output', backend_common.validate_tensor)){
        if(raw['y.output'].shape.length == 4
        && raw['y.output'].shape[0]     == 1
        && raw['y.output'].shape[1]     == 1
        && raw['y.output'].dtype        == 'float32'){
            return raw as TS_Output;
        }
        else return null;
    }
    else return null;
}

export function validate_onnx_session_output(x:unknown): ONNX_Session_Output|null {
    //TODO: code duplication with objectdetection.ts
    if(util.is_object(x)
    && (
        util.has_property_of_type(x, 'output',    validate_onnx_output)
        || util.has_property_of_type(x, 'output', validate_ts_output)
    )
    && util.has_property_of_type(x, 'imagesize', util.validate_imagesize)
    && util.has_property_of_type(x, 'inputsize', util.validate_imagesize)){
        return x;
    }
    else return null;
}

export function is_onnx_session_output(x:unknown): x is ONNX_Session_Output {
    return validate_onnx_session_output(x) == x;
}
