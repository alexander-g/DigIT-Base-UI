import { preact, JSX }      from "./dep.ts"
import { TopMenu }          from "./components/TopMenu.tsx"
import { SVGFilters }       from "./components/SVGFilters.tsx";

import * as files           from "./logic/files.ts";
import * as file_input      from "./components/file_input.ts"
import * as settings        from "./logic/settings.ts";
import { ORT_Processing }   from "./logic/ort_processing.ts"
import { RemoteProcessing } from "./logic/backends/remote.ts"

import * as state           from "./components/state.ts";
import * as util            from "./util.ts";
import { show_error_toast } from "./components/errors.ts";

import {
    MainContainer,
    TrainingTab, 
    Tabs,
    ProcessingBackendConstructor,
} from "./components/MainContainer.tsx"
import * as detectiontab   from "./components/DetectionTab.tsx"
import * as objdet         from "./logic/objectdetection.ts";
import * as segm           from "./logic/segmentation.ts";
import * as instseg        from "./logic/instancesegmentation.ts";



/** Factory function creating the main component and app state.
 * @param id            - HTML id for the body element
 * @param AppState      - Class containing all required app variables 
 * @param InputClass    - Class representing an input, should have a validate() function
 * @param ResultClass   - Class representing a result, should have a validate() function
 * @param load_settings - Function that loads and verifies settings
 * @param TopMenu       - JSX component on top of the main content 
 * @param tabs          - Dict mapping tab name to tab JSX component */
export function create_App<
//INPUT           extends files.Input,
//INPUTCLASS      extends files.InputClassInterface<INPUT>,
//RESULT          extends files.Result,
//RESULTCLASS     extends files.ResultClassInterface<RESULT>,
SETTINGS        extends settings.Settings,
// NOTE: using RESULT instead of InstanceType<RESULTCLASS> is not type-safe for some reason
APPSTATE        extends state.AppState<
    //InstanceType<INPUTCLASS>, 
    //InstanceType<RESULTCLASS>, 
    SETTINGS
>,
TOPMENU         extends TopMenu,
>(
    options: {
    id:              string, 
    AppState:        util.Constructor<APPSTATE>,
    //InputClass:      INPUTCLASS,
    //ResultClass:     RESULTCLASS,
    settingshandler: settings.SettingsHandler<SETTINGS>,
    backend:         ProcessingBackendConstructor<APPSTATE>,
    TopMenu:         util.Constructor<TOPMENU>,
    tabs:            Tabs<APPSTATE>,
    },
){
    return class App extends preact.Component {
        appstate: APPSTATE = new options.AppState()
        backend:  ProcessingBackendConstructor<APPSTATE> = options.backend;

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
                    settingshandler     = {options.settingshandler}
                    on_inputfiles       = {this.on_new_files.bind(this)}
                    on_inputfolder      = {this.on_new_files.bind(this)}
                    on_annotationfiles  = {this.on_new_files.bind(this)}
                    input_filetypes     = {this.appstate.InputClass.filetypes}
                />
                <MainContainer<APPSTATE>
                    appstate = {this.appstate} 
                    tabs     = {options.tabs}
                    backend  = {options.backend}
                />
            </body>
            )
        }

        override async componentDidMount(): Promise<void> {
            state.set_global_app_state(this.appstate)
            
            //TODO: refactor out
            const settingsresponse:settings.SettingsResponse<SETTINGS>|Error 
                = await options.settingshandler.load()
            if(settingsresponse instanceof Error){
                show_error_toast('Could not load settings', settingsresponse)
                return;
            }
            this.appstate.$settings.value = settingsresponse.settings
            this.appstate.$available_models.value = settingsresponse.available_models;
        }

        /** File drop event handler. */
        async on_drop(event:JSX.TargetedDragEvent<HTMLElement>): Promise<void> {
            event.preventDefault()
            const files: FileList | File[] = event.dataTransfer?.files ?? []
            
            return await this.on_new_files(files)
        }

        /** New files callback */
        async on_new_files(files: FileList|File[]): Promise<void> {
            return await this.appstate.set_files(files);
        }
    }
}


/** Main component for the base project */
class App extends create_App({
    id:              'base', 
    AppState:        state.AppState, 
    //AppState:        detectiontab.ObjectdetectionAppState, 
    //AppState:        detectiontab.SegmentationAppState, 
    //AppState:        detectiontab.InstanceSegmentationAppState, 

    //InputClass:      files.InputFile,

    //ResultClass:     files.Result,
    //ResultClass:     objdet.ObjectdetectionResult,
    //ResultClass:     segm.SegmentationResult,
    //ResultClass:     instseg.InstanceSegmentationResult,

    settingshandler: new settings.BaseSettingsHandler(), 
    //settingshandler: new settings.StaticPageBaseSettingsHandler(), 
    
    //backend:         ORT_Processing,
    backend:         RemoteProcessing,

    TopMenu:         TopMenu,
    tabs: {
        //'Detection': detectiontab.DetectionTab,
        //'Detection': detectiontab.ObjectDetectionTab,
        //'Detection': detectiontab.SegmentationTab,
        'Detection': detectiontab.InstanceSegmentationTab,
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
        <Head title={"Base UI"} import_src={"ts/index.tsx.js"} />
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
