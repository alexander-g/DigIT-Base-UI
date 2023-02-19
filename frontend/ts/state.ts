import { signals } from "./dep.ts"

/** Main input file structure with results */
export class AppFile extends File {
    // deno-lint-ignore no-inferrable-types
    loaded:boolean = false;

    result:Result|null = null;

    constructor(f:File) {
        super([f], f.name, {type:f.type, lastModified:f.lastModified})
    }
}

export class Result {}


export type ImageSize = {
    width:  number;
    height: number;
}

/** Reactive version of AppFile */
export class AppFileState extends AppFile {
    #$loaded:   signals.Signal<boolean>     = new signals.Signal(this.loaded)
    $result:    signals.Signal<Result|null> = new signals.Signal(this.result)
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
}


/** Reactive list of AppFiles */
export class AppFileList extends signals.Signal<AppFileState[]> {
    /** Constructor making sure that undefined is not an option */
    constructor(files:AppFileState[]) {
        super(files)
    }

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

/** Main application state structure */
export class AppState {
    /** Currently loaded files */
    files: AppFileList = new AppFileList([]);
}

/** Global application state */
export const STATE = new AppState()


declare global {
    // deno-lint-ignore no-var
    var STATE: AppState;
}

globalThis.STATE = STATE;