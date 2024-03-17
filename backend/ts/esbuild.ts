#!./deno.sh run --no-prompt --allow-read --allow-write=./static --allow-env --cached-only

import { esbuild, cache, path, fs } from "./dep.ts";
import { fetch_no_throw }           from "../../frontend/ts/util.ts";


/** An esbuild plugin that resolves cached modules from deno cache and normal files */
function CustomResolvePlugin(remap:Record<string, string> = {}): esbuild.Plugin { 
    return {
    name : 'customresolve',
    setup(build: esbuild.PluginBuild) {
        const https_rx = /^https:\/\//
        const https_ns = 'remote'

        /** Mark remote https files as non-remote, for bundling */
        build.onResolve({ filter: https_rx }, (args: esbuild.OnResolveArgs) => {
            return {
                path:       args.path,
                external:   false, 
                namespace:  https_ns
            }
        })

        /** Resolve local to absolute paths */
        build.onResolve({ filter: /^\./ }, (args:esbuild.OnResolveArgs) => {
            const abspath:string = path.join( path.dirname(args.importer), args.path )
            let result:esbuild.OnResolveResult = {}
            if(Object.keys(remap).includes(abspath)){
                result = {
                    path:       remap[abspath],
                    external:   true,
                }
            }
            else {
                result = { 
                    path:       abspath, 
                    external:   false,
                }
            }
            //for some reason the paths in windows are messed up
            //and start with something like \Y:
            //esbuild on the other hand complains if the path does not start with /
            //workaround:
            result.path = result.path!.replace(/\\([A-Z]):/g, '/$1:')
            return result
        })

        /** Resolve absolute paths to https:// */
        build.onResolve({ filter: /^\// }, (args:esbuild.OnResolveArgs) => {
            const resolved_url = new URL(args.path, args.importer)
            return {
                path:       resolved_url.href, 
                external:   false,
                namespace:  https_ns,
            }
        })

        /** Read files or modules from cache */
        build.onLoad({ filter: /.?/g }, async (args:esbuild.OnLoadArgs) => {
            let content:string;
            if(args.namespace == https_ns) {
                const maybe_content: string | null 
                    = await load_module_from_deno_cache(args.path)
                if(!maybe_content)
                    throw new Error('Could not load from cache: '+args.path)
                
                content = maybe_content!;
            } else {
                //on windows, args.path starts with something like /Y: (see above)
                //remove the leading slash
                const fixed_path:string = args.path.replace(/\/([A-Z]):/g, '$1:')
                content = Deno.readTextFileSync(fixed_path)
            }

            return { contents: content, loader: args.path.endsWith('.tsx')? 'tsx' : 'ts'}
        })
    }
    }
}


type MonkeyPermissions = {
    permissions: Deno.Permissions,
    env:         Deno.Env,
}

/** Replace `Deno.permissions` and `Deno.env` with mocks
 *  because `deno_cache` doesnt know how to use them properly */
function monkeypatch_permissions(replace_with?: MonkeyPermissions): MonkeyPermissions {
    const DENO_DIR: string|undefined = Deno.env.get('DENO_DIR')
    const previous: MonkeyPermissions = {
        permissions: Deno.permissions,
        env:         Deno.env,
    }
    
    //mock
    replace_with = replace_with ?? ({
        permissions: {
            request: () => {}
        },
        env:         new Map(
            Object.entries({
                DENO_AUTH_TOKENS: undefined,
                DENO_DIR:         DENO_DIR,
            })
        )
    } as unknown as MonkeyPermissions);

    Object.assign(Deno, replace_with);
    return previous;
}

async function load_module_from_deno_cache(path:string): Promise<string | null> {
    const previous: MonkeyPermissions = monkeypatch_permissions()
    const loader: cache.Loader = cache.createCache({
        allowRemote:    true,
        readOnly:       true,
        cacheSetting:   'only',
    })
    monkeypatch_permissions(previous);

    const loadresponse = await loader.load(path)
    if(loadresponse?.kind == 'module') {
        return loadresponse.content
    }
    return null;
}


async function compile_esbuild(
    rootfile:   string, 
    outputfile: string, 
    remap?:     Record<string, string>
): Promise<string> {
    rootfile = path.resolve(rootfile)
    const sourcecode: string = Deno.readTextFileSync(rootfile)

    const result: esbuild.BuildResult = await esbuild.build({
        stdin: {
            contents:       sourcecode,
            resolveDir:     path.dirname(rootfile),
            sourcefile:     path.basename(rootfile),
            loader:         'tsx',
        },
        jsx:            'transform',
        jsxFactory:     'preact.h',
        jsxFragment:    'preact.Fragment',
        format:         'esm',
        write:          false,
        bundle:         true,
        minify:         false,
        sourcemap:      true,
        plugins:        [CustomResolvePlugin(remap)],
        logOverride:{
            'direct-eval':'debug'
        }
    })

    const decoder = new TextDecoder("utf-8");
    const result_str: string = decoder.decode(result.outputFiles?.[0]?.contents)

    //ensure sub-directories exist
    fs.ensureFileSync(outputfile)
    Deno.writeTextFileSync(outputfile, result_str)
    return result_str;
}


const ESBUILD_URL = new URL(
    `https://cdn.jsdelivr.net/npm/esbuild-wasm@${esbuild.version}/esbuild.wasm`
)

function path_to_esbuild_wasm(root:string): string {
    return path.join(root, "assets/esbuild.wasm")      //TOO hardcoded
}

/** Check that `esbuild.wasm` exists, download if necessary */
async function ensure_esbuild_wasm(root:string): Promise<string|Error> {
    const path_to_wasm:string = path_to_esbuild_wasm(root)
    if(!fs.existsSync(path_to_wasm)) {
        const response:Response|Error = await fetch_no_throw(ESBUILD_URL)
        if(response instanceof Error)
            return response;
        
        const dirname:string = path.dirname(path_to_wasm)
        fs.ensureDirSync(dirname)
        const f:Deno.FsFile = Deno.openSync(path_to_wasm, {write:true, create:true})
        await response?.body?.pipeTo(f.writable)
    }
    return path_to_wasm;
}


function remove_file_url(x:string): string {
    if(x.startsWith('file://')) {
        return path.fromFileUrl(x)
    }
    else return x;
}

/** Make sure all required permissions are set, return instructions if not */
function check_permissions(root:string, output_folder:string): true|Error {
    if(!path.isAbsolute(root)){
        return new Error(`Root path must be absolute. Got:${root}`)
    }

    const path_to_wasm:string = path.dirname(path_to_esbuild_wasm(root))
    if(
        Deno.permissions.querySync({name:"env", variable:'DENO_DIR'}).state != "granted"
     || Deno.permissions.querySync({name:"read", path:root}).state != "granted"
     || Deno.permissions.querySync({name:"write", path:output_folder}).state !=  "granted"
     || Deno.permissions.querySync({name:"write", path:path_to_wasm}).state !=  "granted"
     || Deno.permissions.querySync({name:'net', host:ESBUILD_URL.host}).state != "granted"
    )
        return new Error(`Required permissions (relative to ${root}):\n`
            +`--allow-env=DENO_DIR \n`
            +`--allow-read=./${path.relative(root, root)}\n`
            +`--allow-write=./${path.relative(root, output_folder)},./${path.relative(root, path_to_wasm)}\n`
            +`--allow-net=${ESBUILD_URL.host}`
        )
    //else
    return true;
}

export class ESBuild {
    /** Check prerequisites and initialize esbuild if all ok */
    static async initialize(root:string, output_folder:string): Promise<ESBuild|Error> {
        root = remove_file_url(root)
        const status: true|Error = check_permissions(root, output_folder)
        if(status instanceof Error)
            return status;
        
        const path_to_wasm:string|Error = await ensure_esbuild_wasm(root)
        if(path_to_wasm instanceof Error)
            return path_to_wasm;
        
        const esbuild_wasm_module
            = new WebAssembly.Module(Deno.readFileSync(path_to_wasm))
        await esbuild.initialize({ wasmModule: esbuild_wasm_module, worker: false })

        return new ESBuild;
    }

    async compile_esbuild(...args:Parameters<typeof compile_esbuild>): Promise<string> {
        return await compile_esbuild(...args)
    }
}

