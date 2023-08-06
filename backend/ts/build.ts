#!./deno.sh run  --no-prompt --allow-read=./ --allow-write=./ --allow-env=DENO_DIR --allow-net=cdn.jsdelivr.net

import { preact_ssr }                   from "./dep.ts";
import { path, fs, flags }              from "./dep.ts"
import * as esbuild                     from "./esbuild.ts";

import * as paths                       from "./paths.ts"



type CompilationPaths = {
    /** The destination folder */
    static:         string;
    
    /** The root path that contains the files to be compiled.
     *  Compiled files are saved into `static` in subfolders relative to this one.
     */
    frontend:       string;
    
    /** Path to the main tsx file, relative to `frontend` */
    index_tsx:      string;

    /** Path to third-party dependencies/imports, relative to `frontend` */
    dep_ts:         string;

    /** Additional glob patterns relative to `frontend` to find files
     *  that need to be copied into `static` */
    copy_globs?:    string[];
}

export const DEFAULT_PATHS: CompilationPaths = {
    static          :   paths.static_folder(),
    frontend        :   paths.frontend(),
    index_tsx       :   'ts/index.tsx',
    dep_ts          :   'ts/dep.ts',
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
): Promise<void|Error> {
    check_paths(paths)

    if(clear)
        clear_folder(paths.static)
    
    const build:esbuild.ESBuild|Error = await esbuild.ESBuild.initialize(
        path.dirname(paths.frontend), paths.static
    )
    if(build instanceof Error){
        return build;
    }
    
    const promises: Promise<unknown>[] = []

    //copy css, assets and thirdparty JS into the static folder
    copy_files_to_static(paths)
    
    //transpile and bundle thirdparty dependencies to dep.ts
    const dep_ts:string = path.join(paths.frontend, paths.dep_ts)
    
    //bundle third-party dependencies
    promises.push(
        build.compile_esbuild(
            dep_ts, 
            path.join(paths.static,   paths.dep_ts)
        )
    )

    //transpile and bundle index.tsx
    promises.push(
        build.compile_esbuild(
            path.join(paths.frontend, paths.index_tsx), 
            path.join(paths.static,   paths.index_tsx), 
            {[dep_ts]: './dep.ts'}
        )
    )

    //compile the main JSX <Index /> element into index.html
    promises.push(
        compile_index(paths)
    )
    
    await Promise.all(promises)
}

export async function compile_default(
    overrides:Partial<CompilationPaths> = {}
): Promise<void|Error> {
    return await compile_everything({...DEFAULT_PATHS, ...overrides}, true)
}

/** Compile the main frontend JSX component `<Index/>` and write to the static folder */
export async function compile_index(paths: CompilationPaths): Promise<void> {
    const path_to_index: string = path.join(paths.frontend, paths.index_tsx)
    // deno-lint-ignore no-explicit-any
    const module: { Index?: () => any } = await import(path_to_index)
    if(!module.Index)
        throw new Error('Could not find <Index/> component')
    
    // deno-lint-ignore no-explicit-any
    const main_element:any = module.Index()
    const rendered:string  = preact_ssr.render(main_element, {}, {pretty:true})
    write_to_static(
        path.basename(paths.index_tsx).replace('.tsx', '.html'), paths.static, rendered
    )
}

type GlobPaths = Pick<CompilationPaths, 'frontend'|'static'|'copy_globs'>

export function copy_files_to_static(paths:GlobPaths): void {
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

export function clear_folder(path:string): void {
    try {
        Deno.removeSync(path, {recursive:true})
    // deno-lint-ignore no-empty
    } catch {}
    
    fs.ensureDirSync(path)
}


function parse_args(): Record<string, string> & {copy_globs:string[]} {
    const args:Record<string, string>  = flags.parse(
        Deno.args, {default: {...DEFAULT_PATHS, copy_globs:undefined} }
    )
    const copy_globs:string[] = args.copy_globs?.split(',') ?? [];
    
    return Object.assign(args, {copy_globs})
}

if(import.meta.main){
    const args: Record<string,string> = parse_args()

    const paths:CompilationPaths = {...DEFAULT_PATHS, ...args}
    clear_folder(paths.static)
    //copy assets/thirdparty files even from downstream //TODO: need some kind of flag
    copy_files_to_static({
        frontend:   DEFAULT_PATHS.frontend,   //!
        copy_globs: DEFAULT_PATHS.copy_globs, //!
        static:     paths.static,
    })
    
    const rc: void|Error = await compile_everything(paths, false)
    if(rc instanceof Error){
        console.log(rc.message+'\n')
        Deno.exit(1)
    }
}
