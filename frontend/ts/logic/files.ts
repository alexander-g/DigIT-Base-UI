import { Instance }         from "./boxes.ts";
import * as util            from "../util.ts";


/** Base input type, can be anything with a name */
export type Input = { name: string };



export type ResultStatus = 'unprocessed' | 'processing' | 'processed' | 'failed';

/** Immutable array of Instance to avoid unintentional modification.
 *  Can be also null to indicate that no boxes are available. */
export type MaybeInstances = readonly Instance[] | null;


/** Base class for processing results. */
export class Result {
    /** Indicates if the result is valid or not */
    status:         ResultStatus = 'unprocessed';

    /** The `name` attribute of the corresponding {@link Input} */
    inputname:      string|null;                                         //TODO: make this non-null

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
    async export(): Promise<Record<string, File>|null> {
        return await null;
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

