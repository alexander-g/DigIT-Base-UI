import { signals } from "./dep.ts"
import { Settings, AvailableModels } from "./logic/settings.ts";

/** Main input file structure with results */
export class AppFile extends File {

    #result:MaybeResult = null;

    constructor(f:File) {
        super([f], f.name, {type:f.type, lastModified:f.lastModified})
    }

    /** Set the result, overwritten in the reactive version */
    set_result(result: MaybeResult): void {
        this.#result = result;
    }

    get result(): Readonly<Result>|null {
        return this.#result;
    }
}

/** Processing result, all fields optional to force error checking */
export type Result = {
    /** URL to a classmap (segmentation result) */
    classmap?:      string
}

/** A result that maybe empty (e.g. not yet processed) */
export type MaybeResult = Result | null;


export type ImageSize = {
    width:  number;
    height: number;
}

/** Reactive version of AppFile */
export class AppFileState extends AppFile {
    #$loaded:   signals.Signal<boolean>     = new signals.Signal(false)
    #$result:   signals.Signal<MaybeResult> = new signals.Signal(super.result)
    #$size:     signals.Signal<ImageSize|undefined> = new signals.Signal()

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
    set_result(result: Result | null): void {
        this.#$result.value = result;
    }

    get $result(): signals.ReadonlySignal<MaybeResult> {
        return this.#$result;
    }

    /** @override */
    get result(): Readonly<Result> | null {
        return this.#$result.peek()
    }
}




/** Helper class to prevent undefined inital values */
class Reactive<T> extends signals.Signal<T> {
    /** Constructor making sure that undefined is not an option */
    constructor(x:T) {
        super(x)
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