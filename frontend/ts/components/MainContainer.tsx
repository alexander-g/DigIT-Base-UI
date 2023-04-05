import { preact, JSX }      from "../dep.ts"
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


export class MainContainer extends preact.Component {
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
            <DetectionTab name={this.tab_names[0]!}/>, 
            <TrainingTab  name={this.tab_names[1]!}/>,
        ]
    }
}


export function TrainingTab(props:{name:string}): JSX.Element {
    return <div class="ui bottom attached tab" data-tab={props.name}>
        Training Not Implemented.
    </div>
}
