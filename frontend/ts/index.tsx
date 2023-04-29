import { preact, JSX }      from "./dep.ts"
import { TopMenu }          from "./components/TopMenu.tsx"
import { MainContainer }    from "./components/MainContainer.tsx"
import { SVGFilters }       from "./components/SVGFilters.tsx";

import * as file_input      from "./file_input.ts"
import { load_settings }    from "./logic/settings.ts";

import * as state           from "./state.ts";
import { Constructor }      from "./util.ts";


export class Body extends preact.Component {
    /** The `id` attribute of `<body>`. Should be overwritten downstream. */
    // deno-lint-ignore no-inferrable-types
    id:string = 'base';

    /** Global application state 
     *  @virtual */
    appstate: state.AppState = new state.AppState();

    /** @virtual */
    MainContainer: Constructor<MainContainer> = MainContainer

    /** @virtual */
    TopMenu: Constructor<TopMenu> = TopMenu

    render(): JSX.Element {
        return (
        <body 
            id          =   {this.id}
            onDragOver  =   {file_input.on_drag}
            onDrop      =   {file_input.on_drop}
        >
            <SVGFilters />  {/* Must go first for cosmetic reasons */}
            { this.top_menu() }
            { this.main_container() }
        </body>
        )
    }

    componentDidMount(): void {
        state.set_global_app_state(this.appstate)
    }

    /** @virtual */
    main_container(): JSX.Element {
        return <this.MainContainer appstate={this.appstate}/>
    }

    /** @virtual */
    top_menu(): JSX.Element {
        return <this.TopMenu
            $settings           = {this.appstate.settings}
            $available_models   = {this.appstate.available_models}
        />
    }
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

        .ui.table td.active, .ui.table tr.active { 
            background: #fff!important;
        }
        `}
    </style>
}


type HeadProps = {
    title:      string;
    import_src: string;
}

/** The `<head>` part of the HTML document. */
export function Head(props:HeadProps): JSX.Element {
    return <head>
        <title>{ props.title }</title>
        <link rel="stylesheet" href="thirdparty/semantic.min.css" />
        <script src="thirdparty/jquery-3.4.1.min.js"></script>
        <script src="thirdparty/semantic.min.js"></script>
        <script type="module" src={props.import_src}></script>
        <link rel="stylesheet" href="css/box_styles.css" />
        <ExtraStyles />
    </head>
}

/** Main JSX entry point */
export function Index(): JSX.Element {
    return <html>
        <Head title={"Base UI"} import_src={"ts/index.tsx"} />
        <Body />
    </html>
}

export function hydrate_body(body_jsx:JSX.Element, id:string): void {
    const body: Element|null = document.querySelector(`body#${id}`)
    if(body && body.parentElement) {
        preact.hydrate(body_jsx, body.parentElement)
    }
}

if(!globalThis.Deno){
    hydrate_body(<Body />, 'base')
    //body onload callback doesnt work for some reason
    await load_settings()
}
