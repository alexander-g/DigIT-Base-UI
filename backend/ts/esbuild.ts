#!./deno.sh run --no-prompt --allow-read --allow-write=./static --allow-env --cached-only

import { esbuild, cache, path, fs } from "./dep.ts";
import * as paths                   from "./paths.ts"



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
            if(Object.keys(remap).includes(abspath)){
                return {
                    path:       remap[abspath],
                    external:   true,
                }
            }
            else {
                return { 
                    path:       abspath, 
                    external:   false,
                }
            }
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
                content = Deno.readTextFileSync(args.path)
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


export async function compile_esbuild(
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
    })

    const decoder = new TextDecoder("utf-8");
    const result_str: string = decoder.decode(result.outputFiles?.[0]?.contents)

    //ensure sub-directories exist
    fs.ensureFileSync(outputfile)
    Deno.writeTextFileSync(outputfile, result_str)
    return result_str;
}

/** Download `esbuild.wasm` */
async function fetch_esbuild_wasm(destination:string): Promise<void> {
    const url = new URL(`https://cdn.jsdelivr.net/npm/esbuild-wasm@${esbuild.version}/esbuild.wasm`)
    Deno.permissions.requestSync({name:'net', host:url.host})

    const response:Response = await fetch(url)
    if(response.ok) {
        const dirname:string = path.dirname(destination)
        Deno.permissions.requestSync({name:'write', path:dirname})
        fs.ensureDirSync(dirname)
        const f:Deno.FsFile = Deno.openSync(destination, {write:true, create:true})
        await response?.body?.pipeTo(f.writable)
    }
}

/** Check that `esbuild.wasm` exists, download if necessary and initialize it */
export async function initialize_esbuild(root?:string): Promise<void> {
    const path_to_wasm:string = path.join(root ?? '', "./assets/esbuild.wasm")
    if(!fs.existsSync(path_to_wasm)) {
        await fetch_esbuild_wasm(path_to_wasm)
    }
    const esbuild_wasm_module
        = new WebAssembly.Module(Deno.readFileSync(path_to_wasm))
    await esbuild.initialize({ wasmModule: esbuild_wasm_module, worker: false })
}


if (import.meta.main) {
    await initialize_esbuild()
    const rootfile: string = path.join(paths.frontend(),      'dep.ts')
    const output:   string = path.join(paths.static_folder(), 'dep.ts')
    compile_esbuild(rootfile, output)
}
