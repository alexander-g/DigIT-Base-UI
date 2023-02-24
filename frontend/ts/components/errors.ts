import "../dep.ts"


/** Default error message */
export function show_error_toast(message:string): void {
    $('body').toast({message, class:'error'})
}


