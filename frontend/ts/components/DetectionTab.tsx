import { preact, JSX }  from "../dep.ts"
import { FileTable }    from "./FileTable.tsx"
import { AppState }     from "./state.ts"

import { ObjectdetectionFlaskProcessing }   from "../logic/objectdetection.ts";
import { ObjectdetectionRow }               from "./FileTableRow.tsx";
import { ObjectdetectionContent }           from "./BoxesOverlay.tsx";
import { LabelDropdown }                    from "./BoxesOverlay.tsx";
import { FileTableMenu, DownloadAllWithCSVAndAnnotations } from "./FileTableMenu.tsx";
import { collect_all_classes_from_appstate } from "./ui_util.ts";
import * as objdet                          from "../logic/objectdetection.ts";

export type DetectionTabProps<APPSTATE extends AppState> = {
    /** Name of the tab, used to associate it with the tab button */
    name:           string;

    /** Global application state */
    appstate:       APPSTATE;
}


export class DetectionTab<S extends AppState> 
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
        const appstate: S = this.props.appstate;
        return <FileTable 
            sortable        =   {false} 
            $files          =   {appstate.$files}
            $processing     =   {appstate.$processing}
            processingmodule =  { new ObjectdetectionFlaskProcessing() }  //TODO: replace
        />; 
    }
}


export class ObjectDetectionTab<S extends AppState<objdet.Input, objdet.ObjectdetectionResult>>
extends DetectionTab<S> {
    constructor(...args:ConstructorParameters<typeof DetectionTab<S>>) {
        super(...args)

        /** NOTE: overriding default prop of the label dropdown out of convenience */
        LabelDropdown.defaultProps.collect_all_classes = 
            () => collect_all_classes_from_appstate( this.props.appstate );
        
        FileTableMenu.defaultProps.DownloadButton = DownloadAllWithCSVAndAnnotations;
    }

    /** @virtual */
    file_table(): JSX.Element {
        const appstate: S = this.props.appstate;
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

