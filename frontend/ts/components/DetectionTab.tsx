import { preact, JSX }  from "../dep.ts"
import { FileTable }    from "./FileTable.tsx"
import { AppState }     from "./state.ts"
import { ObjectdetectionFlaskProcessing }   from "../logic/objectdetection.ts";
import { ObjectdetectionRow }               from "./FileTableRow.tsx";
import { ObjectdetectionContent }           from "./BoxesOverlay.tsx";


export type DetectionTabProps<APPSTATE extends AppState> = {
    /** Name of the tab, used to associate it with the tab button */
    name:           string;

    /** Global application state */
    appstate:       APPSTATE;
}


export class DetectionTab<S extends AppState = AppState> 
extends preact.Component<DetectionTabProps<S>>{
    /** Flag indicating that this tab is the first one. Speeds up rendering.
     *  @virtual */
    // deno-lint-ignore no-inferrable-types
    is_first: boolean = true;

    render(): JSX.Element {
        const cls_active: 'active'|null = this.is_first ? 'active' : null
        return (
        <div 
            class    = {"ui tab segment unselectable " +cls_active} 
            data-tab = {this.props.name} 
            style    = "padding:0"
        >
            { this.file_table() }
        </div>
        )
    }

    /** @virtual */
    file_table(): JSX.Element {
        const appstate: AppState = this.props.appstate;
        return <FileTable 
            sortable        =   {false} 
            $files          =   {appstate.$files}
            $processing     =   {appstate.$processing}
            columns         =   {[
                {label:'Files',      width_css_class:'six'}, 
                {label:'Detections', width_css_class:'ten'}
            ]}
            processingmodule =  { new ObjectdetectionFlaskProcessing() }
            FileTableRow     =  { ObjectdetectionRow }
            FileTableContent =  { ObjectdetectionContent }
        />; 
    }
}

