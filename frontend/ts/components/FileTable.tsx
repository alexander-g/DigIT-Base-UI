import { preact, signals }  from "../dep.ts"
import type { AppFileState, AppFileList, ImageSize }     from "../state.ts"
import "../jquery_mock.ts"
import { set_image_src } from "../file_input.ts"
import { ContentMenu } from "./ContentMenu.tsx"


export function FileTableHead(): preact.JSX.Element {
    return <thead>

    </thead>
}



type InputImageProps = {
    /** Which file to display */
    file:           AppFileState;
    /** Which file(name) is currently displayed in this file table */
    active_file:    signals.ReadonlySignal<string|null>;
}


class InputImage extends preact.Component<InputImageProps> {
    ref: preact.RefObject<HTMLImageElement> = preact.createRef()

    /** Load image as soon as it is beeing displayed in the file table, once */
    #init: () => void = signals.effect( () => {
        if(this.props.active_file.value == this.props.file.name 
            && !this.props.file.$loaded.value
            && this.ref.current) {
                set_image_src(this.ref.current, this.props.file)
        }
    })

    render(): preact.JSX.Element {
        const css = {width: '100%'}
        return <img class={"input-image"} onLoad={this.on_load.bind(this)} style={css} ref={this.ref} />
    }

    /** Image loading callback. Update the state. */
    on_load(): void {
        if(this.ref.current) {
            //TODO: resize if too large
            this.props.file.set_loaded(this.ref.current)
        }
    }
}


type ImageControlsProps = {
    children:       preact.ComponentChildren;
    imagesize:      signals.ReadonlySignal<ImageSize|undefined>;
}

/** Responsible for panning and zooming of images and important for layout */
export function ImageControls(props:ImageControlsProps): preact.JSX.Element {
    const stripes_css = {
        backgroundColor:    'rgb(240,240,240)',
        backgroundImage:    'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.5) 5px, rgba(255,255,255,.5) 7px)',
    }
    const view_box_css = {
        /** content moves around, don't show outside of the borders */
        overflow:           'hidden',
        /** act as anchor for position:absolute overlays inside */
        position:           'relative',
    
        width:              '100%',
        height:             '100%',
        display:            'flex',
        justifyContent:     'center',
        alignItems:         'center',
        marginLeft:         '2px',
        marginRight:        '2px',
    }

    const set_aspect_ratio_css = {
        /* keep aspect ratio; --imagewidth & --imageheight are set on image load */
        maxWidth:       'calc( (100vh - 120px) * var(--imagewidth) / var(--imageheight) )',
        width:          '100%',
        '--imagewidth':  props.imagesize.value?.width,
        '--imageheight': props.imagesize.value?.height,
    }
    const unselectable_css = {/* TODO */}
    const transform_css = {
        /** Modified when image is panned or zoomed */
        transform:  'matrix(1,0,0,1,0,0)'
    }

    return <div class="view-box stripes" style={{...stripes_css, ...view_box_css}} onDblClick={console.warn /* TODO */}>
        {/* TODO: transform-box callbacks */}
        <div 
        class="transform-box unselectable set-aspect-ratio-manually" 
        style={{...set_aspect_ratio_css, ...unselectable_css, ...transform_css}}
        >
            {/* prevent children from receiving inputs by default */}
            <div style="pointer-events: none">
                { props.children }
            </div>
        </div>
    </div>
}


/** Main image container. May contain multiple images side-by-side. */
export function ImageContainer(props:{children:preact.ComponentChildren}): preact.JSX.Element {
    const css = {
        display:            'flex',
        width:              '100%',
        height:             'calc(100vh - 120px)',
        alignItems:         'center',
        justifyContent:     'space-around',
    }
    return <div class="image-container" style={css}>
        { props.children }
    </div>
}


/** Static rotating spinner to indicate image loading */
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

/** Display either a spinner or the children components */
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

export function FileTableRow( props:InputImageProps ): preact.JSX.Element {
    const loading: signals.ReadonlySignal<boolean> 
        = signals.computed( () => !props.file.$loaded.value )

    return <>
        {/* The row of the file table, conains image name and optionally more */}
        <tr class="ui title table-row">
            <td> {props.file.name} </td>
        </tr>
        {/* The content, shown when clicked on a row. */}
        <tr style="display:none" {...{filename:props.file.name} }>
            <td>
                <SpinnerSwitch loading={loading.value}> 
                    {/* TODO: refactor */}
                    <ContentMenu file={props.file} />
                    <ImageContainer>
                        <ImageControls imagesize={props.file.$size}>
                            <InputImage {...props} /> 
                        </ImageControls>
                    </ImageContainer>
                </SpinnerSwitch>
            </td>
        </tr>
    </>
}





type FileTableBodyProps = {
    files:          AppFileList;
    active_file:    signals.ReadonlySignal<string|null>;
}

export function FileTableBody(props:FileTableBodyProps): preact.JSX.Element {
    const rows: preact.JSX.Element[] 
        = props.files.value.map( (f:AppFileState) => <FileTableRow key={f.name} file={f} active_file={props.active_file}/>)
    
    return <tbody>
        { rows }
    </tbody>
}





type FileTableProps = {
    files:      AppFileList;
    sortable:   boolean;
}

export class FileTable extends preact.Component<FileTableProps> {
    /** The currently displayed filename. null if all closed. */
    #$active_file:signals.Signal<string|null> = new signals.Signal(null);

    render(): preact.JSX.Element {
        const sort_class: string = this.props.sortable ? 'sortable' : '';         //TODO fix classes
        return <table class="ui fixed celled { sort_class } unstackable table accordion filetable" style="border:0px; margin-top:0px;" >
            <FileTableHead />
            <FileTableBody files={this.props.files} active_file={this.#$active_file}/>
        </table>
    }

    componentDidMount(): void {
        // deno-lint-ignore no-this-alias
        const _this:FileTable = this;

        $('.filetable.accordion').accordion({
            duration:  0, 
            onOpening: function(){ _this.on_accordion_open(this[0]) },
            onClose:   function(){ _this.#$active_file.value = null },
        })
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
        this.#$active_file.value     = filename;
    }
}
