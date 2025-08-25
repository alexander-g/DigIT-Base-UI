import { JSX }          from "../dep.ts"
import * as util        from "../util.ts"
import { Input, Result, InputResultPair } from "../logic/files.ts"
import * as files       from "../logic/files.ts"


/** Event handler for file drag events */
export function on_drag(event:JSX.TargetedDragEvent<HTMLElement>): void {
    event.preventDefault()
}


/** Two sets of files, in no well-defined order. 
 *  First one to be interpreted as inputfiles, second one might be results */
type CategorizedFiles<I extends Input>= {
    inputs:  I[],
    resultfiles: File[]
}

/** Sort list of files into input files and files that look like results.
 *  @param file_list            - The list of files to load.
 *  @param input_file_types     - Mime types that are interpreted as input files.
 */
export async function categorize_files<I extends Input>(
    file_list:                  FileList|File[],
    InputClass:                 util.ClassWithValidate<I>,
): Promise<CategorizedFiles<I>> {
    const files: File[]       = Array.from(file_list)
    const inputs: I[]         = []
    const resultfiles:File[]  = []
    for(const f of files) {
        const inputfile:I|null = await InputClass.validate(f)
        if(inputfile != null)
            inputs.push(inputfile)
        else
            resultfiles.push(f)          //TODO: convert to ResultClass.validate
    }
    return {inputs, resultfiles}
}



/** Load input files only (filtering file types) */
export function load_inputfiles(file_list:FileList|File[]): void {
    throw new Error('TODO')
    //return load_list_of_files(file_list, MIMETYPES, set_inputfiles, () => {})
}

/** Load result files only (filtering file types) */
export function load_resultfiles(file_list:FileList|File[]): void {
    throw new Error('TODO')
    //return load_list_of_files(file_list, MIMETYPES, () => {}, set_resultfiles)
}



/** Load a set of files. Some might be inputs, others previously exported results.
 *  - `InputClass.validate()` and `ResultClass.validate()` are used to categorize the files.
 *  - If `previous_pairs` is provided and there are no new inputs in `files`, 
 *    then will use these previous inputs.
 *  @returns list of input-result pairs */
export async function load_list_of_files<I extends Input, R extends Result>(
    list_of_files:     FileList|File[],
    InputClass:        files.InputClassInterface<I>,
    ResultClass:       files.ResultClassInterface<R>,
    previous_pairs?:   InputResultPair<I,R>[],
): Promise<InputResultPair<I, R>[]> {
    let {inputs, resultfiles:mayberesultfiles} = await categorize_files(list_of_files, InputClass)
    if(inputs.length == 0 && previous_pairs?.length != undefined){
        //use already loaded inputs and try to assign results to them
        inputs = previous_pairs.map(p => p.input)
    }

    const results:R[] = await try_load_results(inputs, mayberesultfiles, ResultClass)
    const pairs:InputResultPair<I,R>[] = files.zip_inputs_and_results(inputs, results)
    return pairs;
}

/** Create a result for each input, potentially loading from `mayberesultfiles` */
export async function try_load_results<R extends Result>(
    inputs:           readonly Input[],
    mayberesultfiles: readonly File[],
    ResultClass:      files.ResultClassInterface<R>,
): Promise<R[]> {
    const results: R[] =[]
    for(const input of inputs){
        let result: R|null = null
        for(const result_candidate of mayberesultfiles) {
            result = await ResultClass.validate({input, file:result_candidate})
            if(result != null)
                break;
        }
        
        if(result == null)
            result = new ResultClass('unprocessed', null, input.name)
        results.push(result)
    }
    return results;
}

