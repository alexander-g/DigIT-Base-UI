import { preact, JSX }      from "./dep.ts"
import { TopMenu }          from "./components/TopMenu.tsx"
import { MainContainer }    from "./components/MainContainer.tsx"
import { SVGFilters }       from "./components/SVGFilters.tsx";

import { Input, Result }    from "./logic/files.ts";
import { InputFile }        from "./logic/files.ts";
import { InputClassInterface } from "./logic/files.ts";
import * as file_input      from "./components/file_input.ts"
import * as settings        from "./logic/settings.ts";

import * as state           from "./components/state.ts";
import * as util            from "./util.ts";


import { TrainingTab, TabContent }     from "./components/MainContainer.tsx"
import { DetectionTab }    from "./components/DetectionTab.tsx"



/** Factory function creating the main component and app state.
 * @param id            - HTML id for the body element
 * @param AppState      - Class containing all required app variables 
 * @param InputClass    - Class representing an input, should have a validate() function
 * @param ResultClass   - Class representing a result, should have a validate() function
 * @param load_settings - Function that loads and verifies settings
 * @param TopMenu       - JSX component on top of the main content 
 * @param tabs          - Dict mapping tab name to tab JSX component */
export function create_App<
INPUT           extends Input,
RESULT          extends Result,
SETTINGS        extends settings.Settings,
APPSTATE        extends state.AppState<INPUT, RESULT, SETTINGS>,
TOPMENU         extends TopMenu,
>(
    options: {
    id:             string, 
    AppState:       util.Constructor<APPSTATE>,
    InputClass:     InputClassInterface<INPUT>,
    ResultClass:    util.ClassWithValidate<RESULT>,
    load_settings:  () => Promise<settings.SettingsResponse<SETTINGS>|null>,
    TopMenu:        util.Constructor<TOPMENU>,
    tabs:           Record<string, typeof TabContent<APPSTATE>>,
    },
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
                    $settings           = {this.appstate.$settings}
                    $available_models   = {this.appstate.$available_models}
                    load_settings_fn    = {options.load_settings}
                    on_inputfiles       = {this.set_files.bind(this)}
                    on_inputfolder      = {this.set_files.bind(this)}
                    on_annotationfiles  = {this.set_files.bind(this)}
                    input_filetypes     = {options.InputClass.filetypes}
                />
                <MainContainer<APPSTATE>
                    appstate = {this.appstate} 
                    tabs     = {options.tabs}
                />
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
            this.appstate.$settings.value = settingsresponse.settings
            this.appstate.$available_models.value = settingsresponse.available_models;
        }

        /** File drop event handler. */
        async on_drop(event:JSX.TargetedDragEvent<HTMLElement>): Promise<FileList|File[]> {
            event.preventDefault()
            const files: FileList | File[] = event.dataTransfer?.files ?? []
            
            return await this.set_files(files)
        }

        /** Set the currently loaded files in the appstate */
        async set_files(files: FileList|File[]): Promise<FileList|File[]>{
            //reset state  //TODO: should not be done here, but when setting the input files
            //TODO: send clear cache request to backend
            this.appstate.$files.value = []
            //refresh ui
            await util.wait(1)

            this.appstate.$files.value = state.input_result_signal_pairs_from_simple(
                await file_input.load_list_of_files(
                    files ?? [], options.InputClass, options.ResultClass
                )
            )

            return files;
        }
    }
}


/** Main component for the base project */
class App extends create_App({
    id:             'base', 
    AppState:       state.AppState, 
    InputClass:     InputFile,
    ResultClass:    Result,
    load_settings:  settings.load_settings, 
    TopMenu:        TopMenu,

    tabs: {
             'Detection': DetectionTab,
             'Training':  TrainingTab,
        },
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
