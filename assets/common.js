$(document).on('click', '.has-items', function(){
    $(this).toggleClass('active');
    $(this).find('.codicon').toggleClass('codicon-chevron-right codicon-chevron-down');
});