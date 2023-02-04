import { preact, signals } from "./dep.ts"


export function Body(): preact.JSX.Element {
    return <>
        
    </>
}

export const body: preact.JSX.Element = <Body />



export function Index(): preact.JSX.Element {
    return <html>
        <head>
            <title>Base UI</title>
            <script type="module" src="/ts/index.tsx"></script>
        </head>
        <body>
            { body }
        </body>
    </html>
}

if(!globalThis.Deno){
    preact.hydrate(body, document.body)
}
