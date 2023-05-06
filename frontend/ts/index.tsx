import { preact, JSX }      from "./dep.ts"
import { TopMenu }          from "./components/TopMenu.tsx"
import { MainContainer }    from "./components/MainContainer.tsx"
import { SVGFilters }       from "./components/SVGFilters.tsx";

import * as file_input      from "./file_input.ts"
import * as settings        from "./logic/settings.ts";

import * as state           from "./state.ts";
import { Constructor, wait } from "./util.ts";


/** Factory function creating the main component and app state.
 * @param id - HTML id for the body element
 * @param AppState - Class containing all required app variables 
 * @param load_settings - Function that loads and verifies settings
 * @param MainContainer - JSX component containing the main content
 * @param TopMenu       - JSX component on top of the main content */
export function create_App<
MAINCONTAINER   extends MainContainer,
TOPMENU         extends TopMenu,
APPSTATE        extends state.AppState,
SETTINGS        extends NonNullable<APPSTATE['settings']['value']>,
>(
    options: {
    id:             string, 
    AppState:       Constructor<APPSTATE>,
    load_settings:  () => Promise<settings.SettingsResponse<SETTINGS>|null>,
    MainContainer:  Constructor<MAINCONTAINER>,
    TopMenu:        Constructor<TOPMENU>,
    }
){
    return class App extends preact.Component {
        appstate: APPSTATE = new options.AppState()

        render(): JSX.Element {
            return (
            <body
                id          =   {options.id}
                onDragOver  =   {file_input.on_drag}
                onDrop      =   {this.on_drop.bind(this)}
            >
                <SVGFilters />  {/* Must go first for cosmetic reasons */}
                <options.TopMenu
                    $settings           = {this.appstate.settings}
                    $available_models   = {this.appstate.available_models}
                    load_settings_fn    = {options.load_settings}
                />
                <options.MainContainer appstate={this.appstate}/>
            </body>
            )
        }

        async componentDidMount(): Promise<void> {
            state.set_global_app_state(this.appstate)
            
            //TODO: refactor out
            const settingsresponse:settings.SettingsResponse<SETTINGS>|null 
                = await options.load_settings()
            if(settingsresponse == null){
                //TODO: show an error message
                return;
            }
            this.appstate.settings.value = settingsresponse.settings
            this.appstate.available_models.value = settingsresponse.available_models;
        }

        /** File drop event handler.
         *  @virtual Can be customized downstream */
        async on_drop(event:preact.JSX.TargetedDragEvent<HTMLElement>): Promise<FileList|undefined> {
            event.preventDefault()
            
            //reset state  //TODO: should not be done here, but when setting the input files
            this.appstate.files.set_from_files([])
            //get file list from event, otherwise its gone after the wait
            const files: FileList | undefined = event.dataTransfer?.files
            //refresh ui
            await wait(1)

            this.appstate.files.set_from_pairs( 
                await file_input.load_list_of_files(files ?? [])
            )
            return files;
        }
    }
}

/** Main component for the base project */
class App extends create_App({
    id:             'base', 
    AppState:       state.AppState, 
    load_settings:  settings.load_settings, 
    MainContainer:  MainContainer, 
    TopMenu:        TopMenu
}){}




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
        <App />
    </html>
}

export function hydrate_body(body_jsx:JSX.Element, id:string): void {
    const body: Element|null = document.querySelector(`body#${id}`)
    if(body && body.parentElement) {
        preact.hydrate(body_jsx, body.parentElement)
    }
}

if(!globalThis.Deno){
    hydrate_body(<App />, 'base')
}
