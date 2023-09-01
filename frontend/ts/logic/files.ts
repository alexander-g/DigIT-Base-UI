import * as util            from "../util.ts";


/** Base input type, can be anything with a name */
export type Input = { name: string };



/** A `File` that represents an input */
export class InputFile extends File implements Input  {

    /** Check if `x` is a file and of the correct type (jpeg/tiff) */
    static validate<I extends InputFile>(
        this: util.Constructor<I, ConstructorParameters<typeof File>> & {
            check_filetype: typeof InputFile.check_filetype;
        },
        x:    unknown
    ): I|null {
        if(x instanceof File
        && this.check_filetype(x) ){
            return new this([x], x.name)
        }
        else return null;
    }


    /** @virtual Mime types and file endings that are accepted as input */
    static filetypes: string[] = ["image/jpeg", "image/tiff"]          //NOTE: no png

    static check_filetype(f:File): boolean {
        const file_extension:string = '.' + f.name.split('.').pop()?.toLowerCase()
        return this.filetypes.includes(f.type) || this.filetypes.includes(file_extension)
    }
}

export type InputClassInterface<I extends Input> = util.ClassWithValidate<I> & { filetypes:string[] }





export type ResultStatus = 'unprocessed' | 'processing' | 'processed' | 'failed';



/** What kind of data to export. 
 *  - `annotations`: Raw data that can be loaded back into the UI.
 *  - `statistics`:  Processed data for end user analysis. */
export type ExportType = 'annotations'|'statistics';


/** Base class for processing results. */
export class Result {
    /** Indicates if the result is valid or not */
    status:         ResultStatus = 'unprocessed';

    /** The `name` attribute of the corresponding {@link Input} */
    inputname:      string|null;                                         //TODO: make this non-null

    //TODO: modelinfo / metadata

    /** Raw processing outputs, as received from backend or onnx.
     *  For debugging. */
    readonly raw:   unknown;

    constructor(
        status:ResultStatus     = 'unprocessed', 
        raw:unknown             = null, 
        inputname:string|null   = null,                                  //TODO: make this required
    ) {
        this.status = status;
        this.raw    = raw;
        this.inputname = inputname;

        this.apply(raw)
    }

    /** Export this result to files.
     *  @virtual Overwritten by subclasses for other types of results 
     *  @returns A mapping from filenames to exported result file objects 
     *           or null if result is not yet processed */
    async export(format:ExportType = 'annotations'): Promise<Record<string, File>|null> {
        return await null;
    }


    /** Export a collection of results, e.g if some combined information is needed.
     *  @virtual By default simply exports all results individually. Overrideable. */
    static async export_combined(
        results: Result[],
        format:  ExportType
    ): Promise<Record<string, File>|null> {
        const combined_results: Record<string, File> = {}
        for (const result of results) {
            const exportfiles: Record<string, File> | null = await result.export(format)
            if (exportfiles == null)
                continue;
    
            if (Object.keys(exportfiles).length <= 1) {
                //single file, add directly to the list
                Object.assign(combined_results, exportfiles)
            } else {
                //multiple files, create a subfolder
                for (const exportfile of Object.values(exportfiles))
                combined_results[`${result.inputname}/${exportfile.name}`] = exportfile;
            }
        }
        if(Object.keys(combined_results).length > 0)
            return combined_results;
        //else
        return null;
    }

    /** @virtual Convert an object to a new result or null if invalid */
    static validate<T extends Result>(
        this: new (...args:ConstructorParameters<typeof Result>) => T, 
        raw:  unknown
    ): T|null {
        const result = new this('processed', raw)
        return result.apply(raw)
    }

    /** @virtual Internal function to assign values from another object to this one  */
    apply(raw:unknown): this | null {
        if(util.is_object(raw)) {
            this.status = 'processed'
            return this;
        }
        else return null;
    }
}



export type InputResultPair<I extends Input, R extends Result> = {
    input:  I;
    result: R;
}




export abstract class ProcessingModule<I extends Input, R extends Result> {
    abstract process(
        input:        I, 
        on_progress?: (x:InputResultPair<I,R>) => void
    ): Promise<R> ;
}

