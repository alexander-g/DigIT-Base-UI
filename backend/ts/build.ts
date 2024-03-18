#!./deno.sh run  --no-prompt --allow-read=./ --allow-write=./ --allow-env=DENO_DIR --allow-net=cdn.jsdelivr.net

import { preact_ssr }                   from "./dep.ts";
import { path, fs, flags }              from "./dep.ts"
import * as esbuild                     from "./esbuild.ts";

import * as paths                       from "./paths.ts"



export type CompilationPaths = {
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

    /** Paths to modules that should be replaced with empty stubs.
     *  Relative to `frontend` or absolute path */
    stubs?:         string[];

    /** Additional glob patterns relative to `frontend` to find files
     *  that need to be copied into `static` */
    copy_globs?:    string[];
}

/** This stub is local to this repo and should be always included */
const DENO_DEP_DEFAULT_STUB:string = path.fromFileUrl(
    import.meta.resolve('../../frontend/ts/dep.deno.ts')
)

//TODO: too many assumptions, at least rename to BASE_PATHS
export const DEFAULT_PATHS: CompilationPaths = {
    static          :   paths.static_folder(),
    frontend        :   paths.frontend(),
    index_tsx       :   'ts/index.tsx',
    dep_ts          :   'ts/dep.ts',
    stubs           :   [DENO_DEP_DEFAULT_STUB],
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
): Promise<true|Error> {
    check_paths(paths)

    if(clear)
        clear_folder(paths.static)
    
    const build:esbuild.ESBuild|Error = await esbuild.ESBuild.initialize(
        path.dirname(paths.frontend),   // too hard-coded
        paths.static
    )
    if(build instanceof Error){
        return build;
    }
    
    const promises: Promise<unknown>[] = []

    //copy css, assets and thirdparty JS into the static folder
    copy_files_to_static(paths)
    
    //bundle third-party dependencies into a dep.ts
    const dep_ts_input:string  = path.join(paths.frontend, paths.dep_ts)
    const dep_ts_output:string = path.join(paths.static,   paths.dep_ts)
    //except some specified modules (e.g. deno modules)
    const stub_remap: Record<string,string> = create_stub_file(
        paths.frontend, path.dirname(dep_ts_output), paths.stubs ?? []
    )
    promises.push(
        build.compile_esbuild(dep_ts_input, dep_ts_output+'.js', stub_remap)
    )

    //transpile and bundle index.tsx
    const index_remap: Record<string,string> = {
        [dep_ts_input]: './dep.ts.js', 
        ...stub_remap
    }
    promises.push(
        build.compile_esbuild(
            path.join(paths.frontend, paths.index_tsx), 
            path.join(paths.static,   paths.index_tsx)+'.js', 
            index_remap
        )
    )

    //compile the main JSX <Index /> element into index.html
    promises.push(
        compile_index(paths)
    )
    
    await Promise.all(promises)
    return true;
}

export async function compile_default(
    overrides:Partial<CompilationPaths> = {}
): Promise<true|Error> {
    return await compile_everything({...DEFAULT_PATHS, ...overrides}, true)
}

/** Compile the main frontend JSX component `<Index/>` and write to the static folder */
export async function compile_index(paths: CompilationPaths, props?:Record<string, unknown>): Promise<void> {
    const path_to_index: string = path.toFileUrl( 
        path.join(paths.frontend, paths.index_tsx) 
    ).href
    // deno-lint-ignore no-explicit-any
    const module: { Index?: (props?:Record<string, any>) => any } = await import(path_to_index)
    if(!module.Index)
        throw new Error('Could not find <Index/> component')
    
    // deno-lint-ignore no-explicit-any
    const main_element:any = module.Index(props)
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

function join_if_relative(...paths:string[]): string {
    if(paths.length == 0)
        return '';
    
    const lastpath:string = paths[paths.length-1]!;
    if(path.isAbsolute(lastpath))
        return lastpath;
    //else
    return path.join(...paths);
}

/** Create an empty file in the output folder that will serve as a replacement
 *  for `modules_to_stub`. */
function create_stub_file(
    inputfolder:     string,
    outputfolder:    string, 
    modules_to_stub: string[],
): Record<string, string> {
    if(modules_to_stub.length == 0)
        return {}
    
    // deno-lint-ignore no-inferrable-types
    const stubfilename:string = './stub.ts.js'
    write_to_static(stubfilename, outputfolder, '')

    const remap: Record<string, string> = Object.fromEntries(
        modules_to_stub.map(
            (p:string) => [join_if_relative(inputfolder, p), stubfilename]
        )
    )
    return remap;
}


export async function compile_and_copy(
    paths: CompilationPaths,
): Promise<true|Error> {
    clear_folder(paths.static);
    //copy assets/thirdparty files even from downstream //TODO: need some kind of flag
    copy_files_to_static({
        frontend:   DEFAULT_PATHS.frontend,   //!
        copy_globs: DEFAULT_PATHS.copy_globs, //!
        static:     paths.static,
    })

    const status:true|Error = await compile_everything(paths, false)
    return status;
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
    const status: true|Error = await compile_and_copy(paths)
    if(status instanceof Error){
        console.log(status.message+'\n')
        Deno.exit(1)
    }
}
