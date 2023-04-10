import { preact, JSX, signals }     from "../dep.ts";
import { ResultState }              from "../state.ts";
import { FileTableStatusIcons }     from "./StatusIcons.tsx";
import type { InputImageProps }     from "./ImageComponents.tsx"
import type { Instance }            from "../logic/boxes.ts";


export type FileTableRowProps = InputImageProps & {
    $result:        signals.ReadonlySignal<ResultState>;

    /** Add a second column that contains labels */
    labels_column:  boolean;
}



/** The row of the file table, conains image name and optionally more */
export class FileTableRow extends preact.Component<FileTableRowProps> {
    tr_ref: preact.RefObject<HTMLTableRowElement> = preact.createRef()

    render(props: FileTableRowProps): JSX.Element {
        const processed: boolean = (props.$result.value.status == 'processed')
        const css = {
            fontWeight:     processed? 'bold' : 'normal'
        }
        return <tr class="ui title table-row" ref={this.tr_ref} style={css}>
            <td>
                <i class="dropdown icon"></i>
                <FileTableStatusIcons $result={props.$result}/>
                <label>
                    {props.inputfile.name}
                </label>
            </td>
            { props.labels_column? 
                <LabelsColumn $instances={props.$result.value.$instances} /> : []
            }
        </tr>
    }

    // dispose callbacks
    #scroll_effects:(() => void)[] = []

    /** Setup of auto-scrolling behaviour when a table row is opened */
    componentDidMount(): void {
        if(this.tr_ref.current) {
            /** The position of the row from top of the document */
            const top:number = this.tr_ref.current.getBoundingClientRect().top 
                             + document.documentElement.scrollTop
            
            /** Called when an accordion opens, scrolls to this row */
            const scroll_to_row: () => void
                = () => setTimeout(() => {
                    window.scrollTo( {top:top, behavior:'smooth'} )
                }, 10)

            //works on the first time, wont work later
            const dispose0: (() => void) = signals.effect(() => {
                if(this.props.inputfile.$loaded.value)
                    scroll_to_row()
            })
            //doesnt work on the first time, will work later
            const dispose1: (() => void) = signals.effect(() => {
                if(this.props.active_file.value == this.props.inputfile.name)
                    scroll_to_row()
            })

            this.#scroll_effects.push(dispose0)
            this.#scroll_effects.push(dispose1)
        }
    }

    /** Clean up effects */
    componentWillUnmount(): void {
        for(const dispose_fn of this.#scroll_effects) {
            dispose_fn()
        }
    }
}


type LabelsColumnProps = {
    $instances:      signals.ReadonlySignal<readonly Instance[]|undefined>
}

/** Column in the FileTable that displays which and how many labels were detected */
export function LabelsColumn(props:LabelsColumnProps): JSX.Element {
    const labels:string[] = props.$instances.value?.map( (i:Instance) => i.label ) ?? []
    const text:  string   = labels.join(', ')
    return (
        <td>
            <label class="detected-labels-summary">
                { text }
            </label>
        </td>
    )
}
