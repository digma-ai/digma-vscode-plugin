
window.addEventListener("load", main);

function main() {
    $(document).on('click', '.has-items', function(){
        $(this).toggleClass('active');
        $(this).find('.codicon:first-of-type').toggleClass('codicon-chevron-right codicon-chevron-down');
    });
}