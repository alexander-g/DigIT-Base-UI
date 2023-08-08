import { preact, JSX }      from "../dep.ts"
import { AppState }         from "./state.ts";
import { DetectionTab }     from "./DetectionTab.tsx";
import { ObjectDetectionTab } from "./DetectionTab.tsx";
import { page_wide_css }    from "./styles.ts";
import * as objdet          from "../logic/objectdetection.ts";

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
    appstate:   AS;
    name:       string;
}

export abstract class TabContent<AS extends AppState> extends preact.Component<TabProps<AS>>{}


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

    /** @virtual */
    tab_contents(): JSX.Element[] {
        return [
            <DetectionTab name={this.tab_names[0]!} appstate={this.props.appstate}/>, 
            <TrainingTab  name={this.tab_names[1]!} appstate={this.props.appstate}/>,
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


//TODO: this is messy

export class MainContainerForObjectDetection
extends MainContainer<AppState<objdet.Input, objdet.ObjectdetectionResult>> {
    tab_contents(): preact.JSX.Element[] {
        return [
            <ObjectDetectionTab name={this.tab_names[0]!} appstate={this.props.appstate}/>, 
            <TrainingTab  name={this.tab_names[1]!} appstate={this.props.appstate}/>,
        ]
    }
}

export class DetectionOnlyContainerForObjectDetection
extends MainContainer<AppState<objdet.Input, objdet.ObjectdetectionResult>> {
    /** @override */
    tab_names: string[] = ['Detection'];
    
    tab_contents(): preact.JSX.Element[] {
        return [
            <ObjectDetectionTab name={this.tab_names[0]!} appstate={this.props.appstate}/>, 
        ]
    }
}


export class TrainingTab<AS extends AppState> extends TabContent<AS> {
    render(props:TabProps<AS>): JSX.Element{
        return <div class="ui bottom attached tab" data-tab={props.name}>
            Training Not Implemented.
        </div>
    }
}
