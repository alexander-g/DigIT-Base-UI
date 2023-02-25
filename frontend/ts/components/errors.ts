import "../dep.ts"


export type error_fn = (msg:string) => void;

/** Default error message */
export function show_error_toast(message:string): void {
    //TODO: dont disappear automatically
    $('body').toast({message, class:'error'})
}


