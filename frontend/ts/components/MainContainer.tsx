import { preact, JSX }      from "../dep.ts"
import { AppState }         from "./state.ts"
import { page_wide_css }    from "./styles.ts";

type TabsProps = {
    tab_names:  string[]
}

/** Tab labels/buttons that select which content to show */
export class Tabs extends preact.Component<TabsProps> {
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


type TabProps<AS extends AppState> = {
    /** Global application state */
    appstate:   AS;

    /** Name of the tab, used to associate it with the tab button */
    name:       string;
}

export abstract class TabContent<AS extends AppState>
extends preact.Component<TabProps<AS>>{}


type MainContainerProps<AS extends AppState> = {
    appstate: AS;
    tabs:     Record<string, typeof TabContent<AS>>
}

/** Container below the top menu, organizes different tabs */
export class MainContainer<AS extends AppState> 
extends preact.Component<MainContainerProps<AS>> {
    render(): JSX.Element {

        const tab_names:string[] = Object.keys(this.props.tabs)
        const tab_contents: JSX.Element[] = Object.entries(this.props.tabs).map(
                 ([tabname, TabClass]:[string, typeof TabContent<AS>]) => 
                     <TabClass name={tabname} appstate={this.props.appstate}/>
        )

        return (
        <div 
            class = "ui container page-wide" 
            id    = "main-container" 
            style = {{...page_wide_css, ...{paddingBottom: '50vh'}}}
        >
            <div class="ui hidden section divider whitespace"></div>
            <Tabs tab_names={tab_names}/>

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
