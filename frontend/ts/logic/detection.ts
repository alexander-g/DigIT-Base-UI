import type { AppFile }         from "../state.ts"
import * as errors              from "../components/errors.ts";
import * as util                from "../util.ts"

/**
 * Process a single input file including UI updates
 * @param file - The input file to process
 */
export async function process_image(
    file:       AppFile, 
    on_error:   errors.error_fn = errors.show_error_toast
): Promise<void> {
    //TODO: file.clear results
    //try
    //TODO: set file as currently processing

    const on_error_cb: () => void = function(){ on_error('Processing failed.') }
    await util.upload_file(file, on_error_cb)
    const response: Response 
        = await util.fetch_with_error([`/process_image/${file.name}`], on_error_cb)
    
    
    //TODO: verify results + convert to typescript
    //TODO: file.set_results(reply)
    //catch
    //handle errors
    //finally
    //delete file

}


export function process_all_files(): void {
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
}






