import { InputResultPair, DetectionModule, Result } from "./../files.ts";
import * as util from "../../util.ts";


/** Processing module that sends the input file to a backend for processing.
 *  Similar to flask_processing.ts, but updated protocol */
export class RemoteProcessing<R extends Result> extends DetectionModule<File,R> {
    async process(
        input:        File,
        on_progress?: (x: InputResultPair<File, R>) => void
    ): Promise<R> {
        on_progress?.({input, result:new this.ResultClass("processing")})

        //TODO: processing progress
        const response:Response|Error 
            = await util.upload_file_no_throw(input, 'process_image')
        
        const result:R|null = await this.ResultClass.validate(response) 
        if(result == null)
            return new this.ResultClass('failed', response);
        
        //TODO: set inputname via validate/constructor
        result.inputname  = input.name;
        return result;
    }
}



