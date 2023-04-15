import { signals, ReadonlySignal }      from "./dep.ts"
import { Settings, AvailableModels }            from "./logic/settings.ts";
import { Result, InputFile, type MaybeInstances }    from "./logic/files.ts";
import * as files                               from "./logic/files.ts";
import { ImageSize }                            from "./util.ts";

//for convenience
export {Result, InputFile, type MaybeInstances};


/** Helper class to prevent undefined initial values */
export class Reactive<T> extends signals.Signal<T> {
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
export function ResultSignalMixin<TBase extends Result >(BaseClass: Constructor<TBase>){
    /** Signal of a result with additional attributes for UI */
    return class ResultSignal extends Reactive<TBase> {
        /** Indicates whether the result should be displayed in the UI */
        $visible:   Reactive<boolean>   =   new Reactive(true)
    
        /** Signal of {@link Result.instances} */  //TODO: remove
        $instances: Reactive<MaybeInstances>  = new Reactive(undefined)
    
        constructor(result?:TBase) {
            super(result ?? new BaseClass('unprocessed'))
        }
    
        set(result_or_status:TBase|'processing') {
            if(result_or_status == 'processing')
                this.value = new BaseClass(result_or_status)
            else {
                this.set_instances(result_or_status.instances)
                this.value = result_or_status;
            }
        }
    
        set_instances(instances: MaybeInstances): void {
            this.value.set_instances(instances)
            this.$instances.value = instances;
        }
    }
}

export type  ResultSignalConstructor = ReturnType<typeof ResultSignalMixin<Result>>
/** Result with additional attributes for UI */
export type  ResultSignal  = InstanceType<ResultSignalConstructor>
export const ResultSignal: ResultSignalConstructor = ResultSignalMixin(Result)




/** Mixin that adds UI-specific attributes to an InputFile */
export function InputFileStateMixin<T extends Constructor<InputFile> >(BaseClass: T) {
    /** InputImage with added attributes for UI */
    return class InputFileState extends BaseClass {
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
}


export type  InputFileStateConstructor = ReturnType<typeof InputFileStateMixin<typeof InputFile>>
/** InputImage with added attributes for UI */
export type  InputFileState  = InstanceType<InputFileStateConstructor>
export const InputFileState: InputFileStateConstructor = InputFileStateMixin(InputFile)


/** InputImage and its corresponding Result */
export type InputResultPair = {
    input:   InputFileState;
    $result: ResultSignal;
}


/** Mixin factory creating a list class of input-result pairs */
export function InputFileListMixin<IFS extends InputFileState, RS extends ResultSignal>(
    IFSClass:Constructor<IFS>, 
    RSClass:Constructor<RS>
) {
    return class InputFileList extends Reactive<{input:IFS, $result:RS}[]>{
        /** Update the state to set new input files.
         *  @param files A list of `File` objects that will be converted to InputFiles
         */
        set_from_files(files:File[]|FileList): void {
            files = Array.from(files)
            super.value = files.map(
                (f:File) => ({
                    input:   new IFSClass(f),
                    $result: new RSClass(),
                })
            )
        }

        set_from_pairs(pairs:files.InputResultPair[]): void {
            super.value = pairs.map(
                ({input, result}: files.InputResultPair) => ({
                    input:   new IFSClass(input),
                    $result: new RSClass(result)
                })
            )
        }
    }
}

export type  InputFileListConstructor 
    = ReturnType<typeof InputFileListMixin<InputFileState, ResultSignal>>
/** Reactive list of input-result pairs */
export const InputFileList:InputFileListConstructor 
    = InputFileListMixin(InputFileState, ResultSignal)
export type  InputFileList = InstanceType<InputFileListConstructor>



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

