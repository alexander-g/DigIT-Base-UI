import { signals, Signal, ReadonlySignal }      from "./dep.ts"
import { Settings, AvailableModels }            from "./logic/settings.ts";
import { Result, InputFile, type MaybeInstances }    from "./logic/files.ts";
import * as files                               from "./logic/files.ts";
import { ImageSize }                            from "./util.ts";

//for convenience
export {Result, InputFile, type MaybeInstances};


/** Helper class to prevent undefined initial values */
class Reactive<T> extends signals.Signal<T> {
    /** Constructor making sure that undefined is not an option */
    constructor(x:T) {
        super(x)
    }
}

/** From https://github.com/sindresorhus/type-fest/blob/5374588a88ee643893784f66367bc26b8e6509ec/source/basic.d.ts */
// deno-lint-ignore no-explicit-any
export type Constructor<T, Arguments extends unknown[] = any[]>
    = new(...arguments_: Arguments) => T;


/** Mixin adding additional attributes for UI*/
export function createResultStateClass<TBase extends Constructor<Result> >(BaseClass:TBase)  {
    /** Result with additional attributes for UI */
    return class ResultState extends BaseClass {
        /** Indicates whether the result should be displayed in the UI */
        $visible:       Signal<boolean>         = new Signal(true)

        /** Signal of {@link Result.instances} */
        #$instances:    Signal<MaybeInstances>  = new Signal(undefined)

        /** @override Set instances notifying signal listeners */
        set_instances(instances: MaybeInstances): void {
            super.set_instances(instances)
            this.#$instances.value = instances
        }

        /** Signal of {@link Result.instances} 
         * (readonly getter, set via {@link ResultState.set_instances}) */
        get $instances(): ReadonlySignal<MaybeInstances> {
            return this.#$instances;
        }
    };
}

type ResultStateConstructor = ReturnType<typeof createResultStateClass<typeof Result>>

/** Result with additional attributes for UI */
export type ResultState  = InstanceType<ResultStateConstructor>
export const ResultState: ResultStateConstructor = createResultStateClass(Result)



/** InputImage with added attributes for UI */
export class InputFileState extends InputFile {
    /** Flag indicating whether the input image has been loaded */
    $loaded: ReadonlySignal<boolean>       = signals.computed(
        () => this.#$size.value != undefined
    )
    /** Size of the input image */
    #$size:  Signal<ImageSize|undefined> = new Signal()

    /** Size of the input image (getter, set via `set_loaded()`) */
    get $size(): ReadonlySignal<ImageSize|undefined> { return this.#$size; }

    set_loaded(image:HTMLImageElement): void {
        this.#$size.value   = {
            width:  image.naturalWidth,
            height: image.naturalHeight,
        }
    }
}

/** InputImage and its corresponding Result */
export type InputResultPair = {
    input:   InputFileState;
    $result: Signal<ResultState>;
}

/** Reactive list of InputImage-Result pairs */
export class InputFileList extends Reactive<InputResultPair[]> {
    /**
     * Update the state to set new input files.
     * @param files A list of `File` objects that will be converted to InputFiles
     */
    set_from_files(files:File[]|FileList): void {
        files = Array.from(files)
        super.value = files.map(
            (f:File) => ({
                input:   new InputFileState(f),
                $result: new Signal(new ResultState()),
            })
        )
    }

    set_from_pairs(pairs:files.InputResultPair[]): void {
        super.value = pairs.map(
            ({input, result}: files.InputResultPair) => ({
                input:   new InputFileState(input),
                $result: new Signal(new ResultState(result.status, result))
            })
        )
    }
}

/** Reactive Settings */
class SettingsState extends Reactive<Settings|undefined> {}

/** Reactive AvailableModels */
class AvailableModelsState extends Reactive<AvailableModels|undefined> {}


/** Main application state structure */
export class AppState {
    /** Currently loaded files and their results */
    files:InputFileList = new InputFileList([])

    /** Indicates whether there is a processing operation running somewhere */
    $processing: Reactive<boolean> = new Reactive<boolean>(false)

    /** Currently loaded settings */
    settings: SettingsState = new SettingsState(undefined)

    /** Which models can be selected in the settings */
    available_models: AvailableModelsState = new AvailableModelsState(undefined)
}





//making application state global for debugging
declare global {
    // deno-lint-ignore no-var
    var STATE: AppState|undefined;
}


/** Global application state setter */
export function set_global_app_state(state:AppState){
    globalThis.STATE = state;
}

