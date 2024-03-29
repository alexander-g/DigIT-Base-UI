import { InputResultPair, ProcessingModule, Result }         from "./files.ts";
import * as util                            from "../util.ts";



/** Processing module that sends the input file to the flask backend for processing */
export abstract class FlaskProcessing<R extends Result> extends ProcessingModule<File,R> {
    abstract ResultClass: util.ClassWithValidate<R, ConstructorParameters<typeof Result>>;

    async process(
        input:        File, 
        on_progress?: (x: InputResultPair<File, R>) => void
    ): Promise<R> {
        on_progress?.({input, result:new this.ResultClass("processing")})

        const ok_or_error:Response|Error = await util.upload_file_no_throw(input)
        if(ok_or_error instanceof Error)
            return new this.ResultClass('failed');
        
        const response: Response|Error
            = await util.fetch_no_throw(`process_image/${input.name}`)
        if(response instanceof Error)
            return new this.ResultClass('failed');
        
        
        const raw:unknown = await util.parse_json_response(response)
        const result: R   = this.ResultClass.validate(raw) ?? new this.ResultClass('failed');
        //TODO: set inputname via validate/constructor
        result.inputname  = input.name;
        return result;
    }
}





