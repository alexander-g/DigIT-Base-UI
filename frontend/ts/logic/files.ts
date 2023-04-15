import { Instance }         from "./boxes.ts";
import { process_file }     from "./detection.ts";


export class InputFile extends File {
    //TODO: load_image()

    constructor(f:File) {
        super([f], f.name, {type:f.type, lastModified:f.lastModified})
    }

    //TODO: make abstract
    /** Process the input file, returning a result that might be successful or not.
     *  @virtual Overwritten downstream for other processing needs */
    async process(): Promise<Result> {
        return await process_file(this)
    }
}


export type ResultStatus = 'unprocessed' | 'processing' | 'processed' | 'failed';

/** Immutable array of Instance to avoid unintentional modification.
 *  Can be also undefined to indicate that no boxes are available.
 */
export type MaybeInstances = readonly Instance[] | undefined;

/** Processing result, most fields optional to force error checking */
export class Result {
    //TODO: meta-data: processed with model, filename?

    /** Indicates if the result is valid or not */
    status:             ResultStatus    = 'unprocessed';

    /** Raw processing outputs, as received from backend or onnx.
     *  For debugging. */
    readonly raw?:      unknown;

    //TODO: move to a mixin
    /** URL to a classmap (segmentation result) */
    classmap?:          string;

    //TODO: move to a mixin
    /** Boxes and labels of objects */
    #instances?:        MaybeInstances;

    constructor(
        status: ResultStatus = 'unprocessed', 
        other:  Partial<Result> & {raw?:unknown} = {}
    ) {
        this.status     = status;
        this.raw        = other.raw;
        //NOTE: not using set_instances() because of some strange error
        this.#instances = other.instances
        this.classmap   = other.classmap
    }

    /** Boxes and labels of objects */
    get instances(): MaybeInstances {
        return this.#instances;
    }

    /** Set the instances and change status accordingly */
    set_instances(instances: MaybeInstances) {
        this.#instances = instances
        this.status     = instances ? 'processed' : 'unprocessed';
    }
}


export type InputResultPair = {
    input:      InputFile;
    result:     Result;
}

