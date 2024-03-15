import * as util            from "../util.ts";
import * as zip             from "./zip.ts";
import type { Settings }    from "./settings.ts"


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


    /** @virtual Mime types that are accepted as input */
    static filetypes: string[] = ["image/jpeg", "image/tiff"]          //NOTE: no png
    /** @virtual File extensions that are accepted as input */
    static file_exts: string[] = [".jpeg", ".jpg", ".tiff", ".tif"]

    static check_filetype(f:File): boolean {
        const file_extension:string = '.' + f.name.split('.').pop()?.toLowerCase()
        return this.filetypes.includes(f.type) || this.file_exts.includes(file_extension)
    }
}

export type InputClassInterface<I extends Input>
    = util.ClassWithValidate<I> & { filetypes:string[] }





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

    /** @virtual Convert an object to a new result or null if invalid. 
     * This includes importing a previously exported result. */
    static async validate<T extends Result>(
        this: util.Class<T, ConstructorParameters<typeof Result> >, 
        raw:  unknown
    ): Promise<T|null> {
        if(util.is_object(raw)){
            const inputname: string|undefined 
                = (util.has_string_property(raw, 'inputname')) ? raw.inputname : undefined;
            return await new this('processed', raw, inputname)
        } 
        else return null
    }
}

export type InputResultPair<I extends Input, R extends Result> = {
    input:  I;
    result: R;
}

/** Combine lists of inputs and results into a list of {@link InputResultPair} */
export function zip_inputs_and_results<I extends Input, R extends Result>(
    inputs:  readonly I[],
    results: readonly R[],
): InputResultPair<I,R>[] {
    const pairs: InputResultPair<I,R>[] = []
    //TODO: better error handling
    const length:number = Math.min(inputs.length, results.length);
    // deno-lint-ignore no-inferrable-types
    for(let i:number=0; i<length; i++){
        pairs.push({input: inputs[i]!, result: results[i]!})
    }
    return pairs;
}

/** Utility type to ensure the presence of a `validate()` method.
 *  A `Result` subclass satisfies this condition */
export type ResultValidator<R extends Result> 
    = util.ClassWithValidate<R, ConstructorParameters<typeof Result>>

export type ResultClassInterface<R extends Result> = ResultValidator<R>;


/** Abstract base class for a processing backend (e.g. HTTP remote,
 *  onnxruntime, libtorch FFI). Subclasses have to implement `process()` */
export abstract class ProcessingModule<I extends Input, R extends Result>{
    ResultClass: ResultValidator<R>

    constructor(ResultClass:ResultValidator<R>){
        this.ResultClass = ResultClass;
    } 

    /** @virtual Process an input and return a result (potentially with status 
     * `failed`). Callback `on_progress()` should give intermediate results. */
    abstract process(
        input:        I, 
        on_progress?: (x:InputResultPair<I,R>) => void
    ): Promise<R> ;

    async validate_result(x:unknown): Promise<R>{
        const validationresult: R|null = await this.ResultClass.validate(x)
        if(validationresult == null){
            return new this.ResultClass('failed')
        }
        else return validationresult as R;
    }   
}


export abstract class ProcessingModuleWithSettings<
    I extends Input, R extends Result, S extends Settings
> extends ProcessingModule<I,R> {
    settings: S;

    constructor(ResultClass:ResultValidator<R>, settings:S){
        super(ResultClass)
        this.settings = settings;
    } 
}

export abstract class DetectionModule<I extends Input, R extends Result> 
extends ProcessingModuleWithSettings<I,R,Settings<'detection'>>{}


export class DummyProcessingModule extends ProcessingModule<File, Result> {
    constructor(){
        super(Result)
    }

    async process(input: File): Promise<Result> {
        return await new Result('processed', null, input.name)
    }
}


/** Combine single exported files into one, or return the only file. */
export async function combine_exports(
    raw_exports: Record<string, File>,
    inputname:   string,
    // deno-lint-ignore no-inferrable-types
    force_zip:   boolean = false,
): Promise<File|Error> {
    if(Object.keys(raw_exports).length == 1 && !force_zip){
        //single file, leave it as is
        return Object.values(raw_exports)[0]!
    } else {
        //multiple files, zip into an archive first
        const archivename = `${inputname}.zip`
        return await zip.zip_files(raw_exports, archivename)
    }
}

/** Return true if the result file matches the input file */
export function match_resultfile_to_inputfile(
    inputfile:        Input,
    maybe_resultfile: File,
    file_endings:     string[],
): boolean {
    const basename: string         = util.file_basename(maybe_resultfile.name)
    const no_ext_filename:string   = util.remove_file_extension(inputfile.name)
    const candidate_names:string[] = file_endings.map(
        (ending:string) => [ inputfile.name + ending, no_ext_filename + ending ]
    ).flat()
    return (candidate_names.indexOf(basename) != -1)
}

/** Check if input has a `name` thus implementing {@link Input} */
export function validate_baseinput_type(x:unknown): Input|null {
    if(util.is_object(x)
    && util.has_string_property(x, 'name')) {
        return x;
    }
    else return null;
}

/** An input and a file. 
 *  Used during file loading to match inputs to potential result files */
type InputAndFilePair = {
    input: Input;
    file:  File;
}

function validate_input_and_file_pair(x:unknown): InputAndFilePair|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'file',  util.validate_file)
    && util.has_property_of_type(x, 'input', validate_baseinput_type)){
        return x;
    }
    else return null;
}

export function is_input_and_file_pair(x:unknown): x is InputAndFilePair{
    return validate_input_and_file_pair(x) === x;
}
