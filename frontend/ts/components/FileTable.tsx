import { preact, signals }  from "../dep.ts"
import { type AppFile }     from "../state.ts"
import "../jquery_mock.ts"


export function FileTableHead(): preact.JSX.Element {
    return <thead>

    </thead>
}



export function FileTableRow( props:{file:AppFile} ): preact.JSX.Element {
    return <>
        <tr class="ui title table-row">
            <td> {props.file.name} </td>
        </tr>
        <tr style="display:none">
            <td>Content</td>
        </tr>
    </>
}





type FileTableBodyProps = {
    files:      signals.Signal<AppFile[]>,
}

export function FileTableBody(props:FileTableBodyProps): preact.JSX.Element {
    const rows: preact.JSX.Element[] 
        = props.files.value.map( (f:AppFile) => <FileTableRow key={f.name} file={f}/>)
    
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
        $('.filetable.accordion').accordion({
            duration:  0, 
            onOpening: function() { console.warn("TODO: on_accordion_open()") },
        })
    }
}
