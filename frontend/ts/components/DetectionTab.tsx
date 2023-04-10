import { preact, JSX }  from "../dep.ts"
import { FileTable }    from "./FileTable.tsx"
import { AppState }     from "../state.ts"


export type DetectionTabProps = {
    /** Name of the tab, used to associate it with the tab button */
    name:           string;

    /** Global application state */
    appstate:       AppState;
}


export class DetectionTab extends preact.Component<DetectionTabProps>{
    render(): JSX.Element {
        return (
        <div class="ui active tab segment unselectable" data-tab={this.props.name} style="padding:0">
            { this.file_table() }
        </div>
        )
    }

    file_table(): JSX.Element {
        const appstate: AppState = this.props.appstate;
        return <FileTable 
            sortable        =   {false} 
            files           =   {appstate.files}
            processing      =   {appstate.$processing}
            labels_column   =   {true}
        />; 
    }
}

