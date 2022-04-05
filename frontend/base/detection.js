
class BaseDetection{

    static on_process_image(event){
        var filename = $(event.target).closest('[filename]').attr('filename')
        this.process_image(filename)
    }


    static process_image(filename){
        //TODO: states: unprocessed, processing, processed, annotation loaded
        console.log(`Processing image file ${filename}`)
        this.show_dimmer(filename)
        
        //Called on a server-side event from the server notifying about processing progress
        function on_message(event){
            var data = JSON.parse(event.originalEvent.data);
            if(data.image!=filename)
                return;

            console.log(event)
            //TODO: update dimmer
        }
        $(GLOBAL.event_source).on('message', on_message)

        var file    = GLOBAL.files[filename];
        let promise = upload_file_to_flask(file)
        promise.fail( response => {
            console.log('File upload failed.', response.status)
            $('body').toast({message:'File upload failed.', class:'error'})
        })

        promise = promise.then( function(){
            return $.get(`process_image/${filename}`).fail( response => {
                console.log('Processing failed.', response.status)
                $('body').toast({message:'Processing failed.', class:'error'})
            })
        })
        promise.done(results => this.process_results(filename, results))


        promise.always( _ => {
            this.hide_dimmer(filename)
            //TODO: delete_image_from_flask(filename)
            $(GLOBAL.event_source).off('message', on_message)
        })
        return promise;
    }


    static process_results(filename, results){
        console.log(`Processing ${filename} successful.`, results)

        var $root      = $(`[filename="${filename}"]`)
        var $container = $root.find(`.result.view-box`)
        var $image     = $container.find('img.result-image')
        $image.attr('src', url_for_image(results.segmentation)).css('filter','contrast(1)')
        //$container.show()

        var $result_overlay = $root.find(`.input.overlay`)
        $result_overlay.attr('src', url_for_image(results.segmentation))
        show_results_as_overlay(filename);  //TODO: remove?

        GLOBAL.files[filename].results = results;  //TODO: detection_results
        $root.find('a.download').removeClass('disabled')
        //TODO: indicate in the file table that this file is processed
    }




    static show_dimmer(filename, message='Processing...'){
        $(`[filename="${filename}"] .view-box`).dimmer({
            displayLoader:   true,
            loaderVariation: 'slow orange medium elastic',
            loaderText:      message,
        }).dimmer('show');

        //XXX: function should be called show_dimmer_and_disable_menu()
        $(`[filename="${filename}"] .icon.menu .item`).addClass('disabled')
        //TODO: also disable settings, 'Process All' button, etc
    }

    static hide_dimmer(filename){
        $(`[filename="${filename}"] .view-box`).dimmer('hide')
        $(`[filename="${filename}"] .icon.menu .item`).removeClass('disabled')
    }

    static update_dimmer(filename, message){
        console.log('TODO: update_dimmer() not implemented')
    }

}