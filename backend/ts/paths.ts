import { path } from "./dep.ts"

export function root():string {
    const file_url:string = import.meta.resolve('../../')
    return path.fromFileUrl(file_url)
}

export function static_folder():string {
    return path.join(root(), 'static')
}

export function frontend():string {
    return path.join(root(), 'frontend', 'ts')
}

export function index_tsx():string {
    return path.join(frontend(), 'index.tsx')
}
