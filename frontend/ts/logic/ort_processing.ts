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

        const active_model:string = this.settings.active_models.detection;
        if(this.#session == null) {
            const initresult:ort.Session|Error 
                = await ort.Session.initialize(active_model)
            if(initresult instanceof Error){
                return new this.ResultClass('failed', initresult as Error);
            }
            this.#session = initresult as ort.Session;
        }
        const output: unknown|Error 
            = await this.#session.process_image_from_blob(input)
        const result: R|null = await this.ResultClass.validate(output)
        if(result == null)
            return new this.ResultClass('failed')

        //TODO: should be handled somewehere else
        result.inputname = input.name
        return result
    }
}

