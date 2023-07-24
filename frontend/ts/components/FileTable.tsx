import { preact, JSX, signals, ReadonlySignal }         from "../dep.ts"
import { Input, Result, ProcessingModule, InputResultPair }        from "../logic/files.ts"
import { InputFileList, InputResultPair as InputResultSignalPair } from "./state.ts"
import { Constructor, ImageSize }                       from "../util.ts";
import { ContentMenu }                                  from "./ContentMenu.tsx"
import { ImageContainer, ImageControls, InputImage }    from "./ImageComponents.tsx"
import { FileTableMenu }                                from "./FileTableMenu.tsx";
import { FileTableRow, FileTableRowProps }              from "./FileTableRow.tsx";
import { ProgressDimmer }                               from "./ProgressDimmer.tsx";



type FomanticWidth = (
    'one'|'two'|'three'|'four'|'five'|'six'|'seven'|'eight'|'nine'|'ten'
    |'eleven'|'twelve'|'thirteen'|'fourteen'|'fifteen'|'sixteen'
)

type FileTableColumn = {label:string, width_css_class:FomanticWidth}

export function FileTableHead(props:{columns: FileTableColumn[]}): JSX.Element {
    const columns_jsx: JSX.Element[] = props.columns.map(
        (c: FileTableColumn) => <th class={c.width_css_class+' wide'}>
            { c.label }
        </th>
    )

    return <thead>
        <tr>
            { columns_jsx }
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
    $loading:    boolean,
    children:   preact.ComponentChildren,
}

/** Display either a spinner or the children components */
export function SpinnerSwitch(props:SpinnerSwitchProps): JSX.Element {
    const maybe_spinner: JSX.Element | []
        = props.$loading ? <LoadingSpinner /> : [];

    return <>
        { maybe_spinner }
        <div style={{display: props.$loading? 'none' : null}}>
            { props.children }
        </div>
    </>
}


export type FileTableContentProps<I extends Input, R extends Result> 
= FileTableRowProps<I,R> & {
    /** Flag indicating that the content is loaded and ready to be displayed */
    $loaded:           signals.Signal<boolean>
    processingmodule:  ProcessingModule<I, R>
}

/** Input image, result overlays and controls */
export abstract class FileTableContent<I extends Input, R extends Result> 
extends preact.Component<FileTableContentProps<I,R>> {
    $result_visible: signals.Signal<boolean> = new signals.Signal(true)

    render(_props: FileTableContentProps<I,R>): JSX.Element {
        return <>
            { this.contentmenu() }
            { this.contentview() }
        </>
    }

    contentmenu(): JSX.Element {
        return (
        <ContentMenu 
            input            = {this.props.input} 
            $result          = {this.props.$result}
            $result_visible  = {this.$result_visible}
            view_menu_extras = {this.view_menu_extras()}
            help_button      = {this.help_menu()}
            processingmodule = {this.props.processingmodule}
        >
            { this.content_menu_extras() } 
        </ContentMenu>
        )
    }

    /** Additional menu elements to display in the "eye" view menu
     *  @virtual Overwritten by subclasses if needed */
    view_menu_extras(): JSX.Element[] {
        return []
    }

    /** Help button which displays an overlay with instructions */
    help_menu(): JSX.Element|undefined {
        //use default
        return undefined;
    }

    /** Additional menu buttons to display in the content menu
     *  @virtual Overwritten by subclasses if needed */
    content_menu_extras(): JSX.Element[] {
        return []
    }

    /** @virtual The actual content */
    abstract contentview(): JSX.Element;
}


export class SingleFileContent<R extends Result = Result> 
extends FileTableContent< File, R > {

    /** Size of the displayed image or null if image not yet loaded. 
     *  Forwarded from InputImage. */
    $imagesize: signals.Signal<ImageSize|null> = new signals.Signal(null)

    /** The actual content */
    contentview(): JSX.Element {
        return <ImageContainer>
            <ImageControls $imagesize={this.$imagesize}>
                <InputImage 
                    inputfile    = {this.props.input} 
                    $active_file = {this.props.$active_file}
                    $loaded      = {this.props.$loaded}
                    $size        = {this.$imagesize}
                /> 
                { this.result_overlays() }
            </ImageControls>
            <ProgressDimmer $result={ this.props.$result }/>
        </ImageContainer>
    }

    /** The result overlays element to display on top of the input image
     *  @virtual Can be overwritten  downstream for custom overlays */
    result_overlays(): JSX.Element {
        return <></>
    }
}





export type FileTableItemProps<I extends Input, R extends Result> = FileTableRowProps<I,R> & {
    /** A module handling input processing requests */
    processingmodule:  ProcessingModule<I,R>

    /** @virtual To be overwritten downstream 
     *  @default {@link FileTableRow} */
    FileTableRow:     Constructor<FileTableRow<I,R>>

    /** @virtual To be overwritten downstream 
     *  @default {@link SingleFileContent} */
    FileTableContent: Constructor<FileTableContent<I,R>>;
};

/** A table row and the corresponding content, which is initially hidden */
class FileTableItem<I extends Input, R extends Result> extends preact.Component<FileTableItemProps<I,R>> {
    static defaultProps: Pick<FileTableItemProps<Input, Result>, 'FileTableContent'|'FileTableRow'> = {
        'FileTableContent' : SingleFileContent,
        'FileTableRow'     : FileTableRow,
    }

    $loaded:  signals.Signal<boolean> = new signals.Signal(false);
    $loading: signals.ReadonlySignal<boolean> 
        = signals.computed( () => !this.$loaded.value )
    
    render( props:FileTableItemProps<I,R> ): JSX.Element {
        const no_padding_css = { padding: 0 }

        return <>
            <props.FileTableRow 
                input         = {props.input}
                $result       = {props.$result}
                $active_file   = {props.$active_file}
                $loaded       = {this.$loaded}
            />

            {/* The content, shown when clicked on a row. */}
            <tr style="display:none" {...{filename:props.input.name} }>
                <td class="ui content" style={no_padding_css} colSpan={10000}>
                    <SpinnerSwitch $loading={this.$loading.value}> 
                        <props.FileTableContent {...props} $loaded={this.$loaded} />
                    </SpinnerSwitch>
                </td>
            </tr>
        </>
    }
}





//type FileTableProps<IR extends InputResultPair> = {
    type FileTableProps<I extends Input, R extends Result> = {
    /** The list of files that this file table should display */
    $files:     InputFileList<I,R>
    
    /** Whether or not a processing is operation is running somewehere in the app.
     *  Some UI elements might be disabled. */
    $processing:signals.Signal<boolean>;
    
    /** Whether or not the table should be sortable **(TODO: not implemented)** */
    sortable:   boolean;

    /** Column names and widths.
     * @default ```'Files'``` */
    columns:    FileTableColumn[];

    /** A module handling input processing requests */
    processingmodule:  ProcessingModule<I,R>

    /** Component class to show as the row title
     * @default {@link FileTableRow} */
    FileTableRow?:     Constructor<FileTableRow<I,R>>;

    /** Component class to show as the content of the table rows */
    FileTableContent?: Constructor<FileTableContent<I,R>>;
}

//export class FileTable<IR extends InputResultPair> extends preact.Component<FileTableProps<IR>> {
export class FileTable<I extends Input, R extends Result> extends preact.Component<FileTableProps<I,R>> {
    //Single column 'Files' by default
    static defaultProps: Pick<FileTableProps<never, never>, 'columns'> = {
        columns: [{label:'Files', width_css_class:'sixteen'}]
    }

    /** The currently displayed filename. null if all closed. */
    #$active_file:signals.Signal<string|null> = new signals.Signal(null);

    /** Ref to the main <table> element */
    ref: preact.RefObject<HTMLTableElement> = preact.createRef()

    render(props: FileTableProps<I,R>): JSX.Element {
        const sort_class: string = props.sortable ? 'sortable' : '';         //TODO fix classes

        const rows: JSX.Element[] = props.$files.value.map(
            (pair: InputResultSignalPair<I,R>) => 
                <FileTableItem<I,R> 
                    key         =   {pair.input.name} 
                    input       =   {pair.input}
                    $result     =   {pair.$result}
                    $active_file     =   {this.#$active_file}
                    processingmodule = {props.processingmodule}
                    FileTableRow     = {props.FileTableRow}
                    FileTableContent = {props.FileTableContent}
                />
        )

        return  <>
        <FileTableMenu 
            displayed_items     =   {props.$files.value} 
            $processing         =   {props.$processing}
            processingmodule    =   {props.processingmodule}
        />
        <table 
            class = "ui fixed celled unstackable table accordion filetable" 
            style = "border:0px; margin-top:0px;" 
            ref   = { this.ref }
        >
            <FileTableHead columns = {props.columns} />
            <tbody>
                { rows }
            </tbody>
        </table>
        </>
    }

    componentDidMount(): void {
        // deno-lint-ignore no-this-alias
        const _this:FileTable<I,R> = this;

        $(this.ref.current).accordion({
            duration:  0, 
            onOpening: function(){ _this.on_accordion_open(this[0]) },
            onClose:   function(){ _this.#$active_file.value = null },
        })

        /** Reset #$active_file if input files changed */
        this.props.$files.subscribe(
            () => {this.#$active_file.value = null;}
        )
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
        this.#$active_file.value    = filename;
    }

    /** {@link #$active_file} */
    get $active_file(): ReadonlySignal<string|null> {
        return this.#$active_file;
    }
}
