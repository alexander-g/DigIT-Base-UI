import { preact, JSX, signals }                 from "../dep.ts"
import type { AppFileState, AppFileList }       from "../state.ts"
import { ContentMenu }                          from "./ContentMenu.tsx"
import { ImageContainer, ImageControls, InputImage }    from "./ImageComponents.tsx"
import { ResultOverlays }                               from "./ResultOverlay.tsx";
import { FileTableMenu }                                from "./FileTableMenu.tsx";
import { FileTableRow, FileTableRowProps }              from "./FileTableRow.tsx";
import { ProgressDimmer }                               from "./ProgressDimmer.tsx";





export function FileTableHead(props:{labels_column:boolean}): JSX.Element {
    const first_cell_width:string  = props.labels_column? 'six' : 'sixteen'
    const second_cell_wdith:string = props.labels_column? 'ten' : ''
    return <thead>
        <tr>
            <th class={first_cell_width+" wide"}></th>
            {props.labels_column? <th class={second_cell_wdith+" wide"}></th> : []}
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


type FileTableItem = FileTableRowProps;

/** A table row and the corresponding content, which is initially hidden */
export function FileTableItem( props:FileTableItem ): JSX.Element {
    const loading: signals.ReadonlySignal<boolean> 
        = signals.computed( () => !props.file.$loaded.value )

    const no_padding_css = { padding: 0 }

    return <>
        <FileTableRow {...props} />

        {/* The content, shown when clicked on a row. */}
        <tr style="display:none" {...{filename:props.file.name} }>
            <td class="ui content" style={no_padding_css} colSpan={10000}>
                <SpinnerSwitch loading={loading.value}> 
                    {/* TODO: refactor */}
                    <ContentMenu file={props.file} />
                    <ImageContainer>
                        <ImageControls imagesize={props.file.$size}>
                            <InputImage {...props} /> 
                            <ResultOverlays 
                                result      =   { props.file.$result } 
                                imagesize   =   { props.file.$size.value }
                            />
                        </ImageControls>
                        <ProgressDimmer result={ props.file.$result }/>
                    </ImageContainer>
                </SpinnerSwitch>
            </td>
        </tr>
    </>
}



type FileTableBodyProps = {
    files:          AppFileList;
    active_file:    signals.ReadonlySignal<string|null>;
    
    /** Add a second column that contains labels */
    labels_column:  boolean;
}

export function FileTableBody(props:FileTableBodyProps): JSX.Element {
    const rows: JSX.Element[] = props.files.value.map( 
        (f:AppFileState) => 
            <FileTableItem 
                key         =   {f.name} 
                file        =   {f} 
                active_file =   {props.active_file}
                labels_column = {props.labels_column}
            />
    )
    
    return <tbody>
        { rows }
    </tbody>
}





type FileTableProps = {
    /** The list of files that this file table should display */
    files:      AppFileList;
    
    /** Whether or not a processing is operation is running somewehere in the app.
     *  Some UI elements might be disabled.
     */
    processing: signals.Signal<boolean>;
    
    /** Whether or not the table should be sortable **(TODO: not implemented)** */
    sortable:   boolean;

    /** Add a second column that contains labels */
    labels_column:  boolean;
}

export class FileTable extends preact.Component<FileTableProps> {
    /** The currently displayed filename. null if all closed. */
    #$active_file:signals.Signal<string|null> = new signals.Signal(null);

    render(props: FileTableProps): JSX.Element {
        const sort_class: string = props.sortable ? 'sortable' : '';         //TODO fix classes
        return  <>
        <FileTableMenu displayed_files={props.files.value} processing={props.processing}/>
        <table class="ui fixed celled unstackable table accordion filetable" style="border:0px; margin-top:0px;" >
            <FileTableHead 
                labels_column   =   {props.labels_column}
            />
            <FileTableBody 
                files           =   {props.files} 
                active_file     =   {this.#$active_file}
                labels_column   =   {props.labels_column}
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
        this.#$active_file.value     = filename;
    }
}
