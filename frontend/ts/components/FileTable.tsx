import { preact, JSX, signals, ReadonlySignal }         from "../dep.ts"
import { Input, Result, ProcessingModule }              from "../logic/files.ts"
import { InputFileList, InputResultPair }               from "./state.ts"
import { Constructor, ImageSize }                       from "../util.ts";
import { ContentMenu }                                  from "./ContentMenu.tsx"
import { ImageContainer, ImageControls, InputImage }    from "./ImageComponents.tsx"
import { FileTableMenu }                                from "./FileTableMenu.tsx";
import { FileTableRow, FileTableRowProps }              from "./FileTableRow.tsx";
import { ProgressDimmer }                               from "./ProgressDimmer.tsx";

import type { TypeConfig, BaseConfig }  from "../typeconfig.ts";


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


type FileTableContentProps<I extends Input = Input, R extends Result = Result> 
= FileTableRowProps<I,R> & {
    /** Flag indicating that the content is loaded and ready to be displayed */
    $loaded:           signals.Signal<boolean>
    processingmodule:  ProcessingModule<I, R>
}

/** Input image, result overlays and controls */
export abstract class FileTableContent<P extends FileTableContentProps = FileTableContentProps> 
extends preact.Component<P> {
    $result_visible: signals.Signal<boolean> = new signals.Signal(true)

    render(props: P): JSX.Element {
        return <>
            <ContentMenu 
                input            = {props.input} 
                $result          = {props.$result}
                $result_visible  = {this.$result_visible}
                view_menu_extras = {this.view_menu_extras()}
                processingmodule = {props.processingmodule}
            >
                { this.content_menu_extras() } 
            </ContentMenu>
            
            { this.contentview() }
        </>
    }

    /** Additional menu elements to display in the "eye" view menu
     *  @virtual Overwritten by subclasses if needed */
    view_menu_extras(): JSX.Element[] {
        return []
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
extends FileTableContent< FileTableContentProps<File, R> > {

    /** Size of the displayed image or null if image not yet loaded. 
     *  Forwarded from InputImage. */
    $imagesize: signals.Signal<ImageSize|null> = new signals.Signal(null)

    /** The actual content */
    contentview(): JSX.Element {
        return <ImageContainer>
            <ImageControls $imagesize={this.$imagesize}>
                <InputImage 
                    inputfile    = {this.props.input} 
                    $active_file = {this.props.active_file}
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





export type FileTableItemProps<TC extends TypeConfig> = FileTableRowProps & {
    /** A module handling input processing requests */
    processingmodule:  ProcessingModule<TC['Input'], TC['Result']>

    /** @virtual To be overwritten downstream 
     *  @default {@link FileTableRow} */
    FileTableRow:     Constructor<FileTableRow>

    /** @virtual To be overwritten downstream 
     *  @default {@link SingleFileContent} */
    FileTableContent: Constructor<FileTableContent>;
};

/** A table row and the corresponding content, which is initially hidden */
class FileTableItem<TC extends TypeConfig> extends preact.Component<FileTableItemProps<TC>> {
    static defaultProps: Pick<FileTableItemProps<never>, 'FileTableContent'|'FileTableRow'> = {
        'FileTableContent' : SingleFileContent,
        'FileTableRow'     : FileTableRow,
    }


    $loaded:  signals.Signal<boolean> = new signals.Signal(false);
    $loading: signals.ReadonlySignal<boolean> 
        = signals.computed( () => !this.$loaded.value )
    
    render( props:FileTableItemProps<TC> ): JSX.Element {
        const no_padding_css = { padding: 0 }

        return <>
            <props.FileTableRow 
                input         = {props.input}
                $result       = {props.$result}
                active_file   = {props.active_file}
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





type FileTableProps<TC extends TypeConfig> = {
    /** The list of files that this file table should display */
    $files:     InputFileList<TC['Input'], TC['Result']>
    
    /** Whether or not a processing is operation is running somewehere in the app.
     *  Some UI elements might be disabled. */
    $processing:signals.Signal<boolean>;
    
    /** Whether or not the table should be sortable **(TODO: not implemented)** */
    sortable:   boolean;

    /** Column names and widths.
     * @default ```'Files'``` */
    columns:    FileTableColumn[];

    /** A module handling input processing requests */
    processingmodule:  ProcessingModule<TC['Input'], TC['Result']>

    /** Component class to show as the row title
     * @default {@link FileTableRow} */
    FileTableRow?:     Constructor<FileTableRow<FileTableRowProps<TC['Input'], TC['Result']>>>;

    /** Component class to show as the content of the table rows */
    FileTableContent?: Constructor<FileTableContent>;
}

export class FileTable<TC extends TypeConfig = BaseConfig> extends preact.Component<FileTableProps<TC>> {
    static defaultProps: Pick<FileTableProps<BaseConfig>, 'columns'> = {
        columns: [{label:'Files', width_css_class:'sixteen'}]
    }

    /** The currently displayed filename. null if all closed. */
    #$active_file:signals.Signal<string|null> = new signals.Signal(null);

    /** Ref to the main <table> element */
    ref: preact.RefObject<HTMLTableElement> = preact.createRef()

    render(props: FileTableProps<TC>): JSX.Element {
        const sort_class: string = props.sortable ? 'sortable' : '';         //TODO fix classes

        const rows: JSX.Element[] = props.$files.value.map(
            (pair: InputResultPair<TC['Input'], TC['Result']>) => 
                <FileTableItem<TC> 
                    key         =   {pair.input.name} 
                    input       =   {pair.input}
                    $result     =   {pair.$result}
                    active_file =   {this.#$active_file}
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
        const _this:FileTable<TC> = this;

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
