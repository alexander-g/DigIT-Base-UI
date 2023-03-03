#!./deno.sh run --allow-read=./frontend/ts,./static --allow-write=./static --no-prompt

import { preact_ssr, sucrase }          from "./dep.ts";
import { path, fs }                     from "./dep.ts"

import * as paths                       from "./paths.ts"


export async function compile_default(destination?:string): Promise<void> {
    //TODO: (need to coordinate with flask) clear_static(destination)
    
    const frontend_path:string  = paths.frontend()
    const glob_pattern:string   = path.join(frontend_path, '**/*.ts{x,}')
    for(const entry of fs.expandGlobSync(glob_pattern, {root:'/'})){
      write_to_static(entry.path, transpile(entry.path), destination)
    }
    
    await compile_index(destination)
}

export async function compile_index(destination?:string): Promise<void> {
    const path: string     = paths.index_tsx()
    // deno-lint-ignore no-explicit-any
    const index_tsx:any    = await import(path)
    // deno-lint-ignore no-explicit-any
    const main_element:any = index_tsx.Index()
    const result: string   = preact_ssr.render(main_element, {}, {pretty:true})
    write_to_static(path.replace('.tsx', '.html'), result, destination)
}

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

function write_to_static(sourcepath:string, content:string, destination?:string): void {
    destination = destination ?? paths.static_folder()
    destination = path.join(destination, path.relative(paths.frontend(), sourcepath) )
    //ensure sub-directories exist
    fs.ensureFileSync(destination)
    Deno.writeTextFileSync(destination, content)
}

function clear_static(destination?:string): void {
    destination = destination ?? paths.static_folder()
    Deno.removeSync(destination, {recursive:true})
    fs.ensureDirSync(destination)
}




if(import.meta.main){
  compile_default()
}
