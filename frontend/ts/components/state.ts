import { signals }                              from "../dep.ts"
import { Settings, AvailableModels }            from "../logic/settings.ts";
import { Result, Input }                        from "../logic/files.ts";
import * as files                               from "../logic/files.ts";
import { Constructor }                          from "../util.ts";

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


/** Convert {@link files.InputResultPair} to {@link InputResultPair}  */
export function input_result_signal_pairs_from_simple<I extends Input, R extends Result>(
    pairs: files.InputResultPair<I,R>[]
): InputResultPair<I,R>[] {
    return pairs.map(
        ({input, result}: files.InputResultPair<I,R>) => (
            {input, $result: new Signal<R>(result)}
        )
    )
}

/** Convert {@link files.Input} to {@link InputResultPair}  */
export function input_result_signal_pairs_from_inputs<I extends Input, R extends Result>(
    inputs: I[], ResultClass:Constructor<R, ConstructorParameters<typeof Result> >
): InputResultPair<I,R>[] {
    const simple_pairs: files.InputResultPair<I,R>[] = inputs.map(
        (input:I) => ({input, result:new ResultClass('unprocessed')})
    )
    return input_result_signal_pairs_from_simple(simple_pairs)
}



/** Reactive list of input-result pairs */
export class InputFileList<I extends Input, R extends Result> 
extends Signal< InputResultPair<I,R>[] >{}


/** Reactive AvailableModels */
class AvailableModelsSignal extends Signal<AvailableModels|undefined> {}


/** Main application state structure */
export class AppState<SETTINGS extends Settings = Settings> {
    /** Currently loaded files and their results */
    $files:InputFileList<Input, Result> = new Signal([])

    /** Indicates whether there is a processing operation running somewhere */
    $processing: Signal<boolean> = new Signal<boolean>(false)

    /** Currently loaded settings */
    $settings: Signal<SETTINGS|undefined> = new Signal(undefined)

    /** Which models can be selected in the settings */
    $available_models: AvailableModelsSignal = new AvailableModelsSignal(undefined)
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

