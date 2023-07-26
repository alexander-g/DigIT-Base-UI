import { preact, JSX }      from "../dep.ts"
import { AppState }         from "./state.ts";
import { DetectionTab }     from "./DetectionTab.tsx";
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


export class MainContainer<APPSTATE extends AppState = AppState> 
extends preact.Component<{appstate:APPSTATE}> {
    /** @virtual */
    tab_names: string[] = ['Detection', 'Training']

    render(): JSX.Element {
        const pad_bottom_css = {paddingBottom: '50vh'}
        return (
        <div 
            class   =   "ui container page-wide" 
            id      =   "main-container" 
            style   =   {{...page_wide_css, ...pad_bottom_css}}
        >
            <div class="ui hidden section divider whitespace"></div>
            <Tabs tab_names={this.tab_names}/>

            { this.tab_contents() }

        </div>
        )
    }

    tab_contents(): JSX.Element[] {
        return [
            <DetectionTab name={this.tab_names[0]!} appstate={this.props.appstate}/>, 
            <TrainingTab  name={this.tab_names[1]!}/>,
        ]
    }
}

/** Main container with only a detection tab, no training */
export class DetectionOnlyContainer extends MainContainer {
    /** @override */
    tab_names: string[] = ['Detection'];

    /** @override */
    tab_contents(): JSX.Element[] {
        return [
            <DetectionTab name={this.tab_names[0]!} appstate={this.props.appstate}/>
        ]
    }
}


export function TrainingTab(props:{name:string}): JSX.Element {
    return <div class="ui bottom attached tab" data-tab={props.name}>
        Training Not Implemented.
    </div>
}
