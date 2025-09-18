#!./deno.sh run  --no-prompt --allow-read=./ --allow-write=./ --allow-run=deno

import { preact_ssr }                   from "./dep.ts";
import { path, fs, cli }              from "./dep.ts"

import * as paths                       from "./paths.ts"



export type CompilationPaths = {
    /** The destination folder. */
    static: string

    /** All directories that contain the sources to be compiled. */
    srcdirs: string[]

    /** Absolute path to main tsx file, must be in one of `srcdirs`. */
    index_tsx: string

    /** Absolute paths to modules that should be replaced with empty stubs.
     *  Must be in one of `srcdirs`. */
    stubs?: string[];

    /** Additional glob patterns for files that need to be copied into `static`.
     *  Absolute paths, must be in one of `srcdirs`. */
    copy_globs?: string[]
}


function path_from_this_file(relpath:string): string {
    return path.fromFileUrl(import.meta.resolve(relpath))
}

/** This stub is local to this repo and should be always included */
const DENO_DEP_DEFAULT_STUB:string = 
    path_from_this_file('../../frontend/ts/dep.deno.ts')

const BASE_INDEX_TSX:string = 
    path_from_this_file('../../frontend/ts/index.tsx')

const BASE_COPY_GLOBS: string[] = [
    '../../frontend/css/**/*.*',
    '../../frontend/thirdparty/**/*.*',
    '../../frontend/favicon.ico',
    '../../frontend/logo.svg',
].map( path_from_this_file )


export const BASE_PATHS: CompilationPaths = {
    static          :   paths.static_folder(),
    srcdirs         :   [paths.frontend()],
    index_tsx       :   BASE_INDEX_TSX,
    stubs           :   [DENO_DEP_DEFAULT_STUB],
    copy_globs      :   BASE_COPY_GLOBS
}




function resolve_paths(paths: CompilationPaths): CompilationPaths {
    const new_srcdirs:string[] = []
    for(const srcdir of paths.srcdirs)
        new_srcdirs.push( path.resolve(srcdir) )
    
    const new_stubs:string[] = []
    for(const stub of paths.stubs ?? [])
        new_stubs.push( path.resolve(stub) )
    
    const new_copy_globs:string[] = []
    for(const glob of paths.copy_globs ?? [])
        new_copy_globs.push( path.resolve(glob) )

    return {
        static:    path.resolve(paths.static),
        srcdirs:   new_srcdirs,
        index_tsx: path.resolve(paths.index_tsx),
        stubs:     new_stubs,
        copy_globs:new_copy_globs,
    }
}

/** Compile/render all frontend files into the `static` folder for serving. */
export async function compile_everything(
    paths: CompilationPaths, 
    clear: boolean
): Promise<true|Error> {
    paths = resolve_paths(paths);

    if(clear)
        clear_folder(paths.static)
    
    const build:DenoBundle|Error = await DenoBundle.initialize(
        paths.srcdirs,
        paths.static
    )
    if(build instanceof Error){
        return build;
    }
    
    const promises: Promise<unknown>[] = []


    //transpile and bundle index.tsx into index.tsx.js
    const outputfile:string = 
        path.join(paths.static, path.basename(paths.index_tsx))+'.js'
    promises.push(
        build.bundle(
            paths.index_tsx, 
            outputfile, 
            paths.stubs ?? [],
        )
    )

    //compile the main JSX <Index /> element into index.html
    promises.push(
        compile_index(paths)
    );
    
    //copy css, assets and thirdparty JS into the static folder
    copy_files_to_static(paths)
    
    const status:boolean = ( await Promise.all(promises) ).every(Boolean)
    if(!status)
        return new Error('Compilation failed')
    // else
    return true;
}

export async function compile_default(
    overrides:Partial<CompilationPaths> = {}
): Promise<true|Error> {
    return await compile_everything({...BASE_PATHS, ...overrides}, true)
}


class DenoBundle {
    // the location where source files are copied into
    private bundleroot:string;

    async bundle(
        inputfile:  string, 
        outputfile: string, 
        stubs:      string[],
    ): Promise<boolean> {
        const srcdir_map:Record<string,string> = this.copy_and_stub(stubs)
        const index_root:string|Error = 
            find_file_in_folders(inputfile, this.srcdirs)
        if(index_root instanceof Error)
            return false;
            //return index_root as Error
        inputfile = path.join(
            srcdir_map[index_root]!, 
            path.relative(index_root, inputfile)
        )

        const command = new Deno.Command(
            Deno.execPath(), 
            {
                args: [
                    'bundle',
                    `--output=${outputfile}`, 
                    '--platform=browser',
                    '--sourcemap=inline',
                    //'--minify',
                    inputfile,
                ],
                stderr: "inherit"
            }
        );
        console.log(fs.existsSync(inputfile))
        console.log([
            'bundle',
            `--output=${outputfile}`, 
            '--platform=browser',
            '--sourcemap=inline',
            '--minify',
            inputfile,
        ].join('\n'))
        
        const output:Deno.CommandOutput = await command.outputSync()
        if(!output.success)
            return false;
            //return new Error(`deno bundle failed with code ${output.code}`)
        //else

        return true;
    }

    /** Factory function */
    static initialize(srcdirs:string[], outputdir:string): DenoBundle|Error {
        const status:true|Error = 
            DenoBundle.check_permissions(srcdirs, outputdir)
        if(status instanceof Error)
            return status as Error;
        
        return new DenoBundle(srcdirs, outputdir)
    }

    private constructor(
        private readonly srcdirs:   string[], 
        private readonly outputdir: string
    ){
        this.bundleroot = path.join(this.outputdir, self.crypto.randomUUID())
    }

    private copy_and_stub(stubs:string[]):Record<string,string> {
        const srcdir_map:Record<string,string> = {}
        
        for(const srcdir of this.srcdirs){
            // TODO: technically not correct, should be not relative to cwd
            const basename:string = path.relative(Deno.cwd(), srcdir)
            const new_srcdir:string = path.join(this.bundleroot, basename)
            fs.copySync(srcdir, new_srcdir)
            srcdir_map[srcdir] = new_srcdir
        }
        
        for(const stub of stubs){
            const stubroot:string|Error = 
                find_file_in_folders(stub, this.srcdirs)
            if(stubroot instanceof Error)
                throw stubroot as Error;
            
            const stubthis:string = 
                path.join(
                    srcdir_map[stubroot]!, 
                    path.relative(stubroot, stub)
                )
            //fs.ensureFileSync(stubthis)
            Deno.writeTextFileSync(stubthis, ``);
        }
        return srcdir_map;
    }

    static check_permissions(srcdirs:string[], outputdir:string): true|Error {
        const permissions_error = new Error(`Required permissions):\n`
            +`--allow-run=deno\n`
            +`--allow-read=./${srcdirs.join(',')}\n`
            +`--allow-write=./${outputdir}\n`
        )

        const perms:Deno.Permissions = Deno.permissions;
        for(const srcdir of srcdirs){
            if(perms.querySync({name:"read", path:srcdir}).state != "granted")
                return permissions_error
        }

        if(perms.querySync({name:"run", command:"deno"}).state != "granted"
        || perms.querySync({name:"write", path:outputdir}).state !=  "granted"
        ){
            return permissions_error;
        }
        // else
        return true;
    }
}

// TODO: remove, only here for debugging
export function wait(ms: number): Promise<unknown> {
    return new Promise((resolve: (x:unknown) => void) => {
        setTimeout(() => resolve(0), ms)
    })
}



/** Compile the main frontend JSX component `<Index/>` and write to the static folder */
export async function compile_index(
    paths: CompilationPaths, 
    props?:Record<string, unknown>
): Promise<true> {
    const path_to_index: string = path.toFileUrl( paths.index_tsx).href
    const module: { Index?: (props?:Record<string, unknown>) => unknown } = 
        await import(path_to_index)
    if(!module.Index)
        throw new Error('Could not find <Index/> component')
    
    // deno-lint-ignore no-explicit-any
    const main_element:any = module.Index(props)
    const rendered:string  = preact_ssr.render(main_element, {}, {pretty:true})
    write_to_static(
        path.basename(paths.index_tsx).replace('.tsx', '.html'), 
        paths.static, 
        rendered
    )
    return true;
}


function is_subpath(candidate: string, parent: string): boolean {
    const c:string = path.resolve(candidate);
    const p:string = path.resolve(parent);
    const sep:string = path.SEPARATOR;
    return c === p || c.startsWith(p.endsWith(sep) ? p : p + sep);
}

function find_file_in_folders(filepath:string, folders:string[]): string|Error {
    for(const folder of folders) {
        if(is_subpath(filepath, folder))
            return folder;
    }
    return new Error(`${filepath} is not in ${folders}`)
}


type AbsoluteAndRelativePaths = {
    abspath: string;
    relpath: string;
}

/** Collect all files matching a glob pattern, returning absolute path and 
 *  path relative to a srcdir */
function collect_files(
    glob_pattern: string, 
    srcdirs:      string[],
): AbsoluteAndRelativePaths[]|Error {
    const result:AbsoluteAndRelativePaths[] = []
    for(const entry of fs.expandGlobSync(glob_pattern, {root:'/'})){
        const abspath:string = path.resolve(entry.path)
        const root:string|Error = find_file_in_folders(abspath, srcdirs)
        if(root instanceof Error)
            return root as Error;
        
        const relpath:string = path.relative(root, abspath)
        result.push({abspath, relpath})
    }
    return result;
}


type GlobPaths = Pick<CompilationPaths, 'srcdirs'|'static'|'copy_globs'>

export function copy_files_to_static(paths:GlobPaths): void {
    //TODO: make async
    for(const pattern of paths.copy_globs ?? []) {
        const files_to_copy:AbsoluteAndRelativePaths[]|Error = 
            collect_files(pattern, paths.srcdirs)
        if(files_to_copy instanceof Error)
            throw files_to_copy as Error;
        if(files_to_copy.length == 0)
            throw new Error(`No files found for glob pattern "${pattern}"`)
        
        for(const {relpath, abspath} of files_to_copy){
            const destination:string = path.join(paths.static, relpath)
            fs.ensureFileSync(destination)
            fs.copySync(abspath, destination, {overwrite:true})
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


export async function compile_and_copy(
    paths: CompilationPaths,
): Promise<true|Error> {
    clear_folder(paths.static);
    //copy assets/thirdparty files even from downstream //TODO: need some kind of flag
    copy_files_to_static({
        srcdirs:    paths.srcdirs,
        copy_globs: BASE_PATHS.copy_globs, //!
        static:     paths.static,
    })

    const status:true|Error = await compile_everything(paths, false)
    return status;
}


function parse_args(): Record<string, string> & {copy_globs:string[]} {
    const args:Record<string, string>  = cli.parseArgs(
        Deno.args, 
        {default: {
            ...BASE_PATHS, 
            copy_globs:undefined, 
            srcdirs:   BASE_PATHS.srcdirs.join(','),
        } }
    )
    const copy_globs:string[] = args.copy_globs?.split(',') ?? [];
    const srcdirs:string[] = args.srcdirs?.split(',') ?? []
    
    return Object.assign(args, {srcdirs, copy_globs})
}

if(import.meta.main){
    const args: Record<string,string> = parse_args()

    const paths:CompilationPaths = resolve_paths({...BASE_PATHS, ...args})
    const status: true|Error = await compile_and_copy(paths)
    if(status instanceof Error){
        console.log(status.message+'\n')
        Deno.exit(1)
    }
}
