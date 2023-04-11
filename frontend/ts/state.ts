import { signals, ReadonlySignal }      from "./dep.ts"
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
        $visible:       Reactive<boolean>         = new Reactive(true)

        /** Signal of {@link Result.instances} */
        #$instances:    Reactive<MaybeInstances>  = new Reactive(undefined)

        /** Signal of {@link Result.status} */
        #$status:       Reactive<files.ResultStatus> = new Reactive(this.status)

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

        copy_from(other:Result): void {
            //TODO? signals.batch()?
            this.status   = other.status
            this.classmap = other.classmap
            this.set_instances(other.instances)
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
    #$size:  Reactive<ImageSize|undefined> = new Reactive(undefined)

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
    $result: Reactive<ResultState>;
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
                $result: new Reactive(new ResultState()),
            })
        )
    }

    set_from_pairs(pairs:files.InputResultPair[]): void {
        super.value = pairs.map(
            ({input, result}: files.InputResultPair) => ({
                input:   new InputFileState(input),
                $result: new Reactive(new ResultState(result.status, result))
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

