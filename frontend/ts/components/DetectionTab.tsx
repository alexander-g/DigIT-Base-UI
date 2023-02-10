import { preact }       from "../dep.ts"
import { FileTable }    from "./FileTable.tsx"

import { STATE }      from "../state.ts"         //FIXME: hard-coded



export function DetectionTab(): preact.JSX.Element {
    return <>
        <FileTable sortable={false} files={STATE.files} />    {/* FIXME: hard-coded */}
    </>
}

