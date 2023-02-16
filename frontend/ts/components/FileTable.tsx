import { preact, signals }  from "../dep.ts"
import type { AppFileState, AppFile, AppFileList }     from "../state.ts"
import "../jquery_mock.ts"
import { set_image_src } from "../file_input.ts"
import { ContentMenu } from "./ContentMenu.tsx"


export function FileTableHead(): preact.JSX.Element {
    return <thead>

    </thead>
}




export function InputImage(props:{file:AppFileState}): preact.JSX.Element {
    return <img class={"input-image"} onLoad={console.warn}/>
}


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

export function FileTableRow( props:{file:AppFileState} ): preact.JSX.Element {
    const loading: signals.ReadonlySignal<boolean> 
        = signals.computed( () => !props.file.$loaded.value )

    return <>
        <tr class="ui title table-row">
            <td> {props.file.name} </td>
        </tr>
        <tr style="display:none" {...{filename:props.file.name} }>
            <td>
                <SpinnerSwitch loading={loading.value}> 
                    {/* TODO: refactor */}
                    <ContentMenu file={props.file} />
                    <InputImage file={props.file} /> 
                </SpinnerSwitch>
            </td>
        </tr>
    </>
}





type FileTableBodyProps = {
    files:      AppFileList,
}

export function FileTableBody(props:FileTableBodyProps): preact.JSX.Element {
    const rows: preact.JSX.Element[] 
        = props.files.value.map( (f:AppFileState) => <FileTableRow key={f.name} file={f}/>)
    
    return <tbody>
        { rows }
    </tbody>
}





type FileTableProps = FileTableBodyProps & {
    sortable:   boolean,
}

export class FileTable extends preact.Component<FileTableProps> {
    render(): preact.JSX.Element {
        const sort_class: string = this.props.sortable ? 'sortable' : '';         //TODO fix classes
        return <table class="ui fixed celled { sort_class } unstackable table accordion filetable" style="border:0px; margin-top:0px;" >
            <FileTableHead />
            <FileTableBody files={this.props.files}/>
        </table>
    }

    componentDidMount(): void {
        // deno-lint-ignore no-this-alias
        const _this:FileTable = this;

        $('.filetable.accordion').accordion({
            duration:  0, 
            onOpening: function(){ _this.on_accordion_open(this[0]) }
        })
    }

    /**
     * Callback from Fomantic after user clicks on a table row to open it.
     * Initiates loading the corresponding input image.
     * 
     * @param opened_row - the second "tr" element from FileTableRow
     */
    private on_accordion_open(opened_row:HTMLTableRowElement|undefined): void {
        if(!opened_row)
            return
        
        const filename: string|null = opened_row?.getAttribute('filename')
        //TODO: a direct mapping would be more elegant
        const files:AppFileState[]       = this.props.files.peek().filter(
            (f:AppFile) => (f.name == filename)
        )
        if(files.length != 1) {
            console.warn(`[WARNING] Unexpected number of files for ${filename}:`, files)
            return;
        }

        const file:AppFileState = files[0]!
        //TODO: refactor
        const input_image: HTMLImageElement|null = opened_row.querySelector('img.input-image')
        if(input_image){
            set_image_src(input_image, file)
            input_image.addEventListener('load', () => {
                input_image.parentElement?.style.removeProperty('display')
                file.$loaded.value = true;
            }, {once:true})
        }
    }
}
