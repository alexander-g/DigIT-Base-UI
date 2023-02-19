import { preact, signals }  from "../dep.ts"
import type { AppFileState, AppFile, AppFileList }     from "../state.ts"
import "../jquery_mock.ts"
import { set_image_src } from "../file_input.ts"
import { ContentMenu } from "./ContentMenu.tsx"


export function FileTableHead(): preact.JSX.Element {
    return <thead>

    </thead>
}




export function InputImage(props:{file:AppFileState}): preact.JSX.Element {
    //TODO: this should be probably a class component
    const ref:preact.RefObject<HTMLImageElement> = preact.createRef()
    function on_load() {
        if(ref.current){
            //TODO: resize if too large
            props.file.set_loaded(ref.current)
        }
    }
    const css = {width: '100%'}
    return <img class={"input-image"} onLoad={on_load} style={css} ref={ref} />
}


type ImageControlsProps = {
    children:       preact.ComponentChildren,
    imagesize:      {width:number, height:number}|undefined, //TODO: make type
}

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
        '--imagewidth':  props.imagesize?.width,
        '--imageheight': props.imagesize?.height,
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

export function FileTableRow( props:{file:AppFileState} ): preact.JSX.Element {
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
                        <ImageControls imagesize={props.file.$size.value}>  {/* //TODO: this should be probably not a  .value */}
                            <InputImage file={props.file} /> 
                        </ImageControls>

                        <ImageControls imagesize={props.file.$size.value}>  {/* //TODO: this should be probably not a  .value */}
                            <InputImage file={props.file} /> 
                        </ImageControls>
                    </ImageContainer>
                </SpinnerSwitch>
            </td>
        </tr>
    </>
}





type FileTableBodyProps = {
    files:      AppFileList,
}

export function FileTableBody(props:FileTableBodyProps): preact.JSX.Element {
    const rows: preact.JSX.Element[] 
        = props.files.value.map( (f:AppFileState) => <FileTableRow key={f.name} file={f}/>)
    
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
        // deno-lint-ignore no-this-alias
        const _this:FileTable = this;

        $('.filetable.accordion').accordion({
            duration:  0, 
            onOpening: function(){ _this.on_accordion_open(this[0]) }
        })
    }

    /**
     * Callback from Fomantic after user clicks on a table row to open it.
     * Initiates loading the corresponding input image.
     * 
     * @param opened_row - the second "tr" element from FileTableRow
     */
    private on_accordion_open(opened_row:HTMLTableRowElement|undefined): void {
        if(!opened_row)
            return
        
        const filename: string|null = opened_row?.getAttribute('filename')
        //TODO: a direct mapping would be more elegant
        const files:AppFileState[]       = this.props.files.peek().filter(
            (f:AppFile) => (f.name == filename)
        )
        if(files.length != 1) {
            console.warn(`[WARNING] Unexpected number of files for ${filename}:`, files)
            return;
        }

        const file:AppFileState = files[0]!
        //TODO: refactor
        const input_image: HTMLImageElement|null = opened_row.querySelector('img.input-image')
        if(input_image){
            set_image_src(input_image, file)
        }
    }
}
