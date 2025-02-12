import { JSX, signals, Signal } from "../dep.ts"
import { TabContent } from "./MainContainer.tsx"
import { AppState, InputResultPairOfAppState }   from "./state.ts"
import * as ui_util   from "./ui_util.ts"



export abstract class TrainingTab<AS extends AppState> extends TabContent<AS> {
    trainingmodal: preact.RefObject<TrainingModal> = preact.createRef()
    
    $modeltype: Signal<string|null> = new Signal(null)

    /** Signal indicating whether the "Start Training" button should be active */
    $startbutton_active: Readonly<Signal<boolean>> = signals.computed(
        () => (
            (this.$modeltype.value != null) 
            // TODO: and a model selected in settings
            && (this.filepairs_suitable_for_training().length > 0)
        )
    )

    render(): JSX.Element {
        const css = {
            display: "grid",
            'grid-template-columns': '50% 50%',
            'grid-column-gap': '5px',
            'align-items' : 'start',
        };

        return <>
            <div 
                data-tab = {this.props.name}
                class    = {"ui tab unselectable"} 
            >
                <div style = {css}>
                    { this.training_controls() }
                    <TrainingInstructions />
                </div>
            </div>

            <TrainingModal ref={this.trainingmodal} />
        </>
    }

    training_controls(): JSX.Element {
        const modeltype:string|null = this.$modeltype.value
        const modelname:string = (
            (modeltype == null)
            ? "None"
            // @ts-ignore type hell
            : this.props.appstate.$settings.value?.active_models[modeltype]
        ) ?? "None"

        const n:number = this.filepairs_suitable_for_training().length;

        return (
        <div>
            <div class="ui segment form" style="margin-top:0px;">
                { this.modeltype_dropdown() }

                <div class="ui divider"></div>

                <LR_EpochsField 
                    label          = "Hyperparameters" 
                    default_lr     = {1e-3} 
                    default_epochs = {10}
                />
    
                <div class="ui divider"></div>

                <StartingPointInfoBox modelname={modelname} />
                <NumberOfFilesInfoBox n={n} />

                <div class="ui divider"></div>

                <StartTrainingButton 
                    callback = {this.on_start_training} 
                    $active  = {this.$startbutton_active}
                />
                <SaveModelField 
                    callback = {this.on_save_model}
                    $visible = {signals.computed(
                        () => (modelname == '')
                    )}
                />
            </div>
        </div>
        )
    }

    abstract on_start_training(): Promise<void>;
    abstract on_save_model(new_modelname:string): Promise<void>;
    abstract filepairs_suitable_for_training(): InputResultPairOfAppState<AS>[];
    abstract modeltype_dropdown(): JSX.Element;
}



function LR_EpochsField(props:{
    label:          string, 
    default_lr:     number, 
    default_epochs: number
}
): JSX.Element {
    return <>
    <div class="field" id="training-learning-rate-field">
        <label>{props.label}</label>
    <div class="ui input" id="settings-micrometers">
        <label style="padding:10px; width:50%;">Learning rate:</label>
        <input 
            type  = "number" 
            step  = "0.0001" 
            min   = "0.00001" 
            style = "width: 5ch;" 
            value = {props.default_lr} 
            id    = 'training-learning-rate' 
        />
    </div>
    </div>
    <div class="field" id="training-number-of-epochs-field">
    <div class="ui input" id="settings-micrometers">
        <label style="padding:10px; width:50%;">Number of epochs:</label>
        <input 
            type  = "number" 
            step  = "1" 
            min   = "1" 
            style = "width: 5ch;" 
            value = {props.default_epochs} 
            id    = 'training-number-of-epochs' 
        />
    </div>
    </div>
    </>
}

function StartingPointInfoBox(props:{modelname:string}): JSX.Element {
    // TODO: redesign
    const labeltext:string = 
        (props.modelname == '') ? '[UNSAVED MODEL]' : props.modelname;
    return <div class="ui message" id="training-model-info-message">
        <p>
            Starting point for retraining: 
            <b id="training-model-info-label"> {labeltext} </b>
        </p>
    </div>
}

function NumberOfFilesInfoBox(props:{n:number}): JSX.Element {
    // TODO: redesign
    return <div class="ui message" id="training-number-of-files-info-message">
        <p>
            Number of training files: 
            <b id="training-number-of-files-info-label"> {props.n} </b>
        </p>
    </div>
}


function StartTrainingButton(props:{
    callback: () => void,
    $active?: Readonly<Signal<boolean>>
}): JSX.Element {
    const active:boolean = (props.$active == undefined) || (props.$active.value)
    const disabled_css:string = (active) ? "" : "disabled";
    return (
        <label 
            class   = {`ui violet basic fluid ${ disabled_css } button`}
            onClick = { props.callback } 
            style   = "margin-bottom: 20px;">
                <i class="shuffle icon"></i>
                Start Training
        </label>
    )
}


type SaveModelFieldProps = {
    callback: (name:string) => void;
    $visible: Readonly<Signal<boolean>>;
}

class SaveModelField extends ui_util.MaybeHidden<SaveModelFieldProps> {
    inputref:preact.RefObject<HTMLInputElement> = preact.createRef()

    render(): JSX.Element {
        return (
        <div class="ui segment form" style={this.get_display_css()}>
            <div class="ui field">
                <label>Save trained model</label>
                <div class="ui action input">
                    <input 
                        type        = "text" 
                        placeholder = "New model name" 
                        ref         = {this.inputref}
                    />
                    <button 
                        class   = "ui violet right labeled icon button" 
                        onClick = {this.#on_save_model}
                    >
                        <i class="save icon"></i>
                        Save Model
                    </button>
                </div>
            </div>
      </div>
      )
    }

    #_on_save_model() {
        if(!this.inputref.current)
            return;
        
        const name:string = this.inputref.current.value;
        this.props.callback(name)
        this.inputref.current.value = ''
    }
    #on_save_model = this.#_on_save_model.bind(this)
}


export class TrainingModal extends preact.Component {
    ref: preact.RefObject<HTMLDivElement> = preact.createRef()

    render(): JSX.Element {
        return (
        <div class="ui tiny modal" id="settings-dialog" ref={this.ref}>
            <div class="header"> Training </div>

            <div class="ui form content">
                <div class="ui progress">
                    <div class="bar">
                        <div class="progress"></div>
                    </div>
                    <div class="label">Training Progress</div>
                </div>
            </div>

            <div class="actions">
                <div class="ui negative button" id="cancel-training-button">
                    Stop Training
                </div>
                <div class="ui positive button hidden" id="ok-training-button">
                    Ok
                </div>
            </div>

        </div>
        )
    }

    show() {
        $(this.ref.current).find('.progress')
            .progress('remove error')
            .progress('remove success')
            .progress('set label', 'Training in progress...')
            .progress('reset');
        $(this.ref.current).find('#ok-training-button')
            .hide()
        $(this.ref.current).find('#cancel-training-button')
            .removeClass('disabled')
            .show()

        $(this.ref.current).modal({
            closable: false, 
            inverted: true, 
            //onDeny: x => this.on_cancel_training(),
        }).modal('show');
    }

    failed() {
        $(this.ref.current).find('.progress').progress('set error', 'Training failed');
        $(this.ref.current).find('#cancel-training-button').removeClass('disabled')
        $(this.ref.current).modal({closable:true})
    }

    success() {
        $(this.ref.current).find('.progress').progress('set success', 'Training finished');
        $(this.ref.current).find('#ok-training-button').show()
        $(this.ref.current).find('#cancel-training-button').hide()
    }

    // TODO: interrupted()
    // TODO: success()

}


/** TODO */
function TrainingInstructions(): JSX.Element {
    return <div class="ui segment form" style="margin-top:0px;">
        Instructions
    </div>
}



type ModelTypeDropdownProps<T extends string> = {
    $value: Signal<T|null>;
    modeltypes_descriptions: Record<string, string>
}

export class ModelTypeDropdown<T extends string> 
extends preact.Component<ModelTypeDropdownProps<T>> {
    ref: preact.RefObject<HTMLDivElement> = preact.createRef()

    render(): JSX.Element {
        let defaulttext:JSX.Element|null = null;
        if(this.props.$value.value == null)
            defaulttext = <>
                <i class="yellow exclamation triangle icon"></i>
                Select Model Type
            </>
        
        const menu_items: JSX.Element[] = []
        for(const [modeltype, description] of 
                Object.entries(this.props.modeltypes_descriptions)){
            menu_items.push(
                <div class="item" data-value={modeltype}>
                    { description }
                </div>
            )
        }
        
        return (
            <div class="field" id="training-model-type-field">
                <div class="field">
                    <label>Model Type</label>
                    <div 
                        class = "ui dropdown selection"      
                        id    = "training-model-type"
                        ref   = {this.ref}
                    >
                        <input type="hidden" name="active-model" />
                        <i class="dropdown icon"></i>
                        <div class="default text">
                            { defaulttext }
                        </div>
                        <div class="menu">
                            { menu_items }
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    override componentDidMount(): void {
        // initialize fomantic dropdown
        $(this.ref.current).dropdown({
            onChange: this.#on_change
        })
    }

    #_on_change(value:T) {
        this.props.$value.value = value;
    }
    #on_change = this.#_on_change.bind(this);

}

