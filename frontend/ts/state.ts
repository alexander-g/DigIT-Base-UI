import { signals } from "./dep.ts"
import { Settings, AvailableModels }    from "./logic/settings.ts";
import { Instance }                     from "./logic/boxes.ts";


/** Main input file structure with results */
export class AppFile extends File {

    /** This file's processing results */
    #result:Result = new Result()

    constructor(f:File) {
        super([f], f.name, {type:f.type, lastModified:f.lastModified})
    }

    /** Set the result, overwritten in the reactive version */
    set_result(result: Result): void {
        this.#result = result;
    }

    get result(): Readonly<Result> {
        return this.#result;
    }
}


export type ResultStatus = 'unprocessed' | 'processing' | 'processed' | 'failed';

/** Processing result, most fields optional to force error checking */
export class Result {
    /** Indicates if the result is valid or not */
    readonly status:    ResultStatus    = 'unprocessed';

    /** Raw processing outputs, as received from backend or onnnx.
     *  For debugging. */
    // deno-lint-ignore no-explicit-any
    readonly raw?:      any;

    /** URL to a classmap (segmentation result) */
    classmap?:          string;

    /** Boxes and labels of objects */
    #instances?:        Instance[];

    constructor(status: ResultStatus = 'unprocessed', other:Partial<Result> = {}){
        this.status = status;
        Object.assign(this, {...other})
    }

    /** Boxes and labels of objects */
    get instances(): Readonly<Instance[]>|undefined {
        return this.#instances;
    }

    /** Set the instances, overwritten in the reactive subclass */
    set_instances(instances: Instance[] | undefined) {
        this.#instances = instances
    }
}


/** Helper class to prevent undefined initial values */
class Reactive<T> extends signals.Signal<T> {
    /** Constructor making sure that undefined is not an option */
    constructor(x:T) {
        super(x)
    }
}


/** Result with additional attributes specifically for UI */
export class ResultState extends Result {
    /** Indicates whether the result should be displayed in the UI */
    $visible:   signals.Signal<boolean>     =   new signals.Signal(true)

    #$instances: signals.Signal<Instance[]|undefined>  = new signals.Signal(undefined)

    get $instances(): signals.ReadonlySignal<Instance[]|undefined> {
        return this.#$instances
    }

    /** @override */
    get instances(): readonly Instance[] | undefined {
        return this.#$instances.peek()
    }

    set_instances(instances: Instance[] | undefined): void {
        this.#$instances.value = instances;
    }


    /** Convert a basic non-state result to this class */
    static from_result(result:Result): ResultState {
        const resultstate = new ResultState()
        return Object.assign(resultstate, result)
    }
}



export type ImageSize = {
    width:  number;
    height: number;
}

/** Reactive version of AppFile */
export class AppFileState extends AppFile {
    #$loaded:   signals.Signal<boolean>     = new signals.Signal(false)
    #$size:     signals.Signal<ImageSize|undefined> = new signals.Signal()
    
    #$result:   Reactive<ResultState> = new Reactive(
        ResultState.from_result(super.result)
    )

    set_loaded(image:HTMLImageElement): void {
        this.#$loaded.value = true;
        this.#$size.value   = {
            width:  image.naturalWidth,
            height: image.naturalHeight,
        }
    }

    get $loaded(): signals.ReadonlySignal<boolean> { 
        return this.#$loaded;
    }

    get $size(): signals.ReadonlySignal<ImageSize|undefined> {
        return this.#$size;
    }

    /** @override */
    set_result(result: Result): void {
        this.#$result.value = ResultState.from_result(result)
    }

    get $result(): signals.ReadonlySignal<ResultState> {
        return this.#$result;
    }

    /** @override */
    get result(): Readonly<Result> {
        return this.#$result.peek()
    }
}






/** Reactive list of AppFiles */
export class AppFileList extends Reactive<AppFileState[]> {
    /**
     * Update the state to set new input files.
     * @param files A list of files that will be converted to AppFiles
     */
    set_from_files(files:File[]|FileList) {
        files       = Array.from(files)
        super.value = files.map( 
            (f:File) => new AppFileState(f)
        )
    }
}

/** Reactive Settings */
class SettingsState extends Reactive<Settings> {}

/** Reactive AvailableModels */
class AvailableModelsState extends Reactive<AvailableModels> {}


/** Main application state structure */
export class AppState {
    /** Currently loaded files */
    files: AppFileList = new AppFileList([]);

    /** Indicates whether there is a processing operation running somewhere */
    processing: Reactive<boolean> = new Reactive<boolean>(false)

    /** Currently loaded settings */
    settings: SettingsState = new SettingsState({})

    /** Which models can be selected in the settings */
    available_models: AvailableModelsState = new AvailableModelsState({})
}

/** Global application state */
export const STATE = new AppState()



//make global for debugging
declare global {
    // deno-lint-ignore no-var
    var STATE: AppState;
}
globalThis.STATE = STATE;