import { signals } from "./dep.ts"
import { Settings, AvailableModels }    from "./logic/settings.ts";
import { Instance }                     from "./logic/boxes.ts";
import { ImageSize }                    from "./util.ts";

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

/** Immutable array of Instance to avoid unintentional modification.
 *  Can be also undefined to indicate that no boxes are available.
 */
export type MaybeInstances = readonly Instance[] | undefined;

/** Processing result, most fields optional to force error checking */
export class Result {
    /** Indicates if the result is valid or not */
    status:             ResultStatus    = 'unprocessed';

    /** Raw processing outputs, as received from backend or onnx.
     *  For debugging. */
    // deno-lint-ignore no-explicit-any
    readonly raw?:      any;

    /** URL to a classmap (segmentation result) */
    classmap?:          string;

    /** Boxes and labels of objects */
    #instances?:        MaybeInstances;

    constructor(
        status: ResultStatus        = 'unprocessed', 
        other:  Partial<Result>     = {}
    ) {
        this.status     = status;
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
    $visible:   signals.Signal<boolean>          = new signals.Signal(true)

    #$instances: signals.Signal<MaybeInstances>  = new signals.Signal(undefined)

    get $instances(): signals.ReadonlySignal<MaybeInstances> {
        return this.#$instances
    }

    /** @override */
    get instances(): MaybeInstances {
        return this.#$instances.peek()
    }

    /** @override */
    set_instances(instances: MaybeInstances): void {
        super.set_instances(instances)
        this.#$instances.value = instances;
    }

    /** Convert a basic non-state result to this class */
    static from_result(result:Result): ResultState {
        const resultstate = new ResultState()
        resultstate.set_instances(result.instances)
        return Object.assign(resultstate, result)
    }
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
class SettingsState extends Reactive<Settings|undefined> {}

/** Reactive AvailableModels */
class AvailableModelsState extends Reactive<AvailableModels|undefined> {}


/** Main application state structure */
export class AppState {
    /** Currently loaded files */
    files: AppFileList = new AppFileList([]);

    /** Indicates whether there is a processing operation running somewhere */
    processing: Reactive<boolean> = new Reactive<boolean>(false)

    /** Currently loaded settings */
    settings: SettingsState = new SettingsState(undefined)

    /** Which models can be selected in the settings */
    available_models: AvailableModelsState = new AvailableModelsState(undefined)
}

/** Global application state */
export const STATE = new AppState()



//make global for debugging
declare global {
    // deno-lint-ignore no-var
    var STATE: AppState;
}
globalThis.STATE = STATE;