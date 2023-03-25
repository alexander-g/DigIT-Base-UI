import { AppFile, Result }      from "../state.ts"
import * as errors              from "../components/errors.ts";
import * as util                from "../util.ts"
import * as boxes               from "./boxes.ts";

/**
 * Process a single input file including UI updates
 * @param file - The input file to process
 */
export async function process_image(
    file:       AppFile, 
    on_error:   errors.error_fn = errors.show_error_toast
): Promise<void> {
    return await process_files([file], on_error)
}


export async function process_files(
    files:      AppFile[],
    on_error:   errors.error_fn = errors.show_error_toast
): Promise<void> {
    //check if not already processing (CLI ne?)
    //


    for(const file of files) {
        //TODO: clear results
        //TODO: set file as currently processing

        //TODO: add filename to error message
        const on_error_cb: () => void = function(){ on_error('Processing failed.') }

        // do actual processing //TODO: refactor into own file
        try {
            mark_result_as_processing(file)
            await util.upload_file(file, function(){})
            const response: Response 
                = await util.fetch_with_error([`process_image/${file.name}`], function(){})
            await set_result_from_response(response, file)
        } catch (_error) {
            on_error_cb()
            mark_result_as_failed(file)
            continue;
        }
    }
}



export function process_all_files(): void {
    console.trace('Not Implemented')
    //check if not already processing -> wait or throw error?
    //TODO: get current processing order (as displayed + maybe filtered?)
    //lock the displayed order?
    //clone/lock settings
    //lock loading files
    //
    //for(const f of files_to_process) {
    //  if(cancel_requested)
    //  await process_file(f)
    //  TODO: increment progress counter
    //}
    //finally
    //unlock
}


/** Stop processing loop triggered by process_all_files() */
export function cancel_processing_all_files(): void {
    //TODO set cancel_requested = true
    console.trace('Not Implemented')
}



async function set_result_from_response(response:Response, file:AppFile): Promise<Result> {
    //TODO: JSON.parse might fail if invalid json
    // deno-lint-ignore no-explicit-any
    const rawresult: any = JSON.parse(await response.text())
    const result:Result  = new Result('processed', {raw:rawresult})

    if('classmap' in rawresult && util.is_string(rawresult.classmap)) {
        result.classmap = rawresult.classmap;
    }

    //set instances if any
    const maybeboxes: boxes.Box[]|undefined = boxes.validate_boxes(rawresult.boxes)
    result.set_instances(maybeboxes?.map( 
        (box:boxes.Box, i:number) => ({box, label:rawresult.labels[i]}) 
    ))

    file.set_result(result);
    return result
}


/** Remove the result from a file and indicate that processing is in progress */
function mark_result_as_processing(file:AppFile): void {
    file.set_result(new Result('processing'))
}

/** Remove the result from a file and indicate that processing has failed */
function mark_result_as_failed(file:AppFile): void {
    file.set_result(new Result('failed'))
}


