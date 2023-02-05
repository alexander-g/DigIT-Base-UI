import { preact, signals } from "./dep.ts"
import { TopMenu } from "./components/TopMenu.tsx"
import { Modals }  from "./components/Modals.tsx"


export function Body(): preact.JSX.Element {
    return <>
        <TopMenu />
        <Modals />
    </>
}

export const body: preact.JSX.Element = <Body />



export function Index(): preact.JSX.Element {
    return <html>
        <head>
            <title>Base UI</title>
            <link rel="stylesheet" href="thirdparty/semantic.min.css" />
            <script src="thirdparty/jquery-3.4.1.min.js"></script>
            <script src="thirdparty/semantic.min.js"></script>
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
