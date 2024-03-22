import { flags } from "./dep.ts"


export async function encrypt_file(
    inputfilepath:  string, 
    outputfilepath: string, 
    key:            string,
): Promise<void> {
    const inputbuffer:Uint8Array = Deno.readFileSync(inputfilepath);
    const iv:Uint8Array = crypto.getRandomValues(new Uint8Array(16));

    const algorithm = { name: "AES-GCM", iv: iv };
    const key_u8:Uint8Array = encode_string_to_256bits(key)
    const cryptokey 
        = await crypto.subtle.importKey("raw", key_u8, algorithm, false, ["encrypt"]);
    const encrypted:ArrayBuffer 
        = await crypto.subtle.encrypt(algorithm, cryptokey, inputbuffer);

    const outputdata = new Uint8Array(encrypted.byteLength + iv.byteLength);
    outputdata.set(iv, 0);
    outputdata.set(new Uint8Array(encrypted), iv.byteLength);

    Deno.writeFileSync(outputfilepath, outputdata);
}

export async function decrypt_file(
    inputfilepath:  string,
    outputfilepath: string,
    key:            string,
): Promise<void> {
    const inputbuffer:Uint8Array = Deno.readFileSync(inputfilepath);
    // Extract IV from the beginning of the file
    const iv:Uint8Array = inputbuffer.slice(0, 16);
    const encryptedData:Uint8Array = inputbuffer.slice(16);

    const algorithm = { name: "AES-GCM", iv: iv };
    const key_u8:Uint8Array = encode_string_to_256bits(key)
    const cryptokey 
        = await crypto.subtle.importKey("raw", key_u8, algorithm, false, ["decrypt"]);
    const decrypted:ArrayBuffer 
        = await crypto.subtle.decrypt(algorithm, cryptokey, encryptedData);

    Deno.writeFileSync(outputfilepath, new Uint8Array(decrypted));
}

/** Convert a string to binary 32 bytes. Truncated if too long, thus not secure. */
function encode_string_to_256bits(key:string): Uint8Array {
    const result:Uint8Array = new Uint8Array(32).fill(0)
    new TextEncoder().encodeInto(key, result)
    return result;
}



// deno-lint-ignore no-inferrable-types
export const DEFAULT_KEY:string = '#*$@!-anti-virus'

type Args = {
    'sourcefile': string;
    'targetfile': string;
    'key':        string;
}

function parse_args(): Args|Error {
    const args:Pick<Args, 'key'> & {_:string[]} = flags.parse(
        Deno.args, 
        {
            default: {key:DEFAULT_KEY},
            string:  ['key'],
        }
    )
    if(args._.length != 2)
        return new Error('Source file and destination required')
    return {sourcefile:args._[0]!, targetfile:args._[1]!, ...args};
}

if(import.meta.main) {
    const args:Args|Error = parse_args()
    if(args instanceof Error){
        console.log( (args as Error).message );
        Deno.exit(1)
    }

    await encrypt_file(args.sourcefile, args.targetfile, args.key);
    console.log('Done')
}
