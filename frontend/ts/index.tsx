import { preact, signals } from "./dep.ts"
import { TopMenu } from "./components/TopMenu.tsx"
import { Modals }  from "./components/Modals.tsx"
import { MainContainer } from "./components/MainContainer.tsx"

import * as file_input from "./file_input.ts"

export function Body(): preact.JSX.Element {
    return <body onDragOver={file_input.on_drag} onDrop={file_input.on_drop}>
        <TopMenu/>
        <MainContainer />
        <Modals />
    </body>
}


export function Index(): preact.JSX.Element {
    return <html>
        <head>
            <title>Base UI</title>
            <link rel="stylesheet" href="thirdparty/semantic.min.css" />
            <script src="thirdparty/jquery-3.4.1.min.js"></script>
            <script src="thirdparty/semantic.min.js"></script>
            <script type="module" src="/ts/index.tsx"></script>
        </head>
        <Body />
    </html>
}

if(!globalThis.Deno){
    preact.hydrate(<Body />, document.body.parentElement!)
}
