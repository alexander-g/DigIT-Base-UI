import { InputFile, Result, InputResultPair }    from "./files.ts"
import * as util                from "../util.ts"
import * as boxes               from "./boxes.ts";


type ProcessingCallback = (x:InputResultPair) => void;

/**
 * Process a single input file including UI updates
 * @param file - The input file to process
 */
export async function process_image(
    file:           InputFile
): Promise<Result|undefined> {
    return (await process_files([file]))[0]
}


export async function process_files(
    files:          InputFile[],
    on_progress?:   ProcessingCallback
): Promise<Result[]> {
    const results: Result[] = []
    for(const input of files) {
        // do actual processing //TODO: refactor into own file
        try {
            on_progress?.({input, result:new Result('processing')})
            await util.upload_file(input, function(){})
            const response: Response 
                = await util.fetch_with_error([`process_image/${input.name}`], function(){})
            const result = await result_from_response(response)
            results.push( result )
            on_progress?.({input, result})
        } catch (error) {
            //TODO: pass error to callback
            const result = new Result('failed')
            results.push(result)
            on_progress?.( {input, result} )
            continue;
        }
    }
    return results;
}


export async function process_file(input:InputFile): Promise<Result> {
    let result:Result;
    try {
        await util.upload_file(input, console.error) //TODO: error handling
        const response: Response 
                = await util.fetch_with_error([`process_image/${input.name}`], function(){}) //TODO: error handling
        result = await result_from_response(response)
    } catch (error) {
        //TODO: more info on error
        console.error(error)
        result = new Result('failed')
    }
    return result;
}



/** Stop processing loop triggered by process_all_files() */
export function cancel_processing_all_files(): void {
    //TODO set cancel_requested = true
    console.trace('Not Implemented')
}


//TODO: code re-use with download.ts

/** Parse a fetch response object received from the backend converting to a `Result` */
async function result_from_response(response:Response): Promise<Result> {
    //TODO: JSON.parse might fail if invalid json
    const rawresult: unknown = JSON.parse(await response.text())
    const result:Result      = new Result('processed', {raw:rawresult})

    if(util.is_object(rawresult) 
    && util.has_string_property(rawresult, 'classmap')){
        result.classmap = rawresult.classmap;
    }

    //set instances if any
    if(util.is_object(rawresult)
    && util.has_property_of_type(rawresult, 'boxes',  boxes.validate_boxes)
    && util.has_property_of_type(rawresult, 'labels', util.validate_string_array)){
        const _boxes: boxes.Box[]   = boxes.validate_boxes(rawresult.boxes)!
        const labels: string[]      = rawresult.labels
        if(_boxes.length != labels.length) {
            console.error('Received unequal number of boxes and labels')
        } else {
            result.set_instances( _boxes.map(
                (box:boxes.Box, i:number) => ({box, label:labels[i]!})
            ))
        }
    }
    return result
}



