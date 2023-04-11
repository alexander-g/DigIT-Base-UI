import { JSX, UTIF }    from "./dep.ts"
import * as util        from "./util.ts"
import { import_result_from_file }      from "./logic/download.ts";
import { InputFile, Result, InputResultPair } from "./logic/files.ts"

/** Event handler for file drag events */
export function on_drag(event:JSX.TargetedDragEvent<HTMLElement>): void {
    event.preventDefault()
}

/** Event handler for file drop events */
export async function on_drop(event:preact.JSX.TargetedDragEvent<HTMLElement>): Promise<void> {
    event.preventDefault()
    //reset state  //TODO: should not be done here, but when setting the input files
    globalThis.STATE?.files.set_from_files([])                       //TODO: hard-coded
    //get file list from event, otherwise its gone after the wait
    const files: FileList | undefined = event.dataTransfer?.files
    //refresh ui
    await util.wait(1)
    //now set the state with the actual files
    load_list_of_files_default(files ?? [])
}



/** Two sets of files, in no well-defined order. 
 *  First one to be interpreted as inputfiles, second one might be results */
type CategorizedFiles = {
    inputfiles:  File[],
    resultfiles: File[]
}

/** Sort list of files into input files and files that look like results.
 *  @param file_list            - The list of files to load.
 *  @param input_file_types     - Mime types that are interpreted as input files.
 */
export function categorize_files(
    file_list:                  FileList|File[],
    input_file_types:           string[],
): CategorizedFiles {
    const files: File[]       = Array.from(file_list)
    const inputfiles: File[]  = files.filter(
        (f:File) => input_file_types.includes(f.type)
    )
    const resultfiles: File[] = files.filter((f:File) => !inputfiles.includes(f))
    return {inputfiles, resultfiles}
}


const MIMETYPES: string[] = ["image/jpeg", "image/tiff"]          //NOTE: no png
// const set_inputfiles: (_:File[]) => void 
//     = (inputfiles:File[]) => globalThis.STATE.files.set_from_files(inputfiles)
// const set_resultfiles: (_:File[]) => void
//     = (maybe_resultfiles:File[]) => load_result_files(
//         maybe_resultfiles, globalThis.STATE.files.peek().map(pair => pair.input)
//     )

/** Load input or result files @see {@link load_list_of_files}, uses global state */
export async function load_list_of_files_default(file_list:FileList|File[]): Promise<void> {
    const {inputfiles, resultfiles:mayberesults} = categorize_files(file_list, MIMETYPES)

    globalThis.STATE?.files.set_from_pairs(                             //TODO: hard-coded
        await load_result_files(inputfiles, mayberesults)
    )
}

/** Load input files only (filtering file types), uses global state */
export function load_inputfiles(file_list:FileList|File[]): void {
    throw new Error('TODO')
    //return load_list_of_files(file_list, MIMETYPES, set_inputfiles, () => {})
}

/** Load result files only (filtering file types), uses global state */
export function load_resultfiles(file_list:FileList|File[]): void {
    throw new Error('TODO')
    //return load_list_of_files(file_list, MIMETYPES, () => {}, set_resultfiles)
}



/** Load files as results if the match already loaded input files */
export async function load_result_files(
    inputfiles:        File[],
    maybe_resultfiles: FileList|File[], 
): Promise<InputResultPair[]> {
    const pairs: InputResultPair[] = inputfiles.map(
        (input: File) => ({
            input:  new InputFile(input), 
            result: new Result('unprocessed'),
        })
    )
    const input_result_map:InputResultMap
        = collect_result_files(inputfiles, Array.from(maybe_resultfiles))
    
    for(const pair of pairs){
        const inputfile:File = pair.input;
        const result_candidates:File[]|undefined = input_result_map[pair.input.name]?.resultfiles
        if(!result_candidates)
            continue;
        
        if(result_candidates.length > 1) {
            console.error(`Unexpected number of result files for ${inputfile}`)
            continue
        }
        
        console.log('Loading result of ', inputfile.name)
        const result: Result|null = await import_result_from_file(result_candidates[0]!)
        if(result == null){
            console.error('Failed to parse result.')
            continue;
        }

        pair.result = result;
    }
    return pairs;
}


type InputResultFiles = {
    inputfile:   File,
    resultfiles: File[]
}

type InputResultMap = Record<string, InputResultFiles>

/** Filter a list of files, matching result files to input files 
 * @param maybe_result_files - Array of File objects that may include result files.
 * @param input_files        - Array of File objects representing the input files that have already been loaded.
 * @returns Object mapping input file names to arrays of File objects representing the result files that match each input file.
 */
export function collect_result_files(
    input_files:        File[],
    maybe_result_files: File[],
): InputResultMap {
    const collected: InputResultMap = {}
    for(const maybe_resultfile of maybe_result_files){
        const zip_filetypes:string[] = ["application/zip", "application/x-zip-compressed"]
        if(zip_filetypes.includes(maybe_resultfile.type)){
            //TODO: implement
            console.error('Loading zip files not yet implemented')
            continue;
        }
        //else
        /** Check for every input file if this result file matches */
        for(const inputfile of input_files){
            if(match_resultfile_to_inputfile(inputfile, maybe_resultfile)){
                const prev: InputResultFiles = collected[inputfile.name] ?? {
                    inputfile:   inputfile,
                    resultfiles: []
                }
                prev.resultfiles.push(maybe_resultfile)
                collected[inputfile.name] = prev
            }
        }
    }
    return collected;
}

/** Return true if the result file matches the input file */
function match_resultfile_to_inputfile(inputfile:File, maybe_resultfile:File): boolean {
    const basename: string         = util.file_basename(maybe_resultfile.name)
    const no_ext_filename:string   = util.remove_file_extension(inputfile.name)
    const candidate_names:string[] = [
        inputfile.name  + '.json',
        no_ext_filename + '.json',
        inputfile.name  + '.result.json',
        no_ext_filename + '.result.json'
    ]
    return (candidate_names.indexOf(basename) != -1)
}



export function set_image_src(img:HTMLImageElement, input:Blob|string|null): void {
    if( (input instanceof File)
     && (input.type=="image/tiff" || input.name.endsWith('.tif') || input.name.endsWith('.tiff'))) {
        load_tiff_file_as_blob(input).then( blob => set_image_src(img, blob) )
    } else if( input instanceof Blob) { //TODO: should check file type and give error if unsupported
        const url:string = URL.createObjectURL(input)
        img.style.visibility = '';
        img.addEventListener( 'load', () => URL.revokeObjectURL(url), {once:true} )
        img.src = url;
        //console.log('Setting image src of', img, 'to blob', input)
    } else if (util.is_string(input)){
        const url  = input as string;
        img.style.visibility = '';
        img.src   = url;
        //console.log('Setting image src of', img, 'to string', input)
    } else if (input == null) {
        //hidden to prevent the browser showing a placeholder
        img.style.visibility = 'hidden';
        img.removeAttribute('src')
    } else {
        throw TypeError(`Cannot set image src to ${input}`)
    }
}

export async function load_tiff_file(file:File, page_nr = 0): Promise<ImageData|null> {
    const buffer: ArrayBuffer = await file.arrayBuffer()
    const pages: UTIF.IFD[]   = UTIF.decode(buffer)
    if(pages.length > page_nr){
        const page: UTIF.IFD    = pages[page_nr]!
        // deno-lint-ignore no-explicit-any
        const console_log:any = console.log;
        try {
            //replacing console.log because UTIF doesnt care about logging
            console.log = () => {}
            UTIF.decodeImage(buffer, page)
        } finally {
            console.log = console_log
        }
        const rgba: Uint8ClampedArray  = Uint8ClampedArray.from(UTIF.toRGBA8(page));
        if(globalThis.ImageData)
            return new ImageData(rgba, page.width, page.height)
        else
            //deno
            return {
                data:   Uint8ClampedArray.from(rgba),
                width:  page.width,
                height: page.height,
                colorSpace: 'srgb',
            }
    }
    return null;
}

export async function load_tiff_file_as_blob(file:File, page_nr = 0): Promise<Blob|null> {
    const rgba: ImageData|null = await load_tiff_file(file, page_nr)
    if(rgba != null) {
        const canvas: HTMLCanvasElement = document.createElement('canvas')
        canvas.width  = rgba.width
        canvas.height = rgba.height
        
        const ctx: CanvasRenderingContext2D|null = canvas.getContext('2d')
        if(!ctx)
            return null;
        
        ctx.putImageData(rgba, 0, 0);
        return new Promise( (resolve: any) => {
            canvas.toBlob((blob: Blob|null )=>  resolve(blob), 'image/jpeg', 0.92);
        } )
    }
    return null;
}
