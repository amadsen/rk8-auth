var select = use('select'),
    on = use('on');

select("#login-html .login_auth_button").forEach( function (btn){
  btn.authResult = function () {
    // gather the username and password
    return select("#login-html form [name]").reduce( function(result, el){
      if(el.name && el.value){
        result[el.name] = el.value;
      }
      return result;
    }, {});
  }
});
