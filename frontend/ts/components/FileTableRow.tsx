import { preact, JSX, signals }     from "../dep.ts";
import { Input, Result }            from "../logic/files.ts";
import { InputResultPair }          from "./state.ts";
import { FileTableStatusIcons }     from "./StatusIcons.tsx";
import type { Instance }            from "../logic/boxes.ts";

import { ObjectdetectionResult }    from "../logic/objectdetection.ts";


export type FileTableRowProps<I extends Input, R extends Result> 
= InputResultPair<I, R> & {
    /** Which file(name) is currently displayed in this file table */
    active_file:    signals.ReadonlySignal<string|null>;

    /** Flag indicating that the content is loaded. */
    $loaded?:        signals.ReadonlySignal<boolean>;
}



/** The row of the file table, conains image name and optionally more.
 *  Scrolls window on opening. */
export class FileTableRow<I extends Input, R extends Result> extends preact.Component<FileTableRowProps<I,R>> {
    tr_ref: preact.RefObject<HTMLTableRowElement> = preact.createRef()

    render(props: FileTableRowProps<I,R>): JSX.Element {
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

            { this.extra_columns() }

            {/* TODO: this should be optional  */}
            {/* <LabelsColumn $instances={props.$result.$instances} /> : [] */}
            
        </tr>
    }

    /** @virtual Additional columns added by child classes.s */
    extra_columns(): JSX.Element {
        return <></>
    }

    // dispose callbacks
    #scroll_effects:(() => void)[] = []

    /** Setup of auto-scrolling behaviour when a table row is opened */
    componentDidMount(): void {
        this.#maybe_init_top()

        //works on the first time, wont work later
        const dispose0: (() => void) = signals.effect(() => {
            if(this.props.$loaded?.value)
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




export class ObjectdetectionRow extends FileTableRow<Input, ObjectdetectionResult> {
    extra_columns(): preact.JSX.Element {
        return <LabelsColumn instances={this.props.$result.value.instances}/>
    }
}


type LabelsColumnProps = {
    instances:      readonly Instance[]|null
}

/** Column in the FileTable that displays which and how many labels were detected */
export function LabelsColumn(props:LabelsColumnProps): JSX.Element {
    const labels:string[] = props.instances?.map( (i:Instance) => i.label ) ?? []
    const text:  string   = labels.join(', ')
    return (
        <td>
            <label class="detected-labels-summary">
                { text }
            </label>
        </td>
    )
}
