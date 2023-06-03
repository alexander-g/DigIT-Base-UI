import { Instance }         from "./boxes.ts";
import * as util            from "../util.ts";


/** Base input type, can be anything with a name */
export class Input {
    name: string;

    constructor(name:string){
        this.name = name;
    }
}



export type ResultStatus = 'unprocessed' | 'processing' | 'processed' | 'failed';

/** Immutable array of Instance to avoid unintentional modification.
 *  Can be also null to indicate that no boxes are available. */
export type MaybeInstances = readonly Instance[] | null;


/** Base class for processing results. */
export class Result {
    /** Indicates if the result is valid or not */
    status:         ResultStatus = 'unprocessed';

    /** Raw processing outputs, as received from backend or onnx.
     *  For debugging. */
    readonly raw?:  unknown;

    constructor(status:ResultStatus = 'unprocessed', raw:unknown = null) {
        this.status = status;
        this.raw    = raw;
    }

    /** Export this result to files.
     *  @virtual Overwritten by subclasses for other types of results 
     *  @returns A mapping from filenames to exported result file objects 
     *           or null if result is not yet processed */
    async export(): Promise<Record<string, File>|null> {
        return await null;
    }

    static validate(raw:unknown): Result|null {
        if(util.is_object(raw)){
            return new Result('processed', raw)
        }
        else return null;
    }
}



export type InputResultPair<I = Input, R extends Result = Result> = {
    input:  I;
    result: R;
}


export abstract class ProcessingModule<I, R extends Result> {
    abstract process(
        input:        I, 
        on_progress?: (x:InputResultPair<I,R>) => void
    ): Promise<R> ;
}

