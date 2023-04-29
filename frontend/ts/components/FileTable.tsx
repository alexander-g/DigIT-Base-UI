import { preact, JSX, signals, ReadonlySignal }         from "../dep.ts"
import { InputFileList, InputResultPair }               from "../state.ts"
import { Constructor }                                  from "../util.ts";
import { ContentMenu }                                  from "./ContentMenu.tsx"
import { ImageContainer, ImageControls, InputImage }    from "./ImageComponents.tsx"
import { ResultOverlays }                               from "./ResultOverlay.tsx";
import { FileTableMenu }                                from "./FileTableMenu.tsx";
import { FileTableRow, FileTableRowProps }              from "./FileTableRow.tsx";
import { ProgressDimmer }                               from "./ProgressDimmer.tsx";



export function FileTableHead(props:{labels_column:boolean}): JSX.Element {
    const first_col_width:string  = props.labels_column? 'six' : 'sixteen'
    const second_col_width:string = props.labels_column? 'ten' : ''
    const second_col: JSX.Element =
        props.labels_column? <th class={second_col_width + ' wide'}>Detections</th> : <></>

    return <thead>
        <tr>
            <th class={first_col_width+" wide"}>Files</th>
            { second_col }
        </tr>
    </thead>
}



/** Static rotating spinner to indicate image loading */
export function LoadingSpinner(): JSX.Element {
    return <div class="loading-message" style="display:flex;justify-content: center;">
        <i class="spinner loading icon"></i>
        Loading...
    </div>
}

type SpinnerSwitchProps = {
    loading:    boolean,
    children:   preact.ComponentChildren,
}

/** Display either a spinner or the children components */
export function SpinnerSwitch(props:SpinnerSwitchProps): JSX.Element {
    const maybe_spinner: JSX.Element | []
        = props.loading ? <LoadingSpinner /> : [];

    return <>
        { maybe_spinner }
        <div style={{display: props.loading? 'none' : null}}>
            { props.children }
        </div>
    </>
}


export type FileTableItemProps = FileTableRowProps & {
    /** @virtual To be overwritten downstream */
    FileTableContent?: Constructor<FileTableContent>;
};

/** A table row and the corresponding content, which is initially hidden */
class FileTableItem extends preact.Component<FileTableItemProps> {
    
    render( props:FileTableItemProps ): JSX.Element {
        const loading: signals.ReadonlySignal<boolean> 
            = signals.computed( () => !props.input.$loaded.value )

        const Content: Constructor<FileTableContent> = props.FileTableContent ?? FileTableContent

        const no_padding_css = { padding: 0 }

        return <>
            <FileTableRow {...props} />

            {/* The content, shown when clicked on a row. */}
            <tr style="display:none" {...{filename:props.input.name} }>
                <td class="ui content" style={no_padding_css} colSpan={10000}>
                    <SpinnerSwitch loading={loading.value}> 
                        <Content {...props}/>
                    </SpinnerSwitch>
                </td>
            </tr>
        </>
    }
}

/** Input image, result overlays and controls */
export class FileTableContent<P extends FileTableItemProps = FileTableItemProps> extends preact.Component<P> {
    $box_drawing_mode?: signals.Signal<boolean> = new signals.Signal(false)

    render(props: P): JSX.Element {
        return <>
            <ContentMenu 
                input            = {props.input} 
                $result          = {props.$result}
                box_drawing_mode = {this.$box_drawing_mode}
                view_menu_extras = {this.view_menu_extras()}
            />
            <ImageContainer>
                <ImageControls imagesize={props.input.$size}>
                    <InputImage inputfile={props.input} active_file={props.active_file} /> 
                    { this.result_overlays() }
                </ImageControls>
                <ProgressDimmer $result={ props.$result }/>
            </ImageContainer>
        </>
    }

    /** Additional menu elements to display in the "eye" view menu
     *  @virtual Meant to be overwritten downstream */
    view_menu_extras(): JSX.Element[] {
        return []
    }

    /** The result overlays element to display on top of the input image
     *  @virtual Can be overwritten  downstream for custom overlays */
    result_overlays(): JSX.Element {
        return <ResultOverlays 
            $result             =   { this.props.$result } 
            boxoverlay_props    =   { this.$box_drawing_mode? {
                imagesize:            this.props.input.$size.value,
                $drawing_mode_active: this.$box_drawing_mode
            } : undefined}
        />
    }
}



type FileTableBodyProps = {
    files:          InputFileList;
    active_file:    signals.ReadonlySignal<string|null>;
    
    /** Add a second column that contains labels */
    labels_column:  boolean;

    FileTableContent?: Constructor<FileTableContent>;
}

export function FileTableBody(props:FileTableBodyProps): JSX.Element {
    const rows: JSX.Element[] = props.files.value.map( 
        (pair:InputResultPair) => 
            <FileTableItem 
                key         =   {pair.input.name} 
                input       =   {pair.input}
                $result     =   {pair.$result}
                active_file =   {props.active_file}
                labels_column = {props.labels_column}
                FileTableContent = {props.FileTableContent}
            />
    )
    
    return <tbody>
        { rows }
    </tbody>
}





type FileTableProps = {
    /** The list of files that this file table should display */
    files:      InputFileList;
    
    /** Whether or not a processing is operation is running somewehere in the app.
     *  Some UI elements might be disabled.
     */
    processing: signals.Signal<boolean>;
    
    /** Whether or not the table should be sortable **(TODO: not implemented)** */
    sortable:   boolean;

    /** Add a second column that contains labels */
    labels_column:  boolean;

    /** Component class to show as the content of the table rows */
    FileTableContent?: Constructor<FileTableContent>;
}

export class FileTable extends preact.Component<FileTableProps> {
    /** The currently displayed filename. null if all closed. */
    #$active_file:signals.Signal<string|null> = new signals.Signal(null);  //TODO: reset to null when props.files changes

    render(props: FileTableProps): JSX.Element {
        const sort_class: string = props.sortable ? 'sortable' : '';         //TODO fix classes
        return  <>
        <FileTableMenu displayed_files={props.files.value} $processing={props.processing}/>
        <table class="ui fixed celled unstackable table accordion filetable" style="border:0px; margin-top:0px;" >
            <FileTableHead 
                labels_column   =   {props.labels_column}
            />
            <FileTableBody 
                files           =   {props.files} 
                active_file     =   {this.#$active_file}
                labels_column   =   {props.labels_column}
                FileTableContent =  {props.FileTableContent}
            />
        </table>
        </>
    }

    componentDidMount(): void {
        // deno-lint-ignore no-this-alias
        const _this:FileTable = this;

        $('.filetable.accordion').accordion({
            duration:  0, 
            onOpening: function(){ _this.on_accordion_open(this[0]) },
            onClose:   function(){ _this.#$active_file.value = null },
        })

        /** Reset #$active_file if input files changed */
        this.props.files.subscribe(
            () => {this.#$active_file.value = null;}
        )
    }

    /**
     * Callback from Fomantic after user clicks on a table row to open it.
     * Updates the currently open #$active_file which in turn initiates 
     * file loading in InputImage
     * 
     * @param opened_row - the second "tr" element from FileTableRow
     */
    private on_accordion_open(opened_row:HTMLTableRowElement|undefined): void {
        if(!opened_row)
            return
        
        const filename: string|null = opened_row.getAttribute('filename')
        this.#$active_file.value    = filename;
    }

    /** {@link #$active_file} */
    get $active_file(): ReadonlySignal<string|null> {
        return this.#$active_file;
    }
}
