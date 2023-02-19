import { preact, signals }                      from "../dep.ts"
import type { AppFileState, AppFileList }       from "../state.ts"
import { ContentMenu }                          from "./ContentMenu.tsx"
import { ImageContainer, ImageControls, InputImage }    from "./ImageComponents.tsx"
import type { InputImageProps }                         from "./ImageComponents.tsx"


export function FileTableHead(): preact.JSX.Element {
    return <thead>

    </thead>
}



/** Static rotating spinner to indicate image loading */
export function LoadingSpinner(): preact.JSX.Element {
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
export function SpinnerSwitch(props:SpinnerSwitchProps): preact.JSX.Element {
    const maybe_spinner: preact.JSX.Element | []
        = props.loading ? <LoadingSpinner /> : [];

    return <>
        { maybe_spinner }
        <div style={{display: props.loading? 'none' : null}}>
            { props.children }
        </div>
    </>
}

export function FileTableRow( props:InputImageProps ): preact.JSX.Element {
    const loading: signals.ReadonlySignal<boolean> 
        = signals.computed( () => !props.file.$loaded.value )

    return <>
        {/* The row of the file table, conains image name and optionally more */}
        <tr class="ui title table-row">
            <td> {props.file.name} </td>
        </tr>
        {/* The content, shown when clicked on a row. */}
        <tr style="display:none" {...{filename:props.file.name} }>
            <td>
                <SpinnerSwitch loading={loading.value}> 
                    {/* TODO: refactor */}
                    <ContentMenu file={props.file} />
                    <ImageContainer>
                        <ImageControls imagesize={props.file.$size}>
                            <InputImage {...props} /> 
                        </ImageControls>
                    </ImageContainer>
                </SpinnerSwitch>
            </td>
        </tr>
    </>
}





type FileTableBodyProps = {
    files:          AppFileList;
    active_file:    signals.ReadonlySignal<string|null>;
}

export function FileTableBody(props:FileTableBodyProps): preact.JSX.Element {
    const rows: preact.JSX.Element[] 
        = props.files.value.map( (f:AppFileState) => <FileTableRow key={f.name} file={f} active_file={props.active_file}/>)
    
    return <tbody>
        { rows }
    </tbody>
}





type FileTableProps = {
    files:      AppFileList;
    sortable:   boolean;
}

export class FileTable extends preact.Component<FileTableProps> {
    /** The currently displayed filename. null if all closed. */
    #$active_file:signals.Signal<string|null> = new signals.Signal(null);

    render(): preact.JSX.Element {
        const sort_class: string = this.props.sortable ? 'sortable' : '';         //TODO fix classes
        return <table class="ui fixed celled { sort_class } unstackable table accordion filetable" style="border:0px; margin-top:0px;" >
            <FileTableHead />
            <FileTableBody files={this.props.files} active_file={this.#$active_file}/>
        </table>
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
