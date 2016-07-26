var messaging = require("./lib/internal-messaging.js"),
    select = use('select'),
    parentsOf = use('parentsOf'),
    on = use('on');

select(".configuration-container .edit").forEach( on("click", function(editButton){
    var item = parentsOf(editButton, '.configuration-item');
    // change all elements to editing state
}));

select(".configuration-container .add").forEach( on("click", function(editButton){
    var container = parentsOf(editButton, '.configuration-container');
    // get a new copy of the template
    
    // instantiate it
    
    // put it in editing state
}));