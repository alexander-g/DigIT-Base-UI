import { preact, JSX, signals }     from "../dep.ts";
import { InputFile, Result }        from "../logic/files.ts";
import { InputResultPair }          from "../state.ts";
import { FileTableStatusIcons }     from "./StatusIcons.tsx";
import type { Instance }            from "../logic/boxes.ts";


export type FileTableRowProps<IF extends InputFile = InputFile, R extends Result = Result> 
= InputResultPair<IF, R> & {
    /** Which file(name) is currently displayed in this file table */
    active_file:    signals.ReadonlySignal<string|null>;
}



/** The row of the file table, conains image name and optionally more */
export class FileTableRow<P extends FileTableRowProps = FileTableRowProps> extends preact.Component<P> {
    tr_ref: preact.RefObject<HTMLTableRowElement> = preact.createRef()

    render(props: P): JSX.Element {
        const processed: boolean = (props.$result.value.status == 'processed')
        const css = {
            fontWeight:     processed? 'bold' : 'normal'
        }
        return <tr class="ui title table-row" ref={this.tr_ref} style={css}>
            <td>
                <i class="dropdown icon"></i>
                <FileTableStatusIcons $result={props.$result}/>
                <label>
                    {props.input.name}
                </label>
            </td>

            {/* TODO: this should be optional  */}
            <LabelsColumn $instances={props.$result.$instances} /> : []
            
        </tr>
    }

    // dispose callbacks
    #scroll_effects:(() => void)[] = []

    /** Setup of auto-scrolling behaviour when a table row is opened */
    componentDidMount(): void {
        this.#maybe_init_top()

        //works on the first time, wont work later
        const dispose0: (() => void) = signals.effect(() => {
            if(this.props.input.$loaded.value)
                this.#scroll_to_row()
        })
        //doesnt work on the first time, will work later
        const dispose1: (() => void) = signals.effect(() => {
            //initializing #top inside the callback because it might 
            //not have been initialized correctly if the tab was not active
            this.#maybe_init_top()
            if(this.props.active_file.value == this.props.input.name)
                this.#scroll_to_row()
        })

        this.#scroll_effects.push(dispose0)
        this.#scroll_effects.push(dispose1)
    }


    /** y coordinate of this row */
    #top: number|undefined = undefined;

    #maybe_init_top(): void {
        //only init once
        if(this.#top != undefined)
            return;
        
        const tr:HTMLTableRowElement|null = this.tr_ref.current;
        if(tr == null)
            return;
        
        const is_visible:boolean = (tr.offsetParent != null)
        if(!is_visible)
            return;

        this.#top = tr.getBoundingClientRect().top + document.documentElement.scrollTop
    }


    /** Called when an accordion opens, scrolls to this row */
    #scroll_to_row(): void {
        console.log('scrolling to ', this.#top)
        setTimeout(() => {
            window.scrollTo( {top:this.#top, behavior:'smooth'} )
        }, 10)
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
