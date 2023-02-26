import { preact, JSX }      from "./dep.ts"
import { TopMenu }          from "./components/TopMenu.tsx"
import { Modals }           from "./components/Modals.tsx"
import { MainContainer }    from "./components/MainContainer.tsx"
import { SVGFilters }       from "./components/SVGFilters.tsx";

import * as file_input from "./file_input.ts"

export function Body(): JSX.Element {
    return <body onDragOver={file_input.on_drag} onDrop={file_input.on_drop}>
        <TopMenu/>
        <MainContainer />
        <Modals />
        <SVGFilters />
    </body>
}

/** CSS that does not seem to work adding via JSX */
function ExtraStyles(): JSX.Element {
    return <style>
        {`
        .transform-box img {
            /* transform-box receives all events, not children images */
            pointer-events: none;
        }
        
        .unselectable {
            user-drag: none; 
            user-select: none;
            -moz-user-select: none;
            -webkit-user-drag: none;
            -webkit-user-select: none;
            -ms-user-select: none;
        }
        `}
    </style>
}


export function Index(): JSX.Element {
    return <html>
        <head>
            <title>Base UI</title>
            <link rel="stylesheet" href="thirdparty/semantic.min.css" />
            <script src="thirdparty/jquery-3.4.1.min.js"></script>
            <script src="thirdparty/semantic.min.js"></script>
            <script type="module" src="/ts/index.tsx"></script>
            <ExtraStyles />
        </head>
        <Body />
    </html>
}

if(!globalThis.Deno){
    preact.hydrate(<Body />, document.body.parentElement!)
}
