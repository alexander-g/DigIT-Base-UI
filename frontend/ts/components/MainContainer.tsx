import { preact } from "../dep.ts"
import { DetectionTab } from "./DetectionTab.tsx";
import "../jquery_mock.ts"



export class Tabs extends preact.Component {
    render(): preact.JSX.Element {
        return <div class="ui pointing secondary tabs menu">
            <a class="active item" data-tab="detection">Detection</a>
            <a class="item"        data-tab="training"> Training </a>
        </div>
    }

    componentDidMount(): void {
        $('.tabs.menu .item').tab()   //TODO: use ref/unique id
    }
}


export function MainContainer(): preact.JSX.Element {
    return <div class="ui container page-wide" id="main-container">
        <Tabs/>

        <div class="ui active tab segment unselectable" data-tab="detection" style="padding:0">
            <DetectionTab />
        </div>

        <div class="ui bottom attached tab" data-tab="training">
            {/* <TrainingTab /> */}
            Training
        </div>
    </div>
}
