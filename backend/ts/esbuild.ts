#!./deno.sh run --no-prompt --allow-read --allow-write=./static --allow-env --cached-only

import { esbuild, cache, path }     from "./dep.ts";
import * as paths                   from "./paths.ts"



/** An esbuild plugin that resolves cached modules from deno cache and normal files */
const CustomResolvePlugin: esbuild.Plugin = {
    name: 'customresolve',
    setup(build: esbuild.PluginBuild) {
        const https_rx = /^https:\/\//
        const https_ns = 'remote'

        /** Mark remote https files as non-remote, for bundling */
        build.onResolve({ filter: https_rx }, (args: esbuild.OnResolveArgs) => {
            //console.log('onResolve:', args)
            return {
                path:       args.path,
                external:   false, 
                namespace:  https_ns
            }
        })

        /** Resolve local to absolute paths */
        build.onResolve({ filter: /^\./ }, (args:esbuild.OnResolveArgs) => {
            const abspath:string = path.join( path.dirname(args.importer), args.path )
            console.log(args, abspath)
            return { 
                path:       abspath, 
                external:   false,
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
            //console.log('onLoad:', args)
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

            return { contents: content, loader: 'ts'}
        })
    },
}

async function load_module_from_deno_cache(path:string): Promise<string | null> {
    const loader: cache.Loader = cache.createCache({
        allowRemote:    true,
        readOnly:       true,
        cacheSetting:   'only',
    })

    const loadresponse = await loader.load(path)
    if(loadresponse?.kind == 'module') {
        return loadresponse.content
    }
    return null;
}


export async function compile_esbuild(rootfile: string, output:string): Promise<string> {
    const esbuild_wasm_module
        = new WebAssembly.Module(Deno.readFileSync("./assets/esbuild.wasm"))
    await esbuild.initialize({ wasmModule: esbuild_wasm_module, worker: false })

    const sourcecode: string = Deno.readTextFileSync(rootfile)

    const result: esbuild.BuildResult = await esbuild.build({
        stdin: {
            contents:       sourcecode,
            resolveDir:     path.dirname(rootfile),
            sourcefile:     path.basename(rootfile),
            loader:         'tsx',
        },
        jsx:            'transform',
        jsxFactory:     'h',
        jsxFragment:    'Fragment',
        format:         'esm',
        write:          false,
        bundle:         true,
        minify:         false,
        sourcemap:      true,
        plugins:        [CustomResolvePlugin],
    })

    const decoder = new TextDecoder("utf-8");
    const result_str: string = decoder.decode(result.outputFiles?.[0]?.contents)
    Deno.writeTextFileSync(output, result_str)
    return result_str;
}



if (import.meta.main) {
    const rootfile: string = path.join(paths.frontend(),      'dep.ts')
    const output:   string = path.join(paths.static_folder(), 'dep.ts')
    compile_esbuild(rootfile, output)
}
