import "../dep.ts"


export type error_fn = (msg:string, error?:Error) => void;

/** Default error message */
export const show_error_toast:error_fn = (message:string, error?:Error) => {
    console.error(message, error ?? '')
    //TODO: dont disappear automatically
    $('body').toast({message, class:'error'})
}


