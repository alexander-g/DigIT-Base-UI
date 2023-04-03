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


export class MainContainerProps {
    /** Tab names and their contents */
    tab_contents: Record<string, JSX.Element> = {
        'Detection' :   <DetectionTab />,
        'Training'  :   <div>Not Implemented</div>,
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
            this.detection_tab_content(this.tab_names[0]!), 
            this.training_tab_content(this.tab_names[1]!)
        ]
    }

    detection_tab_content(name:string): JSX.Element {
        return <div class="ui active tab segment unselectable" data-tab={name} style="padding:0">
            <DetectionTab />
        </div>
    }

    training_tab_content(name:string): JSX.Element {
        return <div class="ui bottom attached tab" data-tab={name}>
            Training Not Implemented.
        </div>
    }
}
