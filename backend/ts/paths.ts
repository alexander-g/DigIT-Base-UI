import { path } from "./dep.ts"

/** Path to the project root */
export function root():string {
    const file_url:string = import.meta.resolve('../../')
    return path.fromFileUrl(file_url)
}

/** Path to folder with files to be served via http are located */
export function static_folder(rootpath?:string):string {
    return path.join(rootpath ?? root(), 'static')
}

/** Path to folder with Javascipt/Typescript UI files */
export function frontend():string {
    return path.join(root(), 'frontend')
}

/** Path to the UI entry point file */
export function index_tsx():string {
    return path.join(frontend(), 'ts', 'index.tsx')
}
