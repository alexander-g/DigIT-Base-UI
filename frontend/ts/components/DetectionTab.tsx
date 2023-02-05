import { preact } from "../dep.ts"
import { type AppFile } from "../state.ts"
import * as STATE from "../state.ts"         //FIXME: hard-coded

type FileListProps = {
    files: AppFile[]
}

export function FileList(props: FileListProps): preact.JSX.Element {
    return <div>
        { 
            props.files.map(
                (f:AppFile):preact.JSX.Element => <p key={f.name}>{f.name}</p>
            ) 
        }
    </div>
}



export function DetectionTab(): preact.JSX.Element {
    return <>
        <FileList files={STATE.files.value}/>       {/* FIXME: hard-coded */}
    </>
}

