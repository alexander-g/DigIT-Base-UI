export * as path       from "https://deno.land/std@0.176.0/path/mod.ts";
export * as fs         from "https://deno.land/std@0.176.0/fs/mod.ts";
export * as flags      from "https://deno.land/std@0.176.0/flags/mod.ts";

export * as esbuild    from 'https://deno.land/x/esbuild@v0.17.10/wasm.js';
export * as preact_ssr from "https://esm.sh/preact-render-to-string@5.2.6?deps=preact@10.11.3";


//import * as cache from "https://deno.land/x/deno_cache@0.4.1/mod.ts";
//NOTE: loading newer version directly from github to fix a bug, replace when v0.4.2 is out
//export * as cache               from 'https://raw.githubusercontent.com/denoland/deno_cache/bc03f82bbda192228d7090b803fb1dd8e7f1d7ff/mod.ts'


export * as cache from "https://deno.land/x/deno_cache@0.7.1/mod.ts";


export * as file_server from "https://deno.land/std@0.176.0/http/file_server.ts";


//required to prevent net-access on dynamic import()
import "../../frontend/ts/dep.ts"

//required for caching/vendoring
import "https://esm.sh/preact@10.11.3/jsx-runtime"