import { InputResultPair, DetectionModule, Result } from "./files.ts";
import * as ort from "./onnxruntime.ts"



/** Processing module that uses onnxruntime-web */
export class ORT_Processing<R extends Result> 
extends DetectionModule<File,R> {   

    #session:ort.Session|null = null;

    async process(
        input:        File, 
        on_progress?: (x: InputResultPair<File, R>) => void
    ): Promise<R> {
        on_progress?.({input, result:new this.ResultClass("processing")})

        if(this.#session == null) {
            const active_model:string = this.settings.active_models.detection;
            const model_path:string = modelname_to_path(active_model);
            const initresult:ort.Session|Error 
                = await ort.Session.initialize(model_path)
            if(initresult instanceof Error){
                return new this.ResultClass('failed', initresult as Error);
            }
            this.#session = initresult as ort.Session;
        }
        const output: ort.SessionOutput|Error 
            = await this.#session.process_image_from_blob(input)
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
