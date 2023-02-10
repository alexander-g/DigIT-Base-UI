import { signals } from "./dep.ts"

/** Main input file structure with results */
export class AppFile extends File {
    // deno-lint-ignore no-inferrable-types
    loaded:boolean = false;


    constructor(f:File) {
        super([f], f.name, {type:f.type, lastModified:f.lastModified})
    }
}





/** Reactive version of AppFile */
export class AppFileState extends AppFile {
    $loaded: signals.Signal<boolean> = new signals.Signal(this.loaded)
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