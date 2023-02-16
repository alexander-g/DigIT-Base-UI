import type { AppFileState } from "../state.ts"
import * as util from "../util.ts"

/**
 * Process a single input file including UI updates
 * @param file - The input file to process
 */
export async function process_image(file:AppFileState): Promise<void> {
    console.error('[ERROR] Processing files not implemented.', file.name)
    //TODO: file.clear results
    //try
    //TODO: set file as currently processing
    await util.upload_file(file)
    const response:Response =  await fetch('/process_image')   //OR: onnx!
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


export function cancel_processing_all_files(): void {
    //TODO set cancel_requested = true
}






