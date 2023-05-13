import { signals, ReadonlySignal }              from "./dep.ts"
import { Settings, AvailableModels }            from "./logic/settings.ts";
import { Result, InputFile, type MaybeInstances }    from "./logic/files.ts";
import * as files                               from "./logic/files.ts";
import { ImageSize, Constructor }               from "./util.ts";

//for convenience
export {Result, InputFile, type MaybeInstances};


/** Helper class to prevent undefined initial values */
export class Reactive<T> extends signals.Signal<T> {
    /** Constructor making sure that undefined is not an option */
    constructor(x:T) {
        super(x)
    }
}



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

/** Result with additional attributes for UI */
export class ResultSignal extends ResultSignalMixin(Result){}

/** Parameterizable input file list type.
 * @example let file_list:GenericResultSignal<Result> = new ResultSignal(...) */
type GenericResultSignal<R extends Result> = InstanceType<
    ReturnType< 
        typeof ResultSignalMixin<R> 
    >
>



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


/** InputImage with added attributes for UI */
export class InputFileState extends InputFileStateMixin(InputFile) {}

/** Parameterizable input file list type.
 * @example let file_list:GenericInputFileState<InputFile> = new InputFileState(...) */
type GenericInputFileState<IF extends InputFile> = InstanceType<
    ReturnType<
        typeof InputFileStateMixin< Constructor<IF> >
    >
>


/** InputImage and its corresponding Result */
export type InputResultPair<IF extends InputFile = InputFile, R extends Result = Result> = {
    input:   GenericInputFileState<IF>;
    $result: GenericResultSignal<R>;
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

/** Reactive list of input-result pairs */
export class InputFileList extends InputFileListMixin(InputFileState, ResultSignal){}


/** Parameterizable input file list type.
 * @example let file_list:GenericInputFileList<InputFile, Result> = new InputFileList([]) */
export type GenericInputFileList<IF extends InputFile, R extends Result >
    = InstanceType< 
        ReturnType< 
            typeof InputFileListMixin<
                GenericInputFileState<IF>, 
                GenericResultSignal<R>
            > 
        > 
    >


/** Reactive AvailableModels */
class AvailableModelsSignal extends Reactive<AvailableModels|undefined> {}


/** Main application state structure */
export class AppState<SETTINGS extends Settings = Settings> {
    /** Currently loaded files and their results */
    files:InputFileList = new InputFileList([])

    /** Indicates whether there is a processing operation running somewhere */
    $processing: Reactive<boolean> = new Reactive<boolean>(false)

    /** Currently loaded settings */
    settings: Reactive<SETTINGS|undefined> = new Reactive(undefined)

    /** Which models can be selected in the settings */
    available_models: AvailableModelsSignal = new AvailableModelsSignal(undefined)
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

