import { preact, JSX }  from "../dep.ts"
import { FileTable }    from "./FileTable.tsx"
import { STATE }        from "../state.ts"         //FIXME: hard-coded



export class DetectionTab extends preact.Component<{name:string}>{
    render(): JSX.Element {
        return (
        <div class="ui active tab segment unselectable" data-tab={this.props.name} style="padding:0">
            { this.file_table() }
        </div>
        )
    }

    file_table(): JSX.Element {
        return <FileTable 
            sortable        =   {false} 
            files           =   {STATE.files}        //FIXME: hard-coded
            processing      =   {STATE.processing}   //FIXME: hard-coded
            labels_column   =   {true}
        />; 
    }
}

