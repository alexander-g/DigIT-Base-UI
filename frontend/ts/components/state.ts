import { signals }                              from "../dep.ts"
import { Settings, AvailableModels }            from "../logic/settings.ts";
import { Result, Input }                        from "../logic/files.ts";
import * as files                               from "../logic/files.ts";
import { Constructor }                          from "../util.ts";
import { set_image_src }                        from "./ImageComponents.tsx";

import * as util       from "../util.ts";
import * as file_input from "./file_input.ts";

//for convenience
export { Result }
export type {Input}


/** Helper class to prevent undefined initial values */
export class Signal<T> extends signals.Signal<T> {
    /** Constructor making sure that undefined is not an option */
    constructor(x:T) {
        super(x)
    }
}


/** Input and its corresponding Result as a signal */
export type InputResultPair<I extends Input, R extends Result> = {
    input:   I;
    $result: Signal<R>;
}


/** Convert {@link files.InputResultPair}[] to {@link InputResultPair}[]  */
export function input_result_signal_pairs_from_simple<I extends Input, R extends Result>(
    pairs: files.InputResultPair<I,R>[]
): InputResultPair<I,R>[] {
    return pairs.map(
        ({input, result}: files.InputResultPair<I,R>) => (
            {input, $result: new Signal<R>(result)}
        )
    )
}

/** Convert {@link InputResultPair}[] to {@link files.InputResultPair}[]  */
export function input_result_simple_pairs_from_signals<I extends Input, R extends Result>(
    pairs: InputResultPair<I,R>[]
): files.InputResultPair<I,R>[] {
    return pairs.map(
        ({input, $result}: InputResultPair<I,R>) => (
            {input, result: $result.value}
        )
    )
}


/** Convert {@link files.Input} to {@link InputResultPair}  */
export function input_result_signal_pairs_from_inputs<I extends Input, R extends Result>(
    inputs: I[], ResultClass:Constructor<R, ConstructorParameters<typeof Result> >
): InputResultPair<I,R>[] {
    const simple_pairs: files.InputResultPair<I,R>[] = inputs.map(
        (input:I) => ({input, result:new ResultClass('unprocessed', null, input.name)})
    )
    return input_result_signal_pairs_from_simple(simple_pairs)
}



type HTMLDisplayable = {
    set_image_src: (htmlimage: HTMLImageElement) => unknown;
}

export class InputImageFile extends files.InputFile implements HTMLDisplayable {
    async set_image_src(htmlimage: HTMLImageElement): Promise<unknown> {
        return await set_image_src(htmlimage, this)
    }
}




/** Reactive list of input-result pairs */
export class InputFileList<I extends Input, R extends Result> 
extends Signal< InputResultPair<I,R>[] >{}


/** Reactive AvailableModels */
class AvailableModelsSignal<S extends Settings> 
    extends Signal<AvailableModels<S>|undefined> {}


/** Main application state structure */
export class AppState<
//I extends Input = Input, 
//R extends Result = Result, 
SETTINGS extends Settings = Settings
> {
    /** Currently loaded files and their results */
    $files:InputFileList<Input, Result> = new Signal([])

    /** Indicates whether there is a processing operation running somewhere */
    $processing: Signal<boolean> = new Signal<boolean>(false)

    /** Currently loaded settings */
    $settings: Signal<SETTINGS|undefined> = new Signal(undefined)

    /** Which models can be selected in the settings */
    $available_models: AvailableModelsSignal<SETTINGS> 
        = new AvailableModelsSignal(undefined)
    
    
    /** @virtual */
    InputClass:files.InputClassInterface<Input> = files.InputFile;

    /** @virtual */
    ResultClass:files.ResultClassInterface<files.Result> = files.Result;

    /** Filter a list of potential input or result files and set $files.
     *  @virtual */
     async set_files(files_raw: FileList|File[]): Promise<void>{
        const previous_pairs: files.InputResultPair<Input,Result>[] 
            = input_result_simple_pairs_from_signals(this.$files.value)
        
        //reset state
        //TODO: send clear cache request to backend
        this.$files.value = []
        //refresh ui
        await util.wait(1)
        //load the new files
        this.$files.value = input_result_signal_pairs_from_simple(
            await file_input.load_list_of_files(
                files_raw ?? [], 
                this.InputClass,
                this.ResultClass, 
                previous_pairs
            )
        )
    }
}


/** Utility type extracting the `InputResultPair` type of a {@link AppState} */
export type InputResultPairOfAppState<AS extends AppState>
    = NonNullable<ReturnType<AS['$files']['value']['at']>>

/** Utility type extracting the `Input` type of a {@link AppState} */
export type InputTypeOfAppState<AS extends AppState> 
    = InputResultPairOfAppState<AS>['input']

/** Utility type extracting the `Result` type of a {@link AppState} */
export type ResultTypeOfAppState<AS extends AppState>
    = InputResultPairOfAppState<AS>['$result']['value']

/** Utility type extracting the `Settings` type of a {@link AppState} */
export type SettingsOfAppState<AS extends AppState>
    = NonNullable<AS['$settings']['value']>



//making application state global for debugging
declare global {
    // deno-lint-ignore no-var
    var STATE: AppState|undefined;
}


/** Global application state setter */
export function set_global_app_state(state:AppState){
    globalThis.STATE = state;
}

