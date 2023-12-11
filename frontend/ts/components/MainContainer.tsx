import { preact, JSX }      from "../dep.ts"
import { AppState }         from "./state.ts"
import { page_wide_css }    from "./styles.ts";
import { ProcessingModuleWithSettings } from "../logic/files.ts"
import * as state           from "./state.ts"
import * as util            from "../util.ts"
import * as files from "../logic/files.ts"

type TabsProps = {
    tab_names:  string[]
}

/** Tab labels/buttons that select which content to show */
export class TabButtons extends preact.Component<TabsProps> {
    render(props:TabsProps): JSX.Element {
        return <div class="ui pointing secondary tabs menu">
        {
            props.tab_names.map((name:string, i:number) => {
                return <a class={(i==0)?"active item":"item"} data-tab={name}> 
                    {name} 
                </a>
            })
        }
        </div>
    }

    componentDidMount(): void {
        $('.tabs.menu .item').tab()   //TODO: use ref/unique id
    }
}


/** Utiliy type for {@link ProcessingModuleWithSettings} from {@link AppState} */
type ProcessingBackend<AS extends AppState> = ProcessingModuleWithSettings<
    state.InputTypeOfAppState<AS>,
    state.ResultTypeOfAppState<AS>,
    state.SettingsOfAppState<AS>
>

export type ProcessingBackendConstructor<AS extends AppState> = util.Constructor<
    ProcessingBackend<AS>,
    ConstructorParameters<
        typeof ProcessingModuleWithSettings<
            files.Input, files.Result, state.SettingsOfAppState<AS>
        >
    >
>


type TabProps<AS extends AppState> = {
    /** Global application state */
    appstate:   AS;

    /** Name of the tab, used to associate it with the tab button */
    name:       string;

    /** Backend that processes inputs, (e.g. HTTP, ONNX, FFI) */
    backend:    ProcessingBackendConstructor<AS>;
}

export abstract class TabContent<AS extends AppState>
extends preact.Component<TabProps<AS>>{}

export type Tabs<AS extends AppState> = Record<string, typeof TabContent<AS>>

type MainContainerProps<AS extends AppState> = {
    appstate: AS;
    tabs:     Tabs<AS>
    backend:  ProcessingBackendConstructor<AS>
}

/** Container below the top menu, organizes different tabs */
export class MainContainer<AS extends AppState> 
extends preact.Component<MainContainerProps<AS>> {
    render(): JSX.Element {

        const tab_names:string[] = Object.keys(this.props.tabs)
        const tab_contents: JSX.Element[] = []
        for(const [tabname, TabClass] of Object.entries(this.props.tabs)){
            tab_contents.push(
                <TabClass 
                    name     = {tabname} 
                    appstate = {this.props.appstate}
                    backend  = {this.props.backend}
                />
            )
        }

        return (
        <div 
            class = "ui container page-wide" 
            id    = "main-container" 
            style = {{...page_wide_css, ...{paddingBottom: '50vh'}}}
        >
            <div class="ui hidden section divider whitespace"></div>
            <TabButtons tab_names={tab_names}/>

            { tab_contents }
        </div>
        )
    }
}



export class TrainingTab<AS extends AppState> extends TabContent<AS> {
    render(props:TabProps<AS>): JSX.Element{
        return <div class="ui bottom attached tab" data-tab={props.name}>
            Training Not Implemented.
        </div>
    }
}
