import { JSX, UTIF }    from "../dep.ts"
import * as util        from "../util.ts"
import { Input, Result, InputResultPair } from "../logic/files.ts"
import { zip_inputs_and_results }         from "../logic/files.ts"

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



/** Load a set of files. Some might be inputs, others previously exported results */
export async function load_list_of_files<I extends Input, R extends Result>(
    files:             FileList|File[],
    InputClass:        util.ClassWithValidate<I>,
    ResultClass:       util.ClassWithValidate<R, ConstructorParameters<typeof Result> >,
): Promise<InputResultPair<I, R>[]> {
    const {inputs, resultfiles:mayberesultfiles} = await categorize_files(files, InputClass)
    const results:R[] = await try_load_results(inputs, mayberesultfiles, ResultClass)
    const pairs:InputResultPair<I,R>[] = zip_inputs_and_results(inputs, results)
    return pairs;
}

/** Create a result for each input, potentially loading from `mayberesultfiles` */
export async function try_load_results<R extends Result>(
    inputs:           readonly Input[],
    mayberesultfiles: readonly File[],
    ResultClass:      util.ClassWithValidate<R, ConstructorParameters<typeof Result> >,
): Promise<R[]> {
    const results: R[] =[]
    for(const input of inputs){
        for(const result_candidate of mayberesultfiles) {
            let result: R|null = await ResultClass.validate({input, file:result_candidate})
            if(result == null){
                result = new ResultClass('unprocessed')
            }
            results.push(result)
        }
    }
    return results;
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
