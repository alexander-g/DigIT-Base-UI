#!./deno.sh run --allow-read=./frontend,./static --allow-write=./static --no-prompt

import { preact_ssr, sucrase }          from "./dep.ts";
import { path, fs, flags }              from "./dep.ts"

import * as paths                       from "./paths.ts"



type CompilationPaths = {
    /** The destination folder */
    static:         string;
    
    /** The root path that contains the files to be compiled.
     *  Compiled files are saved into `static` in subfolders relative to this one.
     */
    frontend:       string;
    
    /** Glob pattern relative to the root path `frontend` to find files 
     *  that need to be compiled. E.g: `'**\/*.ts{x,}'` */
    frontend_glob:  string;
    
    /** Path to the main tsx file, relative to `frontend` */
    index_tsx:      string;

    /** Additional glob patterns relative to `frontend` to find files
     *  that need to be copyied into `static` */
    copy_globs?:    string[];
}

export const DEFAULT_PATHS: CompilationPaths = {
    static          :   paths.static_folder(),
    frontend        :   paths.frontend(),
    frontend_glob   :   'ts/**/*.ts{x,}',
    index_tsx       :   'ts/index.tsx',
    copy_globs      :   [
        'css/**/*.*',
        'thirdparty/**/*.*',
        'favicon.ico',
        'logo.svg',
    ]
}


/** Collect all files matching a glob pattern in a root directory.
 * @return Matched paths, relative to `root`
 */
function collect_files(glob_pattern:string, root:string): string[] {
    const full_glob_pattern:string = path.join(root, glob_pattern)
    const paths:string[] = Array.from( 
        fs.expandGlobSync(full_glob_pattern, {root:'/'}) 
    ).map(
        (entry: fs.WalkEntry) => path.relative(root, entry.path)
    )
    return paths;
}

function check_paths(paths: CompilationPaths): void {
    if(!path.isAbsolute(paths.frontend) || !path.isAbsolute(paths.static)) {
        throw new Error('Compilation paths `frontend` and `static` must be absolute')
    }
}

/** Compile/render all frontend files into the `static` folder for serving. */
export async function compile_everything(
    paths: CompilationPaths, 
    clear: boolean
): Promise<void> {
    check_paths(paths)

    if(clear)
        clear_folder(paths.static)
    
    copy_files_to_static(paths)
    for(const filepath of collect_files(paths.frontend_glob, paths.frontend)){
        const jscode:string = transpile( path.join(paths.frontend, filepath) )
        write_to_static(filepath, paths.static, jscode)
    }
    return await compile_index(paths)
}

export async function compile_default(overrides:Partial<CompilationPaths> = {}): Promise<void> {
    //TODO: (need to coordinate with flask) clear static
    await compile_everything({...DEFAULT_PATHS, ...overrides}, true)
}

/** Compile the main frontend JSX component `<Index/>` and write to the static folder */
export async function compile_index(paths: CompilationPaths): Promise<void> {
    const path_to_index: string = path.join(paths.frontend, paths.index_tsx)
    // deno-lint-ignore no-explicit-any
    const module: { Index?: () => any } = await import(path_to_index)
    if(!module.Index)
        throw new Error('Could not find Index component')
    
    // deno-lint-ignore no-explicit-any
    const main_element:any = module.Index()
    const rendered:string  = preact_ssr.render(main_element, {}, {pretty:true})
    write_to_static(path.basename(paths.index_tsx).replace('.tsx', '.html'), paths.static, rendered)

}

export function copy_files_to_static(paths:CompilationPaths): void {
    //TODO: make async
    for(const pattern of paths.copy_globs ?? []) {
        const files_to_copy:string[] = collect_files(pattern, paths.frontend)
        if(files_to_copy.length == 0)
            throw new Error(`No files found for glob pattern "${pattern}"`)
        
        for(const file of files_to_copy){
            const fullpath:string    = path.join(paths.frontend, file)
            const destination:string = path.join(paths.static, file)
            fs.ensureFileSync(destination)
            fs.copySync(fullpath, destination, {overwrite:true})
        }
    }
}

export function write_to_static(filepath:string, destination:string, content:string) {
    const outputfile:string = path.join(destination, filepath)
    //ensure sub-directories exist
    fs.ensureFileSync(outputfile)
    Deno.writeTextFileSync(outputfile, content)
}

/** Read and convert a TypeScript/TSX file into JavaScript */
function transpile(path:string): string {
    const raw:string = Deno.readTextFileSync(path)
    const transpiled:sucrase.TransformResult = sucrase.transform(
      raw,
      {
        transforms:         ['jsx', 'typescript'],
        production:         true,
        jsxImportSource:    'preact',
        jsxPragma:          'preact.h',
        jsxFragmentPragma:  'preact.Fragment',
        filePath:           path,
      }
    )
    return transpiled.code;
}

export function clear_folder(path:string): void {
    Deno.removeSync(path, {recursive:true})
    fs.ensureDirSync(path)
}


if(import.meta.main){
    //const args: Record<string, string> = flags.parse(Deno.args);
    compile_default()
}
