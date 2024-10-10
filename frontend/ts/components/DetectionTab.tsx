import { JSX, signals } from "../dep.ts"
import type {BaseSettings}   from "../logic/settings.ts"
import { 
         FileTable,
         FileTableProps,
    type FileTableColumn 
} from "./FileTable.tsx"
import { AppState }     from "./state.ts"
import * as state       from "./state.ts"
import { TabContent }   from "./MainContainer.tsx";

import { ProcessingModule } from "../logic/files.ts"
import * as files           from "../logic/files.ts"

import { ObjectdetectionRow }               from "./FileTableRow.tsx";
import { SegmentationContent }              from "./ImageOverlay.tsx"
import { InstanceSegmentationContent }      from "./ImageOverlay.tsx"
import { ObjectdetectionContent }           from "./BoxesOverlay.tsx";
import { LabelDropdown }                    from "./BoxesOverlay.tsx";
import { FileTableMenu, DownloadAllWithCSVAndAnnotations } from "./FileTableMenu.tsx";
import { collect_all_classes_from_appstate } from "./ui_util.ts";
import * as objdet                          from "../logic/objectdetection.ts";
import * as segm                            from "../logic/segmentation.ts";
import * as instseg                         from "../logic/instancesegmentation.ts";



type ProcessingModuleOfAppState<S extends AppState> 
    = ProcessingModule<state.InputTypeOfAppState<S>, state.ResultTypeOfAppState<S>>

export type FileTableContent<S extends AppState>
    = FileTableProps<
        state.InputTypeOfAppState<S>, 
        state.ResultTypeOfAppState<S>
    >['FileTableContent']

export type FileTableRow<S extends AppState>
    = FileTableProps<
        state.InputTypeOfAppState<S>, 
        state.ResultTypeOfAppState<S>
    >['FileTableRow']

export class DetectionTab<S extends AppState> extends TabContent<S> {
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
            sortable          = { false } 
            $files            = { this.$files() }
            $processing       = { appstate.$processing }
            $processingmodule = {
                signals.computed( this.processingmodule.bind(this) )
            }
            columns           = { this.columns() }
            FileTableRow      = { this.file_table_row() }
            FileTableContent  = { this.file_table_content() }
        />; 
    }

    /** @virtual */
    resultclass(): files.ResultValidator<state.ResultTypeOfAppState<S>> {
        return files.Result;
    }

    /** @virtual */
    processingmodule(): ProcessingModuleOfAppState<S>|null {
        const settings:state.SettingsOfAppState<S>|undefined 
            = this.props.appstate.$settings.value;
        if(settings == undefined)
            return null
        
        return new this.props.backend(this.resultclass(), settings)
    }

    /** @virtual */
    file_table_content(): FileTableContent<S>  {
        return undefined;
    }

    /** @virtual */
    columns(): FileTableColumn[] | undefined {
        return undefined;
    }

    /** @virtual */
    file_table_row(): FileTableRow<S> {
        return undefined;
    }

    /** @virtual */
    $files(): state.InputFileList<state.Input, state.Result> {
        return this.props.appstate.$files;
    }
}


export class ObjectdetectionAppState extends AppState<
    objdet.Input, 
    objdet.ObjectdetectionResult, 
    BaseSettings
>{}

export class ObjectDetectionTab<S extends ObjectdetectionAppState>
extends DetectionTab<S> {
    constructor(...args:ConstructorParameters<typeof DetectionTab<S>>) {
        super(...args)

        /** NOTE: overriding default prop of the label dropdown out of convenience */
        LabelDropdown.defaultProps.collect_all_classes = 
            () => collect_all_classes_from_appstate( this.props.appstate );
        
        FileTableMenu.defaultProps.DownloadButton = DownloadAllWithCSVAndAnnotations;
    }

    /** @virtual */                 //TODO: remove
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
            $processingmodule =  { 
                //TODO: does not seem to get updated
                signals.computed( this.processingmodule.bind(this) )
            }
            FileTableRow     =  { ObjectdetectionRow }
            FileTableContent =  { ObjectdetectionContent }
        />; 
    }

    /** @override */
    resultclass() {
        return objdet.ObjectdetectionResult;
    }

    /** @override */
    columns(): FileTableColumn[] | undefined {
        return [
            {label:'Files',      width_css_class:'six'}, 
            {label:'Detections', width_css_class:'ten'},
        ]
    }

    /** @override */
    file_table_row(): FileTableRow<S> {
        return ObjectdetectionRow;
    }
}



export class SegmentationAppState extends AppState<
    segm.SegmentationInput, segm.SegmentationResult, BaseSettings
>{}


export
class SegmentationTab<S extends SegmentationAppState> extends DetectionTab<S> {

    /** @override */
    // processingmodule(): ProcessingModuleOfAppState<S>|null {
    //     const settings:BaseSettings|undefined = this.props.appstate.$settings.value;
    //     if(settings == undefined)
    //         return null;
        
    //     return new this.props.backend(segm.SegmentationResult, settings)
    // }

    /** @override */
    resultclass() {
        return segm.SegmentationResult;
    }

    /** @override */
    file_table_content(): FileTableContent<S> {
        return SegmentationContent;
    }
}


export class InstanceSegmentationAppState extends AppState<
    instseg.InstanceSegmentationInput, instseg.InstanceSegmentationResult, BaseSettings
>{}

export class InstanceSegmentationTab<S extends InstanceSegmentationAppState> 
extends SegmentationTab<S> {
    /** @override */
    resultclass() {
        return instseg.InstanceSegmentationResult;
    }

    /** @override */
    file_table_content(): FileTableContent<S> {
        return InstanceSegmentationContent;
    }
}
