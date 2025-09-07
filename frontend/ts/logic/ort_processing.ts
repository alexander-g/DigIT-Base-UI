import { InputResultPair, DetectionModule, Result } from "./files.ts";
import * as ort  from "./onnxruntime.ts"
import * as util from "../util.ts";


/** Processing module that uses onnxruntime-web */
export class ORT_Processing<R extends Result> 
extends DetectionModule<File,R> {   

    #session:ort.SingleImageSession|null = null;

    async process(
        input:        File, 
        on_progress?: (x: InputResultPair<File, R>) => void
    ): Promise<R> {
        on_progress?.({input, result:new this.ResultClass("processing")})

        // initialize
        if(this.#session == null) {
            const active_model:string = this.settings.active_models.detection;
            const model_path:string = modelname_to_path(active_model);
            const initresult:ort.Session|Error 
                = await ort.SingleImageSession.initialize(model_path)
            if(initresult instanceof Error){
                return new this.ResultClass('failed', initresult as Error);
            }
            this.#session = initresult as ort.SingleImageSession;
        }

        // run
        let output: ort.SingleImageSessionOutput|Error 
            = await this.#session.process_image_from_blob(input)

        // run again if this is an multistep/iterative model
        while(!(output instanceof Error) 
        && is_multistep_output(output.raw)
        && (output.raw.completed.data[0] != 1) ) {
            const inputfeed: ort.TensorDict = onnx_output_to_multistep_input(
                output.raw as UnknownOutput
            )
            output = await this.#session.process_inputfeed_single_image(
                inputfeed,
                {imagesize: output.imagesize, inputsize:output.inputsize}
            )
        }

        //verify results
        const result: R|null = await this.ResultClass.validate(output)
        if(result == null)
            return new this.ResultClass('failed', output)

        
        //TODO: should be handled somewhere else
        result.inputname = input.name
        return result
    }
}


/** Try to guess if the argument is a path, otherwise construct one.*/
function modelname_to_path(name:string): string {
    if(name.includes('/') && name.endsWith('.pt.zip')){
        return name;
    }
    return `models/detection/${name}.pt.zip`
}


/** An output of an ONNX model that is meant to be executed in multiple steps */
type MultistepOutput = {
    /** Flag indicating whether the to run the model again or not */
    completed: ort.PartialTensor;
}

function validate_multistep_output(x:unknown): MultistepOutput|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'completed', ort.validate_ort_tensor)){
        if(x.completed.type == 'bool'
        && x.completed.dims.length == 0
        && x.completed.data.length == 1) {
            return x;
        }
        else return null;
    }
    else return null;
}

function is_multistep_output(x:unknown): x is MultistepOutput {
    return (validate_multistep_output(x) === x);
}


/** Utility type to make TypScript happy */
type UnknownOutput = Omit<MultistepOutput, 'completed'>


function onnx_output_to_multistep_input(x:ort.TensorDict): ort.TensorDict {
    const result:ort.TensorDict = {}
    for(const [k, v] of Object.entries(x)) {
        if(k != "completed")
            result[k.replace(/\.output$/, '')] = v;
    }
    return result;
}
